import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { user } from '../test-user';
import i18n from '../../i18n';
import { IWalletProvider } from '../IWalletContext';
import IWalletShell, { IWalletIndex } from '../IWalletRoutes';
import Send from './Send';
import type { KvStore } from '../idb';

const ADDR = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const BOB = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const T = 10n ** 12n;

const impl = vi.hoisted(() => ({
  hezSpendable: 0n, assets: {} as Record<number, bigint>, fee: 0n as bigint | 'fail',
  script: [] as string[], sendRejects: false, faceOn: false, face: null as string | null,
  signed: [] as Array<{ name: string; args: unknown[] }>, pairs: [] as Array<{ lock: ReturnType<typeof vi.fn> }>, unlockPw: [] as string[],
  scanned: null as string | null, scanFails: false,
  feeFn: null as null | ((amount: bigint) => bigint), feeGate: null as null | Promise<void>, unsubs: 0, rejectWith: null as unknown, balanceReads: [] as string[],
  // Per network: spendable HEZ, a failing read, the fee, the error the registry decodes; and which network each
  // connection, fee estimate and signature was made on.
  spendBy: {} as Record<string, bigint>, spendFail: [] as string[], feeBy: {} as Record<string, bigint>, metaErrBy: {} as Record<string, string>,
  apiChains: [] as string[], signedOn: [] as string[], feeOn: [] as string[], unlockGate: null as null | Promise<void>,
}));

vi.mock('../data', () => ({
  chainSpendable: (chain: string) => {
    impl.balanceReads.push(chain);
    return impl.spendFail.includes(chain) ? Promise.reject(new Error('down')) : Promise.resolve(impl.spendBy[chain] ?? impl.hezSpendable);
  },
  loadAssetBalances: () => Promise.resolve([
    { id: 1, symbol: 'PEZ', decimals: 12, amount: impl.assets[1] ?? 0n }, { id: 1000, symbol: 'USDT', decimals: 6, amount: impl.assets[1000] ?? 0n },
  ]),
}));
vi.mock('../faceid', () => ({
  hasFaceId: () => Promise.resolve(impl.faceOn), unlockWithFaceId: () => Promise.resolve(impl.face),
  faceIdSupported: () => Promise.resolve(false), enrolFaceId: vi.fn(), forgetFaceId: () => Promise.resolve(true),
}));
vi.mock('../../account/connectors/qr', () => ({
  scanQr: () => (impl.scanFails ? Promise.reject(new Error('no camera')) : Promise.resolve(impl.scanned ?? '')),
}));
vi.mock('../keystore', async (orig) => {
  const real = await orig<typeof import('../keystore')>();
  const unlock = (_json: unknown, pw: string) => {
    impl.unlockPw.push(pw);
    if (pw !== 'right-pass1') return Promise.reject(new real.WrongPasswordError());
    const pair = { address: ADDR, lock: vi.fn() };
    impl.pairs.push(pair);
    return (impl.unlockGate ?? Promise.resolve()).then(() => pair);
  };
  return {
    ...real,
    loadKeystore: () => Promise.resolve({ address: ADDR, encoded: 'enc' }),
    unlock,
    // The context proves the password through the same (mocked) decrypt and locks the pair at once.
    verifyPassword: (json: unknown, pw: string) => unlock(json, pw).then((p) => { p.lock(); }),
  };
});

const result = (kind: string) => {
  const base = { events: [{ event: { section: 'system', method: 'ExtrinsicSuccess' } }], internalError: undefined as unknown, dispatchError: undefined as unknown, txHash: { toHex: () => '0xabc123' }, status: { isInBlock: false, isFinalized: false, isDropped: false, isInvalid: false, isUsurped: false, isFinalityTimeout: false } };
  if (kind === 'inBlock') return { ...base, status: { ...base.status, isInBlock: true, asInBlock: { toHex: () => '0xb1' } } };
  if (kind === 'finalized') return { ...base, status: { ...base.status, isFinalized: true, asFinalized: { toHex: () => '0xb2' } } };
  if (kind === 'timeout') return { ...base, status: { ...base.status, isFinalityTimeout: true } };
  if (kind === 'finalizedNoEvents') return { ...base, events: [], internalError: new Error('events'), status: { ...base.status, isFinalized: true, asFinalized: { toHex: () => '0xb2' } } };
  if (kind === 'dropped') return { ...base, status: { ...base.status, isDropped: true } };
  if (kind === 'invalid') return { ...base, status: { ...base.status, isInvalid: true } };
  return { ...base, status: { ...base.status, isInBlock: true, asInBlock: { toHex: () => '0xb1' } }, dispatchError: { isModule: kind === 'failed', asModule: {} } };
};
const mkTx = (chain: string, name: string, args: unknown[]) => ({
  paymentInfo: () => {
    impl.feeOn.push(chain);
    if (impl.fee === 'fail') return Promise.reject(new Error('rpc'));
    const fee = impl.feeFn ? impl.feeFn(args[args.length - 1] as bigint) : (impl.feeBy[chain] ?? impl.fee);
    return (impl.feeGate ?? Promise.resolve()).then(() => ({ partialFee: { toBigInt: () => fee } }));
  },
  signAsync: vi.fn(() => { impl.signed.push({ name, args }); impl.signedOn.push(chain); return Promise.resolve(); }),
  send: (cb: (r: unknown) => void) => {
    if (impl.sendRejects) return Promise.reject(impl.rejectWith ?? new Error('ws closed'));
    impl.script.forEach((k) => cb(result(k)));
    return Promise.resolve(() => { impl.unsubs++; });
  },
});
const on = vi.fn();
const off = vi.fn();
// One stub connection per network, so a test can tell which network a transfer was priced, signed and decoded on.
const mkApi = (chain: string) => ({
  tx: {
    balances: { transferKeepAlive: (...a: unknown[]) => mkTx(chain, 'balances.transferKeepAlive', a) },
    // Asset Hub and People both have an assets pallet (People's measured on mainnet); the relay has none. So an asset
    // send routed to People would build and sign there, and only signedOn shows the mistake.
    ...(chain !== 'relay' ? { assets: { transfer: (...a: unknown[]) => mkTx(chain, 'assets.transfer', a) } } : {}),
  },
  rpc: { chain: { getHeader: () => Promise.resolve({ number: { toNumber: () => (chain === 'assetHub' ? 77 : chain === 'relay' ? 88 : 99) } }) } },
  registry: { findMetaError: () => ({ section: 'balances', name: impl.metaErrBy[chain] ?? 'InsufficientBalance' }) },
  on, off,
});
const apis: Record<string, ReturnType<typeof mkApi>> = { relay: mkApi('relay'), assetHub: mkApi('assetHub'), people: mkApi('people') };
const stubApi = apis.assetHub;
vi.mock('../chain', () => ({
  getMainnetApi: (chain: string) => { impl.apiChains.push(chain); return Promise.resolve(apis[chain]); },
  networkChanged: () => false, subscribeNetworkChanged: () => () => undefined,
}));

let store: Map<string, unknown>;
const makeStore = (): KvStore => ({
  get: (k) => Promise.resolve(store.get(k)),
  set: (k, v) => { store.set(k, v); return Promise.resolve(); },
  delete: (k) => { store.delete(k); return Promise.resolve(); },
  deleteMany: (ks) => { ks.forEach((k) => store.delete(k)); return Promise.resolve(); },
  setMany: (e, rm = []) => { Object.entries(e).forEach(([k, v]) => store.set(k, v)); rm.forEach((k) => store.delete(k)); return Promise.resolve(); },
});

const renderSend = (path = '/i-wallet/send') => render(
  <MemoryRouter initialEntries={[path]}>
    <IWalletProvider store={makeStore()}>
      <Routes>
        <Route path="i-wallet" element={<IWalletShell />}>
          <Route index element={<IWalletIndex />} />
          <Route path="send" element={<Send />} />
        </Route>
      </Routes>
    </IWalletProvider>
  </MemoryRouter>,
);
const NET = { relay: 'Relay', assetHub: 'Asset Hub', people: 'People' } as const;
const unlockOnly = async () => {
  await user.type(await screen.findByLabelText('Parola'), 'right-pass1');
  await user.click(screen.getByRole('button', { name: 'Kilidi aç' }));
};
// Unlocks, then walks the wallet's send flow: the token, then (HEZ only) the network.
const login = async (token: 'HEZ' | 'PEZ' | 'USDT' = 'HEZ', chain: keyof typeof NET = 'assetHub') => {
  await unlockOnly();
  await user.click(await screen.findByRole('button', { name: new RegExp(`^${token}`) }));
  if (token === 'HEZ') await user.click(await screen.findByRole('button', { name: new RegExp(`^${NET[chain]}`) }));
  await screen.findByLabelText('Alıcı adresi');
  // Wait for the balances so the screen is in its settled state.
  await screen.findByText(/Kullanılabilir: [^—]/);
};
// The fee for the current input is known (or known to be unavailable): Review is then meaningful.
const settled = () => waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull(), { timeout: 3000 });
const amountField = () => screen.getByLabelText('Tutar');
const review = () => screen.getByRole('button', { name: /Face ID ya da parolayla onayla/ });
const fill = async (to: string, amount: string) => {
  await user.type(screen.getByLabelText('Alıcı adresi'), to);
  await settled();
  await user.type(amountField(), amount);
  await settled();
};
const confirmWith = async (pw: string) => {
  await user.click(review());
  await user.type(await screen.findByLabelText('Parola'), pw);
  await user.click(screen.getByRole('button', { name: 'Gönder' }));
};
// The sign-in pair is created first; the transfer decrypts its own, which is the last one.
const signPair = () => impl.pairs[impl.pairs.length - 1];

describe('i-Wallet send', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('tr');
    store = new Map<string, unknown>([['keystore', {}], ['words', {}]]);
    Object.assign(impl, { spendBy: {}, spendFail: [], feeBy: {}, metaErrBy: {}, apiChains: [], signedOn: [], feeOn: [], unlockGate: null });
    Object.assign(impl, { hezSpendable: 5000n * T, assets: { 1: 20n * T, 1000: 9_000_000_000n }, fee: 2_000_000_000n, script: ['inBlock', 'finalized'], sendRejects: false, faceOn: false, face: null, scanned: null, scanFails: false, feeFn: null, feeGate: null, unsubs: 0, rejectWith: null });
    impl.signed = []; impl.pairs = []; impl.unlockPw = []; impl.balanceReads = [];
  });

  it('gates HEZ above 1000 behind the orange alert and its checkbox, and only then enables confirm', async () => {
    renderSend(); await login();
    await fill(BOB, '1000');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(review()).toBeEnabled();
    await user.type(amountField(), '1000.000000000001');
    await settled();
    expect(screen.getByText(/Bu tutar sıcak cüzdan için yüksek/)).toBeInTheDocument();
    expect(review()).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /Anladım, yine de göndereceğim/ }));
    expect(review()).toBeEnabled();
    // Editing the amount asks for the acknowledgement again.
    await user.type(amountField(), '1001');
    await settled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(review()).toBeDisabled();
  });

  it('never gates USDT, even 5000', async () => {
    renderSend(); await login('USDT');
    await fill(BOB, '5000'); // 9000 USDT are available, so only the gate could block this
    expect(screen.queryByText(/sıcak cüzdan için yüksek/)).toBeNull();
    expect(review()).toBeEnabled();
  });

  it('Max for HEZ leaves the fee and the existential deposit', async () => {
    impl.hezSpendable = 5n * T;
    renderSend(); await login();
    const max = screen.getByRole('button', { name: 'En çok' });
    await waitFor(() => expect(max).toBeEnabled(), { timeout: 3000 });
    await user.click(max);
    // fee 0.002 HEZ plus the 10% margin, then the existential deposit.
    expect((amountField() as HTMLInputElement).value).toBe('4.997796666667');
  });

  it('Max for USDT is the whole balance, without waiting for a fee', async () => {
    renderSend(); await login('USDT');
    await user.click(screen.getByRole('button', { name: 'En çok' }));
    expect((amountField() as HTMLInputElement).value).toBe('9000');
  });

  it('shows the fee from paymentInfo, or a dash when it is unavailable', async () => {
    renderSend(); await login();
    await fill(BOB, '1');
    expect(await screen.findByText(/Ağ ücreti: ~0,002/, undefined, { timeout: 3000 })).toBeInTheDocument();
  });

  it('blocks a HEZ review while the fee estimate fails, offers a retry, and releases once it works', async () => {
    impl.fee = 'fail';
    renderSend(); await login();
    await fill(BOB, '1');
    expect(screen.getByText('Ağ ücreti: —')).toBeInTheDocument();
    expect(await screen.findByText('Ağ ücreti hesaplanamadı.', { exact: false })).toBeInTheDocument();
    expect(review()).toBeDisabled();
    impl.fee = 2_000_000_000n;
    await user.click(screen.getByRole('button', { name: 'Tekrar dene' }));
    await settled();
    expect(await screen.findByText(/Ağ ücreti: ~0,002/)).toBeInTheDocument();
    expect(review()).toBeEnabled();
  });

  it('keeps an asset send reviewable without a fee as long as the amount fits the balance', async () => {
    impl.fee = 'fail';
    renderSend(); await login('USDT');
    await fill(BOB, '1');
    expect(review()).toBeEnabled();
    await user.clear(amountField());
    await user.type(amountField(), '9001');
    expect(await screen.findByText('Bu, gönderebileceğinden fazla.')).toBeInTheDocument();
    expect(review()).toBeDisabled();
  });

  it('disables changing the token or network while Max is being computed', async () => {
    renderSend(); await login();
    await fill(BOB, '1');
    let release: () => void = () => undefined;
    impl.feeGate = new Promise<void>((r) => { release = r; });
    await user.click(screen.getByRole('button', { name: 'En çok' }));
    expect(screen.getByRole('button', { name: 'Değiştir' })).toBeDisabled();
    release();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Değiştir' })).toBeEnabled());
    impl.feeGate = null;
  });

  it('rejects zero, a bad amount, too many decimals and a bad address', async () => {
    renderSend(); await login();
    await fill(BOB, '0');
    expect(review()).toBeDisabled();
    await user.type(amountField(), 'abc');
    await settled();
    expect(screen.getByText('Geçerli bir tutar yaz.')).toBeInTheDocument();
    await user.type(amountField(), '1,0000000000001');
    await settled();
    expect(screen.getByText(/en fazla 12 ondalık basamak/)).toBeInTheDocument();
    await user.type(amountField(), '1,5');
    await settled();
    expect(review()).toBeEnabled();
    await user.type(screen.getByLabelText('Alıcı adresi'), BOB.slice(0, -1) + 'x');
    await settled();
    expect(screen.getByText(/geçerli bir adres değil/)).toBeInTheDocument();
    expect(review()).toBeDisabled();
  });

  it('warns, but allows, sending to your own address', async () => {
    renderSend(); await login();
    await fill(ADDR, '1');
    expect(screen.getByText(/kendi adresin/)).toBeInTheDocument();
    expect(review()).toBeEnabled();
  });

  it('blocks a PEZ send when HEZ cannot pay the fee', async () => {
    impl.hezSpendable = 1_000n;
    renderSend(); await login('PEZ');
    await fill(BOB, '1');
    expect(await screen.findByText(/yeterli HEZ'in yok/, undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(review()).toBeDisabled();
  });

  it('fills the recipient from a scanned QR code', async () => {
    impl.scanned = BOB;
    renderSend(); await login();
    await user.click(screen.getByRole('button', { name: 'QR kod tara' }));
    await waitFor(() => expect((screen.getByLabelText('Alıcı adresi') as HTMLInputElement).value).toBe(BOB));
  });

  it('sends HEZ with a fresh pair, shows the block and hash, and locks that pair', async () => {
    renderSend(); await login();
    await fill(BOB, '1,5');
    await confirmWith('right-pass1');
    expect(await screen.findByText('Gönderildi')).toBeInTheDocument();
    expect(impl.signed).toEqual([{ name: 'balances.transferKeepAlive', args: [BOB, 1_500_000_000_000n] }]);
    expect(impl.unlockPw).toEqual(['right-pass1', 'right-pass1']);
    expect(impl.pairs).toHaveLength(2);
    expect(signPair().lock).toHaveBeenCalled();
    expect(await screen.findByText('77')).toBeInTheDocument();
    expect(screen.getByText('0xabc123')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'İşlem kodunu kopyala' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /payment/i })).toBeNull();
  });

  it('sends USDT as asset 1000 with 6 decimals', async () => {
    renderSend(); await login('USDT');
    await fill(BOB, '2,5');
    await confirmWith('right-pass1');
    await screen.findByText('Gönderildi');
    expect(impl.signed).toEqual([{ name: 'assets.transfer', args: [1000, BOB, 2_500_000n] }]);
  });

  it('shows "in a block" while waiting for finality', async () => {
    impl.script = ['inBlock'];
    renderSend(); await login();
    await fill(BOB, '1');
    await confirmWith('right-pass1');
    expect(await screen.findByText(/Ağ tarafından kabul edildi/)).toBeInTheDocument();
    expect(screen.queryByText('Gönderildi')).toBeNull();
    // The secret key is already gone while the transfer is still waiting.
    expect(signPair().lock).toHaveBeenCalled();
  });

  it('sends nothing on a wrong password and lets the user retry', async () => {
    renderSend(); await login();
    await fill(BOB, '1');
    await confirmWith('wrong');
    expect(await screen.findByText('Parola yanlış. Tekrar dene.')).toBeInTheDocument();
    expect(impl.signed).toEqual([]);
    expect(impl.pairs).toHaveLength(1);
    await user.type(screen.getByLabelText('Parola'), 'right-pass1');
    await user.click(screen.getByRole('button', { name: 'Gönder' }));
    expect(await screen.findByText('Gönderildi')).toBeInTheDocument();
  });

  it('ignores a second confirm while the first is pending', async () => {
    impl.script = [];
    renderSend(); await login();
    await fill(BOB, '1');
    await user.click(review());
    await user.type(await screen.findByLabelText('Parola'), 'right-pass1');
    const form = screen.getByLabelText('Parola').closest('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(impl.signed).toHaveLength(1));
    await waitFor(() => expect(document.querySelector('.progress-overlay')).toBeNull());
    expect(impl.signed).toHaveLength(1);
    expect(impl.unlockPw.filter((p) => p === 'right-pass1')).toHaveLength(2); // sign-in + one transfer
  });

  it('confirms with Face ID, and falls back to the password when it fails', async () => {
    impl.faceOn = true; impl.face = null;
    renderSend(); await login();
    await fill(BOB, '1');
    await user.click(review());
    await user.click(await screen.findByRole('button', { name: /Face ID ile aç/ }));
    expect(await screen.findByText('Face ID doğrulamadı. Parolanı yaz.')).toBeInTheDocument();
    expect(impl.signed).toEqual([]);
    expect(screen.getByLabelText('Parola')).toBeInTheDocument();
    impl.face = 'right-pass1';
    await user.click(screen.getByRole('button', { name: /Face ID ile aç/ }));
    expect(await screen.findByText('Gönderildi')).toBeInTheDocument();
    expect(impl.signed).toHaveLength(1);
  });

  it('shows the friendly text for a module error and the generic one otherwise', async () => {
    impl.script = ['failed'];
    const first = renderSend(); await login();
    await fill(BOB, '1');
    await confirmWith('right-pass1');
    expect(await screen.findByText(/Bakiye yetersiz/)).toBeInTheDocument();
    first.unmount();
    impl.script = ['failedOther'];
    renderSend(); await login();
    await fill(BOB, '1');
    await confirmWith('right-pass1');
    expect(await screen.findByText('Bir şeyler ters gitti. Tekrar dene.')).toBeInTheDocument();
  });

  it('says the transfer may still complete when the connection drops after sending', async () => {
    impl.script = ['inBlock'];
    renderSend(); await login();
    await fill(BOB, '1');
    await confirmWith('right-pass1');
    await screen.findByText(/Ağ tarafından kabul edildi/);
    const onDisconnect = stubApi.on.mock.calls.find((c) => c[0] === 'disconnected')![1] as () => void;
    onDisconnect();
    expect(await screen.findByText(/yine de tamamlanabilir/)).toBeInTheDocument();
    // The status subscription is released when the disconnect wins, not left running.
    await waitFor(() => expect(impl.unsubs).toBe(1));
  });

  it('reports a transaction the pool refused as invalid (before any block) as not sent', async () => {
    impl.script = ['invalid'];
    renderSend(); await login();
    await fill(BOB, '1');
    await confirmWith('right-pass1');
    expect(await screen.findByText(/Hiçbir şey gönderilmedi/)).toBeInTheDocument();
  });

  it('never says "nothing was sent" for a drop, or for any pool exit after a block: it may still complete', async () => {
    for (const script of [['dropped'], ['inBlock', 'dropped'], ['inBlock', 'invalid']]) {
      impl.script = script;
      const { unmount } = renderSend(); await login();
      await fill(BOB, '1');
      await confirmWith('right-pass1');
      expect(await screen.findByText(/yine de tamamlanabilir/)).toBeInTheDocument();
      expect(screen.queryByText(/Hiçbir şey gönderilmedi/)).toBeNull();
      unmount();
    }
  });

  it('on the form reads only the chosen network, and reads it again after a send', async () => {
    renderSend('/i-wallet/send?token=HEZ&chain=assetHub'); await unlockOnly();
    await screen.findByText(/Kullanılabilir: [^—]/);
    expect(impl.balanceReads).toEqual(['assetHub']);
    await fill(BOB, '1');
    impl.hezSpendable = 4000n * T; // what the chain holds after the transfer
    await confirmWith('right-pass1');
    await screen.findByText('Gönderildi');
    await waitFor(() => expect(impl.balanceReads).toEqual(['assetHub', 'assetHub']));
    await user.click(screen.getByRole('button', { name: 'Bir gönderim daha' }));
    expect(await screen.findByText(/Kullanılabilir: 4\.000/)).toBeInTheDocument();
  });

  it('shows the chain on the confirm screen', async () => {
    renderSend(); await login();
    await fill(BOB, '1');
    await user.click(review());
    const summary = (await screen.findByText('Ağ')).closest('dl')!;
    expect(summary).toHaveTextContent('AğAsset Hub');
  });

  it('an auto-lock during the send keeps the result on screen; leaving it shows the lock', async () => {
    impl.script = ['inBlock'];
    renderSend(); await login();
    await fill(BOB, '1');
    await confirmWith('right-pass1');
    await screen.findByText(/Ağ tarafından kabul edildi/);
    // The wallet locks (5 idle minutes, seen on the wall clock when the window regains focus).
    const now = Date.now();
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => now + 5 * 60_000 + 1);
    fireEvent(window, new Event('focus'));
    spy.mockRestore();
    // Still the result, not the unlock form.
    expect(screen.getByText(/Ağ tarafından kabul edildi/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kilidi aç' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Bitti' }));
    expect(await screen.findByRole('button', { name: 'Kilidi aç' })).toBeInTheDocument();
  });

  it('Max prices the call at the balance-sized amount and keeps a margin, so a fee that grows with the amount never overshoots', async () => {
    impl.hezSpendable = 5n * T;
    impl.feeFn = (a) => 1_000_000_000n + a / 1_000n; // a larger amount costs more
    renderSend(); await login();
    await user.type(screen.getByLabelText('Alıcı adresi'), BOB);
    const max = screen.getByRole('button', { name: 'En çok' });
    await waitFor(() => expect(max).toBeEnabled(), { timeout: 3000 });
    await user.click(max);
    const fee = 1_000_000_000n + (5n * T) / 1_000n;
    const margin = fee + (fee + 9n) / 10n;
    const expected = 5n * T - margin - 3_333_333n;
    await waitFor(() => expect((amountField() as HTMLInputElement).value).not.toBe(''));
    const typed = (amountField() as HTMLInputElement).value;
    expect(typed).toBe((expected / T).toString() + '.' + (expected % T).toString().padStart(12, '0').replace(/0+$/, ''));
    await settled();
    expect(screen.queryByText('Bu, gönderebileceğinden fazla.')).toBeNull();
    expect(review()).toBeEnabled();
  });

  it('keeps Review disabled until the fee for the current amount is known', async () => {
    renderSend(); await login();
    await user.type(screen.getByLabelText('Alıcı adresi'), BOB);
    await user.type(amountField(), '1');
    expect(review()).toBeDisabled(); // the 400 ms estimate has not come back yet
    await settled();
    expect(review()).toBeEnabled();
  });

  it('does not show success when the finalized events cannot be read', async () => {
    impl.script = ['inBlock', 'finalizedNoEvents'];
    renderSend(); await login();
    await fill(BOB, '1');
    await confirmWith('right-pass1');
    expect(await screen.findByText(/yine de tamamlanabilir/)).toBeInTheDocument();
    expect(screen.queryByText('Gönderildi')).toBeNull();
  });

  it('says it may still complete when the send call rejects after hand-off, but failed for a pool refusal', async () => {
    impl.script = []; impl.sendRejects = true;
    const first = renderSend(); await login();
    await fill(BOB, '1');
    await confirmWith('right-pass1');
    expect(await screen.findByText(/yine de tamamlanabilir/)).toBeInTheDocument();
    expect(screen.queryByText('Gönderim başarısız')).toBeNull();
    first.unmount();
    impl.rejectWith = Object.assign(new Error('1010: Invalid Transaction'), { code: 1010 });
    renderSend(); await login();
    await fill(BOB, '1');
    await confirmWith('right-pass1');
    expect(await screen.findByText('Gönderim başarısız')).toBeInTheDocument();
  });

  it('offers Done while pending and explains a slow finality', async () => {
    impl.script = [];
    const first = renderSend(); await login();
    await fill(BOB, '1');
    await confirmWith('right-pass1');
    expect(await screen.findByRole('button', { name: 'Bitti' })).toBeInTheDocument();
    first.unmount();
    impl.script = ['inBlock', 'timeout'];
    renderSend(); await login();
    await fill(BOB, '1');
    await confirmWith('right-pass1');
    expect(await screen.findByText(/Son onay yavaş/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bitti' })).toBeInTheDocument();
  });

  it('"another" resets the form and a second transfer can be sent', async () => {
    renderSend(); await login();
    await fill(BOB, '1');
    await confirmWith('right-pass1');
    await user.click(await screen.findByRole('button', { name: 'Bir gönderim daha' }));
    expect((screen.getByLabelText('Alıcı adresi') as HTMLInputElement).value).toBe('');
    await fill(BOB, '2');
    await confirmWith('right-pass1');
    await screen.findByText('Gönderildi');
    expect(impl.signed).toHaveLength(2);
  });

  it('asset sends need fee plus the existential deposit in HEZ', async () => {
    impl.hezSpendable = 2_000_000_000n + 3_333_333n - 1n;
    renderSend(); await login('PEZ');
    await fill(BOB, '1');
    expect(screen.getByText(/yeterli HEZ'in yok/)).toBeInTheDocument();
    expect(review()).toBeDisabled();
  });

  it('refuses an address of another network with its own message', async () => {
    const { encodeAddress, decodeAddress } = await import('@pezkuwi/util-crypto');
    renderSend(); await login();
    await user.type(screen.getByLabelText('Alıcı adresi'), encodeAddress(decodeAddress(BOB), 0));
    expect(screen.getByText(/başka bir ağa ait/)).toBeInTheDocument();
    expect(review()).toBeDisabled();
  });

  it('shows what the typed amount means, so "1.000" reads as 1', async () => {
    renderSend(); await login();
    await user.type(amountField(), '1.000');
    expect(screen.getByText('= 1 HEZ')).toBeInTheDocument();
    await user.type(amountField(), '1.000,5');
    expect(screen.getByText('Geçerli bir tutar yaz.')).toBeInTheDocument();
  });

  it('step 1 lists HEZ, PEZ and USDT; PEZ and USDT skip the network step and send on Asset Hub', async () => {
    renderSend(); await unlockOnly();
    const tokens = await screen.findByRole('region', { name: 'Varlık' });
    expect(within(tokens).getAllByRole('button').map((b) => b.textContent)).toEqual(['HEZPezkuwiChain', 'PEZAsset Hub', 'USDTAsset Hub (PEZ-20)']);
    await user.click(screen.getByRole('button', { name: /^USDT/ }));
    expect(await screen.findByLabelText('Alıcı adresi')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Ağ' })).toBeNull();
    expect(document.querySelector('.iw-sendon')).toHaveTextContent(/^USDT Asset Hub/);
    expect(impl.balanceReads).toEqual(['assetHub']);
    await waitFor(() => expect(impl.apiChains).toContain('assetHub'));
    expect(impl.apiChains.every((c) => c === 'assetHub')).toBe(true);
  });

  it('step 2 for HEZ lists the three networks with what can be sent there, zero included', async () => {
    impl.spendBy = { relay: 7n * T, assetHub: 5000n * T, people: 0n };
    renderSend(); await unlockOnly();
    await user.click(await screen.findByRole('button', { name: /^HEZ/ }));
    expect(await screen.findByText('HEZ göndermek için ağ seç')).toBeInTheDocument();
    const nets = screen.getByRole('region', { name: 'Ağ' });
    await waitFor(() => expect(within(nets).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'RelayKullanılabilir: 7 HEZ', 'Asset HubKullanılabilir: 5.000 HEZ', 'PeopleKullanılabilir: 0 HEZ',
    ]));
  });

  it('a network whose balance fails says so on its own row, with a retry, and the others stay selectable', async () => {
    impl.spendFail = ['people'];
    renderSend(); await unlockOnly();
    await user.click(await screen.findByRole('button', { name: /^HEZ/ }));
    const nets = await screen.findByRole('region', { name: 'Ağ' });
    const people = await within(nets).findByText(/Bu yüklenemedi/);
    expect(people.closest('li')).toHaveTextContent('People');
    expect(within(nets).getByRole('button', { name: /^Relay/ })).toBeEnabled();
    impl.spendFail = [];
    await user.click(within(nets).getByRole('button', { name: 'Tekrar dene' }));
    expect(await within(nets).findByRole('button', { name: /^People/ })).toBeInTheDocument();
  });

  it('sends HEZ on the relay with the relay connection, its fee and its existential deposit', async () => {
    impl.spendBy = { relay: 5n * T };
    impl.feeBy = { relay: 3_000_000_000n };
    renderSend(); await login('HEZ', 'relay');
    expect(document.querySelector('.iw-sendon')).toHaveTextContent(/^HEZ Relay/);
    expect(screen.getByText(/Kullanılabilir: 5 HEZ/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Alıcı adresi'), BOB);
    await settled();
    expect(screen.getByText(/Ağ ücreti: ~0,003/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'En çok' }));
    // fee 0.003 + 10% margin, then the relay's existential deposit (33333333), not Asset Hub's.
    const expected = 5n * T - 3_300_000_000n - 33_333_333n;
    await waitFor(() => expect((amountField() as HTMLInputElement).value).toBe(`4.${(expected % T).toString().padStart(12, '0').replace(/0+$/, '')}`));
    await settled();
    await user.click(review());
    expect((await screen.findByText('Ağ')).closest('dl')!).toHaveTextContent('AğRelay');
    await user.type(await screen.findByLabelText('Parola'), 'right-pass1');
    await user.click(screen.getByRole('button', { name: 'Gönder' }));
    expect(await screen.findByText('Gönderildi')).toBeInTheDocument();
    expect(impl.signed).toEqual([{ name: 'balances.transferKeepAlive', args: [BOB, expected] }]);
    expect(impl.signedOn).toEqual(['relay']);
    expect(impl.feeOn.every((c) => c === 'relay')).toBe(true);
    expect(impl.apiChains).not.toContain('assetHub');
    expect(screen.getByText('Ağ: Relay')).toBeInTheDocument();
    expect(await screen.findByText('88')).toBeInTheDocument(); // the record number comes from the relay
    expect(signPair().lock).toHaveBeenCalled();
  });

  it('sends HEZ on People with the People connection and its existential deposit', async () => {
    impl.spendBy = { people: 5n * T };
    renderSend(); await login('HEZ', 'people');
    await user.type(screen.getByLabelText('Alıcı adresi'), BOB);
    await settled();
    await user.click(screen.getByRole('button', { name: 'En çok' }));
    const expected = 5n * T - 2_200_000_000n - 3_333_333n;
    await waitFor(() => expect((amountField() as HTMLInputElement).value).not.toBe(''));
    await settled();
    await confirmWith('right-pass1');
    expect(await screen.findByText('Gönderildi')).toBeInTheDocument();
    expect(impl.signed).toEqual([{ name: 'balances.transferKeepAlive', args: [BOB, expected] }]);
    expect(impl.signedOn).toEqual(['people']);
    expect(screen.getByText('Ağ: People')).toBeInTheDocument();
  });

  it('decodes a failed transfer with the registry of the network it was sent on', async () => {
    impl.script = ['failed'];
    impl.metaErrBy = { relay: 'ExistentialDeposit' };
    impl.spendBy = { relay: 5n * T };
    renderSend(); await login('HEZ', 'relay');
    await fill(BOB, '1');
    await confirmWith('right-pass1');
    expect(await screen.findByText(/Tutar çok küçük/)).toBeInTheDocument();
  });

  it('keeps the 1000 HEZ acknowledgement on every network', async () => {
    renderSend(); await login('HEZ', 'people');
    await fill(BOB, '1001');
    expect(screen.getByText(/Bu tutar sıcak cüzdan için yüksek/)).toBeInTheDocument();
    expect(review()).toBeDisabled();
  });

  it('a deep link preselects the token and network; values it does not know are ignored', async () => {
    const first = renderSend('/i-wallet/send?token=HEZ&chain=people'); await unlockOnly();
    expect(await screen.findByLabelText('Alıcı adresi')).toBeInTheDocument();
    expect(document.querySelector('.iw-sendon')).toHaveTextContent(/^HEZ People/);
    await waitFor(() => expect(impl.apiChains).toEqual(['people']));
    first.unmount();
    const second = renderSend('/i-wallet/send?token=HEZ&chain=mars'); await unlockOnly();
    expect(await screen.findByText('HEZ göndermek için ağ seç')).toBeInTheDocument();
    second.unmount();
    const third = renderSend('/i-wallet/send?token=DOGE&chain=relay'); await unlockOnly();
    expect(await screen.findByRole('region', { name: 'Varlık' })).toBeInTheDocument();
    third.unmount();
    renderSend('/i-wallet/send?token=USDT&chain=relay'); await unlockOnly();
    expect(await screen.findByLabelText('Alıcı adresi')).toBeInTheDocument();
    expect(document.querySelector('.iw-sendon')).toHaveTextContent(/^USDT Asset Hub/);
  });

  it('an asset picked after choosing People for HEZ is still sent on Asset Hub', async () => {
    impl.spendBy = { people: 5n * T };
    renderSend(); await login('HEZ', 'people');
    await user.click(screen.getByRole('button', { name: 'Değiştir' }));
    await user.click(await screen.findByRole('button', { name: /^PEZ/ }));
    await screen.findByText(/Kullanılabilir: [^—]/);
    expect(document.querySelector('.iw-sendon')).toHaveTextContent(/^PEZ Asset Hub/);
    await fill(BOB, '1');
    await confirmWith('right-pass1');
    expect(await screen.findByText('Gönderildi')).toBeInTheDocument();
    expect(impl.signed).toEqual([{ name: 'assets.transfer', args: [1, BOB, T] }]);
    expect(impl.signedOn).toEqual(['assetHub']);
  });

  it('Change goes back to the token step', async () => {
    renderSend(); await login('HEZ', 'relay');
    await user.click(screen.getByRole('button', { name: 'Değiştir' }));
    expect(await screen.findByRole('region', { name: 'Varlık' })).toBeInTheDocument();
  });

  it('covers the screen with the Kurdistan sun while the key is opened for signing, then shows the result', async () => {
    renderSend(); await login();
    await fill(BOB, '1');
    let open: () => void = () => undefined;
    impl.unlockGate = new Promise<void>((r) => { open = r; });
    await confirmWith('right-pass1');
    const status = await screen.findByText('İmzalanıyor…', { selector: '.progress-message' });
    expect(status.closest('[role="status"]')).not.toBeNull();
    expect(impl.signed).toEqual([]);
    open();
    expect(await screen.findByText('Gönderildi')).toBeInTheDocument();
    expect(document.querySelector('.progress-overlay')).toBeNull();
    expect(impl.signed).toHaveLength(1);
  });
});
