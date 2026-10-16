import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
}));

vi.mock('../data', () => ({
  loadHezBalance: () => Promise.resolve({ total: impl.hezSpendable, perChain: { relay: 0n, assetHub: impl.hezSpendable, people: 0n }, assetHubSpendable: impl.hezSpendable }),
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
  return {
    ...real,
    loadKeystore: () => Promise.resolve({ address: ADDR, encoded: 'enc' }),
    unlock: (_json: unknown, pw: string) => {
      impl.unlockPw.push(pw);
      if (pw !== 'right-pass1') return Promise.reject(new real.WrongPasswordError());
      const pair = { address: ADDR, lock: vi.fn() };
      impl.pairs.push(pair);
      return Promise.resolve(pair);
    },
  };
});

const result = (kind: string) => {
  const base = { dispatchError: undefined as unknown, txHash: { toHex: () => '0xabc123' }, status: { isInBlock: false, isFinalized: false, isDropped: false, isInvalid: false, isUsurped: false } };
  if (kind === 'inBlock') return { ...base, status: { ...base.status, isInBlock: true, asInBlock: { toHex: () => '0xb1' } } };
  if (kind === 'finalized') return { ...base, status: { ...base.status, isFinalized: true, asFinalized: { toHex: () => '0xb2' } } };
  if (kind === 'dropped') return { ...base, status: { ...base.status, isDropped: true } };
  return { ...base, status: { ...base.status, isInBlock: true, asInBlock: { toHex: () => '0xb1' } }, dispatchError: { isModule: kind === 'failed', asModule: {} } };
};
const mkTx = (name: string, args: unknown[]) => ({
  paymentInfo: () => (impl.fee === 'fail' ? Promise.reject(new Error('rpc')) : Promise.resolve({ partialFee: { toBigInt: () => impl.fee } })),
  signAsync: vi.fn(() => { impl.signed.push({ name, args }); return Promise.resolve(); }),
  send: (cb: (r: unknown) => void) => {
    if (impl.sendRejects) return Promise.reject(new Error('ws closed'));
    impl.script.forEach((k) => cb(result(k)));
    return Promise.resolve(() => undefined);
  },
});
const stubApi = {
  tx: {
    balances: { transferKeepAlive: (...a: unknown[]) => mkTx('balances.transferKeepAlive', a) },
    assets: { transfer: (...a: unknown[]) => mkTx('assets.transfer', a) },
  },
  rpc: { chain: { getHeader: () => Promise.resolve({ number: { toNumber: () => 77 } }) } },
  registry: { findMetaError: () => ({ section: 'balances', name: 'InsufficientBalance' }) },
  on: vi.fn(), off: vi.fn(),
};
vi.mock('../chain', () => ({ getMainnetApi: () => Promise.resolve(stubApi) }));

let store: Map<string, unknown>;
const makeStore = (): KvStore => ({
  get: (k) => Promise.resolve(store.get(k)),
  set: (k, v) => { store.set(k, v); return Promise.resolve(); },
  delete: (k) => { store.delete(k); return Promise.resolve(); },
  deleteMany: (ks) => { ks.forEach((k) => store.delete(k)); return Promise.resolve(); },
  setMany: (e, rm = []) => { Object.entries(e).forEach(([k, v]) => store.set(k, v)); rm.forEach((k) => store.delete(k)); return Promise.resolve(); },
});

const renderSend = () => render(
  <MemoryRouter initialEntries={['/i-wallet/send']}>
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
const login = async () => {
  await user.type(await screen.findByLabelText('Parola'), 'right-pass1');
  await user.click(screen.getByRole('button', { name: 'Kilidi aç' }));
  await screen.findByLabelText('Alıcı adresi');
  // Wait for the balances so the screen is in its settled state.
  await screen.findByText(/Kullanılabilir: [^—]/);
};
const amountField = () => screen.getByLabelText('Tutar');
const review = () => screen.getByRole('button', { name: /Face ID ya da parolayla onayla/ });
const fill = async (to: string, amount: string) => {
  await user.type(screen.getByLabelText('Alıcı adresi'), to);
  await user.type(amountField(), amount);
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
    Object.assign(impl, { hezSpendable: 5000n * T, assets: { 1: 20n * T, 1000: 9_000_000_000n }, fee: 2_000_000_000n, script: ['inBlock', 'finalized'], sendRejects: false, faceOn: false, face: null, scanned: null, scanFails: false });
    impl.signed = []; impl.pairs = []; impl.unlockPw = [];
  });

  it('gates HEZ above 1000 behind the orange alert and its checkbox, and only then enables confirm', async () => {
    renderSend(); await login();
    await fill(BOB, '1000');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(review()).toBeEnabled();
    await user.type(amountField(), '1000.000000000001');
    expect(screen.getByText(/Bu tutar sıcak cüzdan için yüksek/)).toBeInTheDocument();
    expect(review()).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /Anladım, yine de göndereceğim/ }));
    expect(review()).toBeEnabled();
    // Editing the amount asks for the acknowledgement again.
    await user.type(amountField(), '1001');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(review()).toBeDisabled();
  });

  it('never gates USDT, even 5000', async () => {
    renderSend(); await login();
    await user.click(screen.getByRole('button', { name: 'USDT' }));
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
    expect((amountField() as HTMLInputElement).value).toBe('4.997996666667');
  });

  it('Max for USDT is the whole balance, without waiting for a fee', async () => {
    renderSend(); await login();
    await user.click(screen.getByRole('button', { name: 'USDT' }));
    await user.click(screen.getByRole('button', { name: 'En çok' }));
    expect((amountField() as HTMLInputElement).value).toBe('9000');
  });

  it('shows the fee from paymentInfo, or a dash when it is unavailable', async () => {
    renderSend(); await login();
    await fill(BOB, '1');
    expect(await screen.findByText(/Ağ ücreti: ~0,002/, undefined, { timeout: 3000 })).toBeInTheDocument();
  });

  it('keeps confirm enabled without a fee as long as the amount fits the balance', async () => {
    impl.fee = 'fail';
    renderSend(); await login();
    await fill(BOB, '1');
    expect(screen.getByText('Ağ ücreti: —')).toBeInTheDocument();
    expect(review()).toBeEnabled();
    await user.type(amountField(), '6000');
    expect(screen.getByText('Bu, gönderebileceğinden fazla.')).toBeInTheDocument();
    expect(review()).toBeDisabled();
  });

  it('rejects zero, a bad amount, too many decimals and a bad address', async () => {
    renderSend(); await login();
    await fill(BOB, '0');
    expect(review()).toBeDisabled();
    await user.type(amountField(), 'abc');
    expect(screen.getByText('Geçerli bir tutar yaz.')).toBeInTheDocument();
    await user.type(amountField(), '1,0000000000001');
    expect(screen.getByText(/en fazla 12 ondalık basamak/)).toBeInTheDocument();
    await user.type(amountField(), '1,5');
    expect(review()).toBeEnabled();
    await user.type(screen.getByLabelText('Alıcı adresi'), BOB.slice(0, -1) + 'x');
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
    renderSend(); await login();
    await user.click(screen.getByRole('button', { name: 'PEZ' }));
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
    expect(screen.getByRole('button', { name: 'İşlem kimliğini kopyala' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /payment/i })).toBeNull();
  });

  it('sends USDT as asset 1000 with 6 decimals', async () => {
    renderSend(); await login();
    await user.click(screen.getByRole('button', { name: 'USDT' }));
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
    expect(await screen.findByText(/Bloğa girdi/)).toBeInTheDocument();
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
    await screen.findByText(/İmzalanıyor/);
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
    await screen.findByText(/Bloğa girdi/);
    const onDisconnect = stubApi.on.mock.calls.find((c) => c[0] === 'disconnected')![1] as () => void;
    onDisconnect();
    expect(await screen.findByText(/yine de tamamlanabilir/)).toBeInTheDocument();
  });

  it('reports a transaction the network dropped as not sent', async () => {
    impl.script = ['dropped'];
    renderSend(); await login();
    await fill(BOB, '1');
    await confirmWith('right-pass1');
    expect(await screen.findByText(/Hiçbir şey gönderilmedi/)).toBeInTheDocument();
  });
});
