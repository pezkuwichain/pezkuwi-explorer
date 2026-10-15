import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NETWORK } from '../../config/network';

// A stand-in for sign-client: records the proposal, hands out an approval the test settles, keeps handlers.
const wc = vi.hoisted(() => {
  const state = {
    init: 0,
    proposal: null as unknown,
    handlers: {} as Record<string, (a: unknown) => void>,
    settle: null as null | { ok(s: unknown): void; no(e: unknown): void },
    sessions: [] as { topic: string; expiry: number; namespaces: Record<string, { accounts: string[] }> }[],
    disconnected: [] as string[],
  };
  const client = {
    on: (ev: string, h: (a: unknown) => void) => { state.handlers[ev] = h; },
    connect: async (p: unknown) => {
      state.proposal = p;
      const approval = new Promise((ok, no) => { state.settle = { ok, no }; });
      return { uri: 'wc:abc@2?relay-protocol=irn&symKey=00', approval: () => approval };
    },
    disconnect: async ({ topic }: { topic: string }) => { state.disconnected.push(topic); },
    session: { getAll: () => state.sessions },
  };
  return { state, client };
});
vi.mock('@walletconnect/sign-client', () => ({ SignClient: { init: async () => { wc.state.init++; return wc.client; } } }));

const ZAGROS = ['relay', 'assetHub', 'people'] as const;
const ALICE = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const session = (topic: string, expiry = Math.floor(Date.now() / 1000) + 3600) => ({
  topic, expiry,
  namespaces: { polkadot: { accounts: [`polkadot:1aa94987791a5544e9667ec249d2cef1:${ALICE}`, `polkadot:e7c15092dcbe3f320260ddbbc685bfce:${ALICE}`] } },
});
// A fresh module (and a fresh network config with a project id) for each load: the client is a singleton.
const load = async (projectId = 'test-project') => {
  vi.resetModules();
  (await import('../../config/network')).NETWORK.walletConnectProjectId = projectId;
  return import('./walletconnect');
};
const KEY = 'pezkuwi-explorer:wc-session';

beforeEach(() => {
  localStorage.clear();
  Object.assign(wc.state, { init: 0, proposal: null, handlers: {}, settle: null, sessions: [], disconnected: [] });
});

describe('walletconnect proposal', () => {
  it('is the proposal Pezkuwi Wallet approves: required polkadot namespace, two methods, two events, three Pezkuwi chains', async () => {
    const m = await load();
    expect(m.wcRequiredNamespaces()).toEqual({
      polkadot: {
        methods: ['polkadot_signTransaction', 'polkadot_signMessage'],
        chains: ['polkadot:1aa94987791a5544e9667ec249d2cef1', 'polkadot:e7c15092dcbe3f320260ddbbc685bfce', 'polkadot:69a8d025ab7b63363935d7d9397e0f65'],
        events: ['chainChanged', 'accountsChanged'],
      },
    });
    const p = m.startPairing();
    await vi.waitFor(() => expect(wc.state.proposal).not.toBeNull());
    await p;
    // Sent as requiredNamespaces, never optionalNamespaces.
    expect(wc.state.proposal).toEqual({ requiredNamespaces: m.wcRequiredNamespaces() });
  });
  it('never names a Zagros chain (the wallet registry has none, so it could not approve)', async () => {
    const m = await load();
    const zagros = ZAGROS.map((c) => `polkadot:${NETWORK.chains[c].genesis.slice(2, 34)}`);
    for (const id of zagros) expect(m.wcRequiredNamespaces().polkadot.chains).not.toContain(id);
  });
  it('gives the Pezkuwi Wallet deep link for the pairing', async () => {
    const m = await load();
    const p = await m.startPairing();
    expect(p.deepLink).toBe('pezkuwiwallet://wc?uri=' + encodeURIComponent('wc:abc@2?relay-protocol=irn&symKey=00'));
  });
});

describe('walletconnect session', () => {
  it('keeps the session after approval and returns each address once', async () => {
    const m = await load();
    const p = await m.startPairing();
    wc.state.settle!.ok(session('t1'));
    expect(await p.approval()).toEqual([ALICE]);
    expect(wc.state.disconnected).toEqual([]);
    expect(localStorage.getItem(KEY)).toBe('t1');
  });
  it('disconnects an approval that arrives after abort and never stores it', async () => {
    const m = await load();
    const ctl = new AbortController();
    const p = await m.startPairing(ctl.signal);
    const wait = p.approval();
    ctl.abort();
    await expect(wait).rejects.toThrow('aborted');
    wc.state.settle!.ok(session('late'));
    await vi.waitFor(() => expect(wc.state.disconnected).toEqual(['late']));
    expect(localStorage.getItem(KEY)).toBeNull();
  });
  it('the wallet ending the session (session_delete) clears it and tells the page', async () => {
    const m = await load();
    const p = await m.startPairing();
    wc.state.settle!.ok(session('t1'));
    await p.approval();
    const heard = vi.fn();
    window.addEventListener(m.WC_DISCONNECTED, heard);
    wc.state.handlers.session_delete!({ topic: 't1' });
    window.removeEventListener(m.WC_DISCONNECTED, heard);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
  it('session_expire does the same', async () => {
    const m = await load();
    const p = await m.startPairing();
    wc.state.settle!.ok(session('t1'));
    await p.approval();
    const heard = vi.fn();
    window.addEventListener(m.WC_DISCONNECTED, heard);
    wc.state.handlers.session_expire!({ topic: 't1' });
    window.removeEventListener(m.WC_DISCONNECTED, heard);
    expect(heard).toHaveBeenCalledTimes(1);
  });
  it('disconnectWalletConnect does nothing (no client) when no session was kept', async () => {
    const m = await load();
    await m.disconnectWalletConnect();
    expect(wc.state.init).toBe(0);
  });
  it('disconnectWalletConnect ends a kept session after a reload and clears the key', async () => {
    localStorage.setItem(KEY, 'kept');
    const m = await load();
    await m.disconnectWalletConnect();
    expect(wc.state.init).toBe(1);
    expect(wc.state.disconnected).toEqual(['kept']);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
  it('restore finds a live kept session, and reports one the wallet no longer has as gone', async () => {
    localStorage.setItem(KEY, 'kept');
    wc.state.sessions = [session('kept')];
    expect(await (await load()).restoreWalletConnect()).toEqual({ state: 'live', accounts: [ALICE] });
    wc.state.sessions = [session('kept', 1)];
    expect(await (await load()).restoreWalletConnect()).toEqual({ state: 'gone' });
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(await (await load()).restoreWalletConnect()).toEqual({ state: 'none' });
  });
  it('without a project id it behaves like no wallet', async () => {
    const m = await load('');
    const { NoWalletError } = await import('./extension');
    await expect(m.startPairing()).rejects.toBeInstanceOf(NoWalletError);
  });
  it('a new pairing ends the session kept for an earlier account, quietly', async () => {
    localStorage.setItem(KEY, 'old');
    const m = await load();
    const heard = vi.fn();
    window.addEventListener(m.WC_DISCONNECTED, heard);
    const p = await m.startPairing();
    wc.state.settle!.ok(session('t2'));
    await p.approval();
    await vi.waitFor(() => expect(wc.state.disconnected).toEqual(['old']));
    window.removeEventListener(m.WC_DISCONNECTED, heard);
    expect(heard).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBe('t2');
  });
  it('disconnect forgets the session at once, so a pairing kept meanwhile survives it', async () => {
    localStorage.setItem(KEY, 'old');
    const m = await load();
    const ending = m.disconnectWalletConnect();
    expect(localStorage.getItem(KEY)).toBeNull();
    localStorage.setItem(KEY, 'newer');
    await ending;
    expect(wc.state.disconnected).toEqual(['old']);
    expect(localStorage.getItem(KEY)).toBe('newer');
  });
});
