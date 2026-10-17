import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { decodeAddress, encodeAddress } from '@pezkuwi/util-crypto';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { user } from '../test-user';
import i18n from '../../i18n';
import { IWalletProvider } from '../IWalletContext';
import IWalletShell, { IWalletIndex } from '../IWalletRoutes';
import { FUNDING_POLL, identityHash, loadForm, type CitizenForm } from '../citizen';
import Citizen from './Citizen';
import { shortAddress } from '../../lib/address';
import type { KvStore } from '../idb';

const ADDR = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const BOB = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const T = 10n ** 12n;
const DEPOSIT = 1n * T;
const FEE = 10_000_000n;
const ED = 3_333_333n;
const REF_EXTRA = 1_066_656n;

const impl = vi.hoisted(() => ({
  status: 'NotStarted', nft: null as bigint | null, people: 0n, peopleAfter: [] as bigint[], assetHub: 0n,
  apps: [] as Array<{ applicant: string; referrer: string; status: string }>,
  // Completed referrals (referral.referrals) with the referred account's status and NFT.
  refs: [] as Array<{ referred: string; referrer: string; createdAt: number; status: string; nft: bigint | null }>,
  // One referral read that rejects, and a gate that holds referral.referrals back until opened.
  fail: null as null | 'refs' | 'apps' | 'kycMulti' | 'nftMulti', refsGate: null as null | Promise<void>,
  script: ['inBlock', 'finalized'] as string[], dropAfterSend: false, scans: 0, feeFail: false,
  signed: [] as Array<{ name: string; args: unknown[] }>, pairs: [] as Array<{ lock: ReturnType<typeof vi.fn> }>,
}));

vi.mock('../faceid', () => ({
  hasFaceId: () => Promise.resolve(false), unlockWithFaceId: () => Promise.resolve(null),
  faceIdSupported: () => Promise.resolve(false), enrolFaceId: vi.fn(), forgetFaceId: () => Promise.resolve(true),
}));
vi.mock('../keystore', async (orig) => {
  const real = await orig<typeof import('../keystore')>();
  const unlock = (_json: unknown, pw: string) => {
    if (pw !== 'right-pass1') return Promise.reject(new real.WrongPasswordError());
    const pair = { address: ADDR, lock: vi.fn() };
    impl.pairs.push(pair);
    return Promise.resolve(pair);
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
  const base = { events: [{ event: { section: 'system', method: 'ExtrinsicSuccess' } }], internalError: undefined as unknown, dispatchError: undefined as unknown, txHash: { toHex: () => '0xabc123' }, status: { isInBlock: false, isFinalized: false, isDropped: false, isInvalid: false, isUsurped: false } };
  if (kind === 'inBlock') return { ...base, status: { ...base.status, isInBlock: true, asInBlock: { toHex: () => '0xb1' } } };
  if (kind === 'finalized') return { ...base, status: { ...base.status, isFinalized: true, asFinalized: { toHex: () => '0xb2' } } };
  return { ...base, status: { ...base.status, isInBlock: true, asInBlock: { toHex: () => '0xb1' } }, dispatchError: { isModule: true, asModule: {} } };
};
const mkTx = (name: string, args: unknown[]) => ({
  // An apply with Some(referrer) is 32 bytes longer and costs REF_EXTRA more, as measured on mainnet.
  paymentInfo: () => impl.feeFail ? Promise.reject(new Error('rpc')) : Promise.resolve({ partialFee: { toBigInt: () => (name === 'identityKyc.applyForCitizenship' && args[1] !== null ? FEE + REF_EXTRA : FEE) } }),
  signAsync: vi.fn(() => { impl.signed.push({ name, args }); return Promise.resolve(); }),
  send: (cb: (r: unknown) => void) => {
    // A dropped connection after the hand-off: the node may already hold the extrinsic.
    if (impl.dropAfterSend) return Promise.reject(new Error('ws closed'));
    impl.script.forEach((k) => cb(result(k)));
    return Promise.resolve(() => undefined);
  },
});
const statusOf = (a: string) => (a === ADDR ? impl.status
  : impl.apps.find((x) => x.applicant === a)?.status ?? impl.refs.find((x) => x.referred === a)?.status ?? 'NotStarted');
const nftOf = (a: string) => (a === ADDR ? impl.nft : impl.refs.find((x) => x.referred === a)?.nft ?? null);
const opt = (v: bigint | null) => ({ isSome: v !== null, unwrap: () => ({ toBigInt: () => v }) });
const account = (free: () => bigint) => () => Promise.resolve({ data: { free: { toBigInt: free }, reserved: { toBigInt: () => 0n }, frozen: { toBigInt: () => 0n } } });
const tx = (name: string) => (...a: unknown[]) => mkTx(name, a);
const people = {
  query: {
    system: { account: account(() => (impl.peopleAfter.length ? impl.peopleAfter.shift()! : impl.people)) },
    identityKyc: {
      kycStatuses: Object.assign((a: string) => Promise.resolve({ type: statusOf(a) }), {
        multi: (as: string[]) => (impl.fail === 'kycMulti' ? Promise.reject(new Error('rpc')) : Promise.resolve(as.map((a) => ({ type: statusOf(a) })))),
      }),
      applications: { entries: () => { impl.scans += 1; if (impl.fail === 'apps') return Promise.reject(new Error('rpc')); return Promise.resolve(impl.apps.map((x) => [
        { args: [{ toString: () => x.applicant }] },
        { isSome: true, unwrap: () => ({ identityHash: { toString: () => '0xh' }, referrer: { toString: () => x.referrer } }) },
      ])); } },
    },
    referral: { referrals: { entries: async () => {
      if (impl.refsGate) await impl.refsGate;
      if (impl.fail === 'refs') throw new Error('rpc');
      return impl.refs.map((x) => [
        { args: [{ toString: () => x.referred }] },
        { isSome: true, unwrap: () => ({ referrer: { toString: () => x.referrer }, createdAt: { toNumber: () => x.createdAt } }) },
      ]);
    } } },
    tiki: { citizenNft: Object.assign((a: string) => Promise.resolve(opt(nftOf(a))), { multi: (as: string[]) => (impl.fail === 'nftMulti' ? Promise.reject(new Error('rpc')) : Promise.resolve(as.map((a) => opt(nftOf(a))))) }) },
  },
  consts: { identityKyc: { kycApplicationDeposit: { toBigInt: () => DEPOSIT } } },
  tx: {
    identityKyc: {
      applyForCitizenship: tx('identityKyc.applyForCitizenship'), approveReferral: tx('identityKyc.approveReferral'),
      confirmCitizenship: tx('identityKyc.confirmCitizenship'), cancelApplication: tx('identityKyc.cancelApplication'),
    },
  },
  registry: { findMetaError: () => ({ section: 'identityKyc', name: 'ReferrerNotCitizen' }) },
  on: vi.fn(), off: vi.fn(),
};
const assetHub = {
  query: { system: { account: account(() => impl.assetHub) } },
  tx: { pezkuwiXcm: { limitedTeleportAssets: tx('pezkuwiXcm.limitedTeleportAssets') } },
  registry: people.registry, on: vi.fn(), off: vi.fn(),
};
vi.mock('../chain', () => ({ getMainnetApi: (c: string) => Promise.resolve(c === 'people' ? people : assetHub), networkChanged: () => false, subscribeNetworkChanged: () => () => undefined }));

let store: Map<string, unknown>;
const makeStore = (): KvStore => ({
  get: (k) => Promise.resolve(store.get(k)),
  set: (k, v) => { store.set(k, v); return Promise.resolve(); },
  delete: (k) => { store.delete(k); return Promise.resolve(); },
  deleteMany: (ks) => { ks.forEach((k) => store.delete(k)); return Promise.resolve(); },
  setMany: (e, rm = []) => { Object.entries(e).forEach(([k, v]) => store.set(k, v)); rm.forEach((k) => store.delete(k)); return Promise.resolve(); },
});

const renderCitizen = (url = '/i-wallet/citizen') => render(
  <MemoryRouter initialEntries={[url]}>
    <IWalletProvider store={makeStore()}>
      <Routes>
        <Route path="i-wallet" element={<IWalletShell />}>
          <Route index element={<IWalletIndex />} />
          <Route path="citizen" element={<Citizen />} />
        </Route>
      </Routes>
    </IWalletProvider>
  </MemoryRouter>,
);
const login = async () => {
  await user.type(await screen.findByLabelText('Parola'), 'right-pass1');
  await user.click(screen.getByRole('button', { name: 'Kilidi aç' }));
};
const FORM: Partial<CitizenForm> = { fullName: 'Berzê Ronahî' };
const seedForm = (f: Partial<CitizenForm>) => localStorage.setItem(`pezkuwi-explorer:iwallet-citizen:${ADDR}`, JSON.stringify(f));
const fundTitle = 'HEZ\'i vatandaşlık zincirine taşı';
const applyBtn = () => screen.getByRole('button', { name: 'Başvuruyu Gönder' });
const signWith = async (pw: string) => {
  await user.type(await screen.findByLabelText('Parola'), pw);
  await user.click(screen.getByRole('button', { name: 'İmzala ve gönder' }));
  // The key is opened behind the progress overlay; signing follows once it is gone.
  await waitFor(() => expect(document.querySelector('.progress-overlay')).toBeNull());
};
const lastPair = () => impl.pairs[impl.pairs.length - 1];

describe('i-Wallet citizenship', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('tr');
    localStorage.clear(); sessionStorage.clear();
    store = new Map<string, unknown>([['keystore', {}], ['words', {}]]);
    Object.assign(impl, { status: 'NotStarted', nft: null, people: 0n, peopleAfter: [], assetHub: 10n * T, apps: [], refs: [], fail: null, refsGate: null, script: ['inBlock', 'finalized'], dropAfterSend: false, scans: 0, feeFail: false });
    impl.signed = []; impl.pairs = [];
    Object.assign(FUNDING_POLL, { everyMs: 20, forMs: 2_000 });
  });
  afterEach(() => { Object.assign(FUNDING_POLL, { everyMs: 6_000, forMs: 120_000 }); });

  it('offers the teleport card below deposit + fee + ED and hides it at that amount', async () => {
    impl.people = DEPOSIT + FEE + ED - 1n;
    const first = renderCitizen(); await login();
    expect(await screen.findByRole('heading', { name: fundTitle })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1,5 HEZ taşı/ })).toBeEnabled();
    seedForm(FORM);
    first.unmount();

    impl.people = DEPOSIT + FEE + ED;
    renderCitizen(); await login();
    await screen.findByRole('button', { name: 'Başvuruyu Gönder' });
    expect(screen.queryByRole('heading', { name: fundTitle })).toBeNull();
  });

  it('disables the teleport when Asset Hub cannot cover it', async () => {
    impl.assetHub = DEPOSIT;
    renderCitizen(); await login();
    expect(await screen.findByText(/Asset Hub'da yeterli HEZ yok/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1,5 HEZ taşı/ })).toBeDisabled();
  });

  it('teleports deposit + 0.5 HEZ, then polls People and enables Apply without a reload', async () => {
    seedForm(FORM);
    renderCitizen(); await login();
    await user.click(await screen.findByRole('checkbox'));
    expect(applyBtn()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /1,5 HEZ taşı/ }));
    expect(screen.getByText('Pezkuwi Asset Hub')).toBeInTheDocument();
    await signWith('right-pass1');
    expect(impl.signed).toHaveLength(1);
    expect(impl.signed[0].name).toBe('pezkuwiXcm.limitedTeleportAssets');
    expect((impl.signed[0].args[2] as { V5: Array<{ fun: { Fungible: bigint } }> }).V5[0].fun.Fungible).toBe(DEPOSIT + 500_000_000_000n);
    expect(lastPair().lock).toHaveBeenCalled();
    // Two polls still see nothing, the third sees the HEZ land.
    impl.peopleAfter = [0n, 0n, 0n, DEPOSIT + T / 2n];
    impl.people = DEPOSIT + T / 2n;
    await user.click(await screen.findByRole('button', { name: 'Vatandaşlığa dön' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: fundTitle })).toBeNull());
    expect(applyBtn()).toBeEnabled();
  });

  it('says the HEZ is late after the polling window, and checks again on request', async () => {
    renderCitizen(); await login();
    await user.click(await screen.findByRole('button', { name: /1,5 HEZ taşı/ }));
    await signWith('right-pass1');
    await user.click(await screen.findByRole('button', { name: 'Vatandaşlığa dön' }));
    expect(await screen.findByText('HEZ\'in vatandaşlık zincirine ulaşması bekleniyor…')).toBeInTheDocument();
    expect(await screen.findByText(/HEZ henüz ulaşmadı/, {}, { timeout: 4_000 })).toBeInTheDocument();
    impl.people = 2n * T;
    await user.click(screen.getByRole('button', { name: 'Tekrar kontrol et' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: fundTitle })).toBeNull());
  });

  it('applies with the name hash and the ?ref= referrer, keeping the form only in localStorage', async () => {
    impl.people = 2n * T;
    seedForm(FORM);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderCitizen(`/i-wallet/citizen?ref=${BOB}`);
    await login();
    expect(await screen.findByDisplayValue(BOB)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox'));
    await user.click(applyBtn());
    expect(screen.getByText(BOB)).toBeInTheDocument();
    await signWith('right-pass1');
    expect(await screen.findByText('Başvuru gönderildi')).toBeInTheDocument();
    const form = loadForm(ADDR);
    expect(impl.signed).toEqual([{ name: 'identityKyc.applyForCitizenship', args: [identityHash(form, ADDR), BOB] }]);
    expect(lastPair().lock).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('sends None as referrer when the field is empty, and blocks an invalid referrer inline', async () => {
    impl.people = 2n * T;
    seedForm({ ...FORM, referrer: 'not-an-address' });
    renderCitizen(); await login();
    await user.click(await screen.findByRole('checkbox'));
    expect(screen.getByText(/Bu geçerli bir adres değil/)).toBeInTheDocument();
    expect(applyBtn()).toBeDisabled();
    await user.clear(screen.getByLabelText('Referans adresi (isteğe bağlı)'));
    expect(applyBtn()).toBeEnabled();
    await user.click(applyBtn());
    expect(screen.getByText('Varsayılan (Kurucu)')).toBeInTheDocument();
    await signWith('right-pass1');
    await screen.findByText('Başvuru gönderildi');
    expect(impl.signed[0].args[1]).toBeNull();
  });

  it('keeps a ?ref= that arrived on /i-wallet (the short address) for the citizenship form', async () => {
    impl.people = 2n * T;
    seedForm(FORM);
    renderCitizen(`/i-wallet?ref=${BOB}`);
    await screen.findByLabelText('Parola');
    expect(sessionStorage.getItem('pezkuwi-explorer:iwallet-ref')).toBe(BOB);
    cleanup();
    renderCitizen(); await login();
    expect(await screen.findByLabelText('Referans adresi (isteğe bağlı)')).toHaveValue(BOB);
  });

  it('refuses a referrer of another network (mainnet prefix 42 only, like a Send recipient)', async () => {
    impl.people = 2n * T;
    seedForm({ ...FORM, referrer: encodeAddress(decodeAddress(BOB), 2) });
    renderCitizen(); await login();
    await user.click(await screen.findByRole('checkbox'));
    expect(screen.getByText(/Bu geçerli bir adres değil/)).toBeInTheDocument();
    expect(applyBtn()).toBeDisabled();
  });

  it('a teleport still landing survives leaving the screen: waiting, never the teleport button, until 5 min pass', async () => {
    seedForm(FORM);
    const first = renderCitizen(); await login();
    await user.click(await screen.findByRole('button', { name: /1,5 HEZ taşı/ }));
    await signWith('right-pass1');
    await user.click(await screen.findByRole('button', { name: 'Vatandaşlığa dön' }));
    first.unmount();
    renderCitizen(); await login();
    await screen.findByRole('heading', { name: fundTitle });
    expect(screen.queryByRole('button', { name: /1,5 HEZ taşı/ })).toBeNull();
    cleanup();
    // Older than the guard: a teleport that never arrived may be sent again.
    sessionStorage.setItem(`pezkuwi-explorer:iwallet-teleport:${ADDR}`, String(Date.now() - 5 * 60_000 - 1));
    renderCitizen(); await login();
    expect(await screen.findByRole('button', { name: /1,5 HEZ taşı/ })).toBeInTheDocument();
  });

  it('does not sign without a name', async () => {
    impl.people = 2n * T;
    renderCitizen(); await login();
    await user.click(await screen.findByRole('checkbox'));
    await user.click(applyBtn());
    expect(screen.getByText('Gerekli')).toBeInTheDocument();
    expect(screen.queryByLabelText('Parola')).toBeNull();
    expect(impl.signed).toEqual([]);
  });

  it('asks only for the full name and the optional referrer', async () => {
    impl.people = 2n * T;
    renderCitizen(); await login();
    await screen.findByRole('button', { name: 'Başvuruyu Gönder' });
    const form = document.querySelector('form.iw-form')!;
    const fields = [...form.querySelectorAll('input, select, textarea')].filter((el) => (el as HTMLInputElement).type !== 'checkbox');
    expect(fields).toHaveLength(2);
    expect(screen.getByLabelText('Tam Adın')).toBe(fields[0]);
    expect(screen.getByLabelText('Referans adresi (isteğe bağlı)')).toBe(fields[1]);
    // The deposit notice and the privacy text are still there.
    expect(screen.getByText('1 HEZ depozito gerekli')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('iwallet.citizen.form.privacy'))).toBeInTheDocument();
  });

  it('keeps a wrong password on the confirm screen', async () => {
    impl.people = 2n * T; impl.status = 'ReferrerApproved';
    renderCitizen(); await login();
    await user.click(await screen.findByRole('button', { name: 'Vatandaşlığı Onayla' }));
    await signWith('wrong');
    expect(await screen.findByText('Parola yanlış. Tekrar dene.')).toBeInTheDocument();
    expect(impl.signed).toEqual([]);
  });

  it('shows waiting + cancel for PendingReferral and signs cancelApplication', async () => {
    impl.people = T; impl.status = 'PendingReferral';
    renderCitizen(); await login();
    expect(await screen.findByRole('heading', { name: 'Referansının onayı bekleniyor' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: fundTitle })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Başvuruyu Gönder' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Başvuruyu İptal Et' }));
    await signWith('right-pass1');
    expect(await screen.findByText('Başvuru iptal edildi')).toBeInTheDocument();
    expect(impl.signed).toEqual([{ name: 'identityKyc.cancelApplication', args: [] }]);
  });

  it('asks for the signature for ReferrerApproved and confirms', async () => {
    impl.people = T; impl.status = 'ReferrerApproved';
    renderCitizen(); await login();
    expect(await screen.findByRole('heading', { name: 'Referansın onayladı' })).toBeInTheDocument();
    expect(screen.getByText('Vatandaşlık sürecini tamamlamak için imzan gerekiyor.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Başvuruyu Gönder' })).toBeNull();
    await user.click(await screen.findByRole('button', { name: 'Vatandaşlığı Onayla' }));
    await signWith('right-pass1');
    expect(await screen.findByText('Vatandaşlık onaylandı')).toBeInTheDocument();
    expect(impl.signed).toEqual([{ name: 'identityKyc.confirmCitizenship', args: [] }]);
  });

  it('shows a chain error in words', async () => {
    impl.people = T; impl.status = 'ReferrerApproved'; impl.script = ['failed'];
    renderCitizen(); await login();
    await user.click(await screen.findByRole('button', { name: 'Vatandaşlığı Onayla' }));
    await signWith('right-pass1');
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('iwallet.err.identityKyc.ReferrerNotCitizen'));
  });

  it('shows the citizen card for Approved with an NFT, with the name kept on this device', async () => {
    impl.status = 'Approved'; impl.nft = 7n;
    seedForm(FORM);
    renderCitizen(); await login();
    expect(await screen.findByRole('heading', { name: 'Vatandaşsın' })).toBeInTheDocument();
    expect(screen.getByText('Berzê Ronahî')).toBeInTheDocument();
    expect(screen.getByText('Welati Tiki NFT #7')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Başvuruyu Gönder' })).toBeNull();
  });

  for (const status of ['NotStarted', 'PendingReferral', 'ReferrerApproved']) {
    it(`shows the citizen card, never the form, for an NFT holder whose status reads ${status}`, async () => {
      impl.status = status; impl.nft = 9n; impl.people = 2n * T;
      renderCitizen(); await login();
      expect(await screen.findByRole('heading', { name: 'Vatandaşsın' })).toBeInTheDocument();
      expect(screen.getByText('Welati Tiki NFT #9')).toBeInTheDocument();
      expect(document.querySelector('form.iw-form')).toBeNull();
      for (const name of ['Başvuruyu Gönder', 'Başvuruyu İptal Et', 'Vatandaşlığı Onayla']) expect(screen.queryByRole('button', { name })).toBeNull();
      expect(screen.queryByText('Bu hesabın vatandaşlığı iptal edildi.')).toBeNull();
    });
  }

  it('shows revoked, not the citizen card, when the citizenship was revoked but an NFT is left', async () => {
    impl.status = 'Revoked'; impl.nft = 9n; impl.people = 2n * T;
    renderCitizen(); await login();
    expect(await screen.findByText('Bu hesabın vatandaşlığı iptal edildi.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Vatandaşsın' })).toBeNull();
    expect(document.querySelector('form.iw-form')).toBeNull();
  });

  for (const status of ['NotStarted', 'Revoked']) {
    it(`does not scan or offer referral approvals for an NFT holder whose status reads ${status} (the chain needs Approved)`, async () => {
      impl.status = status; impl.nft = 4n; impl.people = T;
      impl.apps = [{ applicant: BOB, referrer: ADDR, status: 'PendingReferral' }];
      renderCitizen(); await login();
      if (status === 'Revoked') await screen.findByText('Bu hesabın vatandaşlığı iptal edildi.');
      else await screen.findByRole('heading', { name: 'Vatandaşsın' });
      expect(impl.scans).toBe(0);
      expect(screen.queryByText('Referansı olduğun cüzdanlar')).toBeNull();
      expect(screen.queryByRole('button', { name: `${BOB} onayla` })).toBeNull();
    });
  }

  it('makes one salt per application: kept across re-renders and remounts and used in the signed hash', async () => {
    impl.people = 2n * T;
    seedForm(FORM);
    const first = renderCitizen(); await login();
    await screen.findByRole('button', { name: 'Başvuruyu Gönder' });
    expect(screen.getByLabelText('Tam Adın')).toHaveValue('Berzê Ronahî');
    const salt = loadForm(ADDR).salt;
    expect(salt).toMatch(/^0x[0-9a-f]{64}$/);
    await user.clear(screen.getByLabelText('Tam Adın'));
    await user.type(screen.getByLabelText('Tam Adın'), 'Rojîn Welat');
    expect(loadForm(ADDR).salt).toBe(salt);
    first.unmount();
    renderCitizen(); await login();
    expect(await screen.findByLabelText('Tam Adın')).toHaveValue('Rojîn Welat');
    expect(loadForm(ADDR).salt).toBe(salt);
    await user.click(screen.getByRole('checkbox'));
    await user.click(applyBtn());
    await signWith('right-pass1');
    await screen.findByText('Başvuru gönderildi');
    expect(impl.signed[0].args[0]).toBe(identityHash({ fullName: 'Rojîn Welat', referrer: '', salt }, ADDR));
  });

  it('shows the citizen number shared with pwap and the exchange', async () => {
    impl.status = 'Approved'; impl.nft = 97n; impl.people = 2n * T;
    renderCitizen(); await login();
    expect(await screen.findByRole('heading', { name: 'Vatandaşsın' })).toBeInTheDocument();
    expect(screen.getByText(/^#42-97-\d{6}$/)).toBeInTheDocument();
  });

  it('says approved without an NFT when the NFT is missing', async () => {
    impl.status = 'Approved'; impl.nft = null;
    renderCitizen(); await login();
    expect(await screen.findByText(i18n.t('iwallet.citizen.approvedNoNft'))).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Vatandaşsın' })).toBeNull();
  });

  it('turns an unknown status variant into a load error', async () => {
    impl.status = 'Suspended';
    renderCitizen(); await login();
    expect(await screen.findByText('Vatandaşlık durumun yüklenemedi.')).toBeInTheDocument();
  });

  it('blocks signing while the fee estimate fails, and signs after a successful retry', async () => {
    impl.status = 'Approved'; impl.nft = 1n; impl.people = T;
    impl.apps = [{ applicant: BOB, referrer: ADDR, status: 'PendingReferral' }];
    impl.feeFail = true;
    renderCitizen(); await login();
    await user.click(await screen.findByRole('button', { name: `${BOB} onayla` }));
    expect(await screen.findByText(/Ağ ücreti hesaplanamadı/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Parola'), 'right-pass1');
    expect(screen.getByRole('button', { name: 'İmzala ve gönder' })).toBeDisabled();
    expect(impl.signed).toHaveLength(0);
    impl.feeFail = false;
    await user.click(screen.getByRole('button', { name: 'Tekrar dene' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'İmzala ve gönder' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'İmzala ve gönder' }));
    expect(await screen.findByText('Referans onaylandı')).toBeInTheDocument();
  });

  it('lists referrals waiting for this account and approves one', async () => {
    impl.status = 'Approved'; impl.nft = 1n; impl.people = T;
    impl.apps = [
      { applicant: BOB, referrer: ADDR, status: 'PendingReferral' },
      { applicant: '5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y', referrer: ADDR, status: 'ReferrerApproved' },
    ];
    renderCitizen(); await login();
    expect(await screen.findByText('Referansı olduğun cüzdanlar')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: /onayla$/ });
    expect(buttons).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: `${BOB} onayla` }));
    await signWith('right-pass1');
    expect(await screen.findByText('Referans onaylandı')).toBeInTheDocument();
    expect(impl.signed).toEqual([{ name: 'identityKyc.approveReferral', args: [BOB] }]);
  });
  it('keeps polling after a teleport whose outcome is unknown, and never offers a second teleport', async () => {
    impl.dropAfterSend = true;
    renderCitizen(); await login();
    await user.click(await screen.findByRole('button', { name: /1,5 HEZ taşı/ }));
    await signWith('right-pass1');
    expect(impl.signed.map((x) => x.name)).toEqual(['pezkuwiXcm.limitedTeleportAssets']);
    await user.click(await screen.findByRole('button', { name: 'Vatandaşlığa dön' }));
    expect(await screen.findByText('HEZ\'in vatandaşlık zincirine ulaşması bekleniyor…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /1,5 HEZ taşı/ })).toBeNull();
    // When the window ends without funds: "check again", still no teleport button.
    expect(await screen.findByRole('button', { name: 'Tekrar kontrol et' }, { timeout: 4_000 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /1,5 HEZ taşı/ })).toBeNull();
  });

  it('offers the teleport again only after a proven failure', async () => {
    impl.script = ['failed'];
    renderCitizen(); await login();
    await user.click(await screen.findByRole('button', { name: /1,5 HEZ taşı/ }));
    await signWith('right-pass1');
    await user.click(await screen.findByRole('button', { name: 'Vatandaşlığa dön' }));
    expect(await screen.findByRole('button', { name: /1,5 HEZ taşı/ })).toBeEnabled();
    expect(screen.queryByText(/ulaşması bekleniyor/)).toBeNull();
  });

  it('shows the recipient (own account) and the destination chain on the teleport confirm', async () => {
    renderCitizen(); await login();
    await user.click(await screen.findByRole('button', { name: /1,5 HEZ taşı/ }));
    expect(screen.getByText('Alıcı (kendi hesabın)')).toBeInTheDocument();
    expect(screen.getByText(shortAddress(ADDR))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adresini kopyala' })).toBeInTheDocument();
    expect(screen.getByText('Pezkuwi People (vatandaşlık)')).toBeInTheDocument();
  });

  it('keeps a delivery-fee allowance on Asset Hub', async () => {
    // Exactly amount + tx fee + ED, without the allowance: not enough.
    impl.assetHub = DEPOSIT + T / 2n + FEE + ED;
    renderCitizen(); await login();
    expect(await screen.findByRole('button', { name: /1,5 HEZ taşı/ })).toBeDisabled();
  });

  it('prices the apply fee with the referrer when one is entered', async () => {
    impl.people = DEPOSIT + FEE + ED; // enough without a referrer, REF_EXTRA short with one
    seedForm(FORM);
    renderCitizen(); await login();
    await screen.findByRole('button', { name: 'Başvuruyu Gönder' });
    expect(screen.queryByRole('heading', { name: fundTitle })).toBeNull();
    await user.type(screen.getByLabelText('Referans adresi (isteğe bağlı)'), BOB);
    expect(screen.getByRole('heading', { name: fundTitle })).toBeInTheDocument();
  });

  it('does not scan referrals unless this account is an Approved citizen, and scans once per page view', async () => {
    impl.apps = [{ applicant: BOB, referrer: ADDR, status: 'PendingReferral' }];
    impl.people = T; impl.status = 'PendingReferral';
    const first = renderCitizen(); await login();
    await screen.findByRole('heading', { name: 'Referansının onayı bekleniyor' });
    expect(impl.scans).toBe(0);
    expect(screen.queryByText('Referansı olduğun cüzdanlar')).toBeNull();
    first.unmount();

    impl.status = 'Approved'; impl.nft = 3n;
    renderCitizen(); await login();
    await screen.findByText('Referansı olduğun cüzdanlar');
    expect(impl.scans).toBe(1);
  });

  describe('wallets you referred', () => {
    const CAROL = '5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y';
    const DAVE = '5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy';
    const EVE = '5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw';
    const FERDIE = '5CiPPseXPECbkjWCa6MnjNokrgYjMqmKndv2rSnekmSK2DjL';
    const OTHER = '5GNJqTPyNqANBkUVMN1LPPrxXnFouWXoe2wNSmmEoLctxiZY';
    const section = async () => (await screen.findByRole('heading', { name: 'Referansı olduğun cüzdanlar' })).closest('section')!;
    const rows = (sec: HTMLElement) => within(sec).getAllByRole('listitem');
    const seed = () => {
      impl.status = 'Approved'; impl.nft = 1n; impl.people = T;
      impl.apps = [
        { applicant: CAROL, referrer: ADDR, status: 'ReferrerApproved' },
        { applicant: BOB, referrer: ADDR, status: 'PendingReferral' },
        { applicant: OTHER, referrer: BOB, status: 'PendingReferral' }, // names someone else
      ];
      impl.refs = [
        // BOB renounced and applies again naming this account: the open application wins (one row, with Approve).
        { referred: BOB, referrer: ADDR, createdAt: 9_000, status: 'Approved', nft: null },
        // OTHER renounced and applies again under another referrer: no longer a citizen.
        { referred: OTHER, referrer: ADDR, createdAt: 40_000, status: 'Approved', nft: null },
        { referred: DAVE, referrer: ADDR, createdAt: 14_905, status: 'Approved', nft: 12n },
        { referred: EVE, referrer: ADDR, createdAt: 30_000, status: 'Revoked', nft: 13n },
        { referred: FERDIE, referrer: ADDR, createdAt: 20_000, status: 'Approved', nft: null },
      ];
    };

    it('lists every wallet this citizen referred by its current status: waiting for me, their signature, citizens newest first, left, revoked', async () => {
      seed();
      renderCitizen(); await login();
      const sec = await section();
      expect(within(sec).getByText('Toplam: 6')).toBeInTheDocument();
      const list = rows(sec);
      expect(list.map((li) => li.getAttribute('data-state'))).toEqual(['waiting', 'signing', 'citizen', 'citizen', 'left', 'revoked']);
      expect(list.map((li) => within(li).getByText(/…/).textContent)).toEqual([BOB, CAROL, FERDIE, DAVE, OTHER, EVE].map(shortAddress));
      expect(within(list[0]).getByText('Onayını bekliyor')).toBeInTheDocument();
      expect(within(list[1]).getByText('Onayladın · imzası bekleniyor')).toBeInTheDocument();
      expect(within(list[2]).getByText('Vatandaş')).toBeInTheDocument();
      expect(within(list[2]).queryByText(/NFT/)).toBeNull();
      expect(within(list[2]).getByText('20000')).toBeInTheDocument();
      expect(within(list[3]).getByText('Welati Tiki NFT #12')).toBeInTheDocument();
      expect(within(list[3]).getByText('14905')).toBeInTheDocument();
      expect(within(list[4]).getByText('Artık vatandaş değil')).toBeInTheDocument();
      expect(within(list[4]).getByText('40000')).toBeInTheDocument();
      expect(within(list[5]).getByText('İptal edildi')).toBeInTheDocument();
      expect(within(list[5]).queryByText(/NFT/)).toBeNull();
      for (const [i, a] of [BOB, CAROL, FERDIE, DAVE, OTHER, EVE].entries()) {
        expect(within(list[i]).getByRole('button', { name: `${a} adresini kopyala` })).toBeInTheDocument();
      }
      // Approve only where the chain accepts approve_referral: the open application waiting for this account.
      expect(within(sec).getAllByRole('button', { name: /onayla$/ })).toHaveLength(1);
      expect(within(list[0]).getByRole('button', { name: `${BOB} onayla` })).toBeInTheDocument();
      for (const li of list.slice(1)) expect(within(li).queryByRole('button', { name: /onayla$/ })).toBeNull();
    });

    it('shows the list under the card of an Approved account without an NFT too', async () => {
      seed(); impl.nft = null;
      renderCitizen(); await login();
      await screen.findByText(i18n.t('iwallet.citizen.approvedNoNft'));
      expect(rows(await section())).toHaveLength(6);
    });

    const shown: Record<string, string> = {
      PendingReferral: 'Referansının onayı bekleniyor', ReferrerApproved: 'Referansın onayladı',
      Revoked: 'Bu hesabın vatandaşlığı iptal edildi.', NotStarted: 'Vatandaşsın',
    };
    for (const status of Object.keys(shown)) {
      it(`hides the list for an account whose status reads ${status}`, async () => {
        seed(); impl.status = status; impl.nft = status === 'NotStarted' ? 4n : null;
        renderCitizen(); await login();
        await screen.findByText(shown[status]);
        expect(screen.queryByRole('heading', { name: 'Referansı olduğun cüzdanlar' })).toBeNull();
        expect(screen.queryByText('Henüz kimseye referans olmadın.')).toBeNull();
        expect(screen.queryByRole('button', { name: /onayla$/ })).toBeNull();
        expect(impl.scans).toBe(0);
      });
    }

    it('says nobody was referred yet and copies the referral link', async () => {
      impl.status = 'Approved'; impl.nft = 1n; impl.people = T;
      const write = vi.fn(() => Promise.resolve());
      renderCitizen(); await login();
      const sec = await section();
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: write } });
      expect(within(sec).getByText('Henüz kimseye referans olmadın.')).toBeInTheDocument();
      expect(within(sec).queryByRole('list')).toBeNull();
      const link = `https://cuzdan.pex.network/?ref=${ADDR}`;
      expect(within(sec).getByText(link)).toBeInTheDocument();
      await user.click(within(sec).getByRole('button', { name: 'Referans bağlantımı kopyala' }));
      expect(write).toHaveBeenCalledWith(link);
    });

    it('reads the list again after an approve, and the row moves to waiting for their signature', async () => {
      seed();
      renderCitizen(); await login();
      await user.click(await screen.findByRole('button', { name: `${BOB} onayla` }));
      expect(screen.getByText(BOB)).toBeInTheDocument(); // the confirm names the applicant in full
      // The chain moves BOB on once the approve lands.
      impl.apps = impl.apps.map((x) => (x.applicant === BOB ? { ...x, status: 'ReferrerApproved' } : x));
      await signWith('right-pass1');
      expect(await screen.findByText('Referans onaylandı')).toBeInTheDocument();
      expect(impl.signed).toEqual([{ name: 'identityKyc.approveReferral', args: [BOB] }]);
      await user.click(screen.getByRole('button', { name: 'Vatandaşlığa dön' }));
      const sec = await section();
      expect(impl.scans).toBe(2);
      const list = rows(sec);
      expect(list.map((li) => li.getAttribute('data-state'))).toEqual(['signing', 'signing', 'citizen', 'citizen', 'left', 'revoked']);
      expect(within(sec).queryByRole('button', { name: /onayla$/ })).toBeNull();
    });

    it('reads the list again after a refused approve, so the stale Approve goes', async () => {
      seed(); impl.script = ['failed'];
      renderCitizen(); await login();
      await user.click(await screen.findByRole('button', { name: `${BOB} onayla` }));
      // BOB cancelled after the scan: the chain refuses the approve.
      impl.apps = impl.apps.filter((x) => x.applicant !== BOB);
      await signWith('right-pass1');
      await user.click(await screen.findByRole('button', { name: 'Vatandaşlığa dön' }));
      const sec = await section();
      await waitFor(() => expect(impl.scans).toBe(2));
      await waitFor(() => expect(within(sec).queryByRole('button', { name: `${BOB} onayla` })).toBeNull());
      // BOB is still in referral.referrals from the earlier citizenship (Approved in this mock): a citizen row now.
      expect(within(sec).getAllByRole('listitem').find((li) => li.textContent?.includes(shortAddress(BOB)))?.getAttribute('data-state')).toBe('citizen');
    });

    for (const fail of ['refs', 'apps', 'kycMulti', 'nftMulti', 'variant'] as const) {
      it(`greys only the section when the referral read fails (${fail}), keeps the card and the link, and retries`, async () => {
        seed();
        if (fail === 'variant') impl.apps = [...impl.apps, { applicant: FERDIE, referrer: ADDR, status: 'Suspended' }];
        else impl.fail = fail;
        if (fail === 'variant') impl.refs = impl.refs.filter((x) => x.referred !== FERDIE);
        renderCitizen(); await login();
        const sec = await section();
        expect(await within(sec).findByText('Referansı olduğun cüzdanlar yüklenemedi.')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Vatandaşsın' })).toBeInTheDocument();
        expect(screen.getByText('Welati Tiki NFT #1')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /onayla$/ })).toBeNull();
        expect(within(sec).getByText(`https://cuzdan.pex.network/?ref=${ADDR}`)).toBeInTheDocument();
        expect(within(sec).getByRole('button', { name: 'Referans bağlantımı kopyala' })).toBeInTheDocument();
        // The failure is not cached: Retry reads the list again.
        impl.fail = null; impl.apps = impl.apps.filter((x) => x.status !== 'Suspended');
        const before = impl.scans;
        await user.click(within(sec).getByRole('button', { name: 'Tekrar dene' }));
        expect(await within(sec).findByRole('button', { name: `${BOB} onayla` })).toBeInTheDocument();
        expect(impl.scans).toBe(before + 1);
      });
    }

    it('shows the citizen card before the referral list has loaded', async () => {
      seed();
      let open!: () => void;
      impl.refsGate = new Promise<void>((r) => { open = r; });
      renderCitizen(); await login();
      expect(await screen.findByRole('heading', { name: 'Vatandaşsın' })).toBeInTheDocument();
      const sec = await section();
      expect(within(sec).getByText(/^Yükleniyor/)).toBeInTheDocument();
      expect(within(sec).queryByRole('list')).toBeNull();
      open();
      expect(await within(sec).findByRole('button', { name: `${BOB} onayla` })).toBeInTheDocument();
    });

    it('shows 50 rows at a time with Show more', async () => {
      impl.status = 'Approved'; impl.nft = 1n; impl.people = T;
      impl.refs = Array.from({ length: 120 }, (_, i) => ({
        referred: encodeAddress(new Uint8Array(32).fill(0).map((_, j) => (j === 0 ? 1 : j === 1 ? i : 0)), 42),
        referrer: ADDR, createdAt: 1_000 + i, status: 'Approved', nft: BigInt(i),
      }));
      renderCitizen(); await login();
      const sec = await section();
      expect(within(sec).getByText('Toplam: 120')).toBeInTheDocument();
      expect(rows(sec)).toHaveLength(50);
      await user.click(within(sec).getByRole('button', { name: 'Daha fazla göster (50 / 120)' }));
      expect(rows(sec)).toHaveLength(100);
      await user.click(within(sec).getByRole('button', { name: 'Daha fazla göster (100 / 120)' }));
      expect(rows(sec)).toHaveLength(120);
      expect(within(sec).queryByRole('button', { name: /Daha fazla göster/ })).toBeNull();
    });
  });
});
