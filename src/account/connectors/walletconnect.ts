import { MAINNET, NETWORK, caip2For } from '../../config/network';
import { storage } from '../../lib/storage';
import { NoWalletError, RejectedError } from './extension';

// WalletConnect v2, the same flow app.pezkuwichain.io and dks.news run in production with Pezkuwi Wallet
// (pwap web/src/lib/walletconnect-service.ts, kurdistan-news chain/src/wc-web.js). The proposal is the exact
// set those send, because that is the request the wallet is built to approve:
//   requiredNamespaces.polkadot = the two signing methods, the two events, the three Pezkuwi chains.
// The explorer is read-only today and never sends a signing request; the methods are in the proposal only
// because Pezkuwi Wallet answers that proposal and no other.
export const WC_METHODS = ['polkadot_signTransaction', 'polkadot_signMessage'] as const;
export const WC_EVENTS = ['chainChanged', 'accountsChanged'] as const;
// Pezkuwi Wallet's chain registry (pezkuwi-wallet-utils chains v15/v17) contains only the three mainnet chains and
// no Zagros chain, so a proposal that requires a Zagros chain id cannot be approved. The session therefore asks
// for the mainnet chain ids whichever network the explorer reads (NETWORK, src/config/network.ts): on mainnet they
// are NETWORK's own, on Zagros they are the only ones the wallet can approve. The account (public key) does not
// depend on the chain: pair on these three, take the SS58 address, and normaliseAddress turns it into the form
// of the network the explorer reads (both networks use SS58 42).
export const PEZKUWI_CHAINS = [
  caip2For(MAINNET, 'relay'), // polkadot:1aa94987791a5544e9667ec249d2cef1
  caip2For(MAINNET, 'assetHub'), // polkadot:e7c15092dcbe3f320260ddbbc685bfce
  caip2For(MAINNET, 'people'), // polkadot:69a8d025ab7b63363935d7d9397e0f65
] as const;

export const wcRequiredNamespaces = () => ({
  polkadot: { methods: [...WC_METHODS], chains: [...PEZKUWI_CHAINS], events: [...WC_EVENTS] },
});

// Pezkuwi Wallet's own scheme: on a phone the wallet is on the same device, so the pairing opens it directly.
export const deepLinkFor = (uri: string) => `pezkuwiwallet://wc?uri=${encodeURIComponent(uri)}`;

// The session topic, kept so the session survives a reload and can be ended on sign-out.
export const WC_SESSION_KEY = 'wc-session';
// Fired on window when the session ends: by the wallet (session_delete), by expiry, or by disconnect.
export const WC_DISCONNECTED = 'pezkuwi-explorer:wc-disconnected';
// Fired on window once a pairing is approved and its account is open (pwap's 'walletconnect_connected').
export const WC_CONNECTED = 'pezkuwi-explorer:wc-connected';

// Follows the deep link into the wallet app. Its own function so tests can see it without navigating.
export function followDeepLink(href: string): void {
  try { window.location.href = href; } catch { /* the Open button stays on screen */ }
}

type Client = Awaited<ReturnType<typeof import('@walletconnect/sign-client').SignClient.init>>;
type Session = ReturnType<Client['session']['getAll']>[number];

let client: Client | null = null;
let initP: Promise<Client> | null = null;
let session: Session | null = null;

const aborted = () => new DOMException('aborted', 'AbortError');

function drop() {
  session = null;
  storage.remove(WC_SESSION_KEY);
  window.dispatchEvent(new Event(WC_DISCONNECTED));
}

// One client per page, created on first use (sign-client is heavy and loaded only then).
async function init(): Promise<Client> {
  if (client) return client;
  if (initP) return initP;
  // Without a project id WalletConnect cannot start; behave like "no wallet".
  if (!NETWORK.walletConnectProjectId) throw new NoWalletError();
  initP = import('@walletconnect/sign-client')
    .then(({ SignClient }) => SignClient.init({
      projectId: NETWORK.walletConnectProjectId,
      metadata: {
        name: 'Pezkuwi Explorer',
        description: 'Pezkuwi Explorer',
        url: 'https://explorer.pezkuwichain.io',
        icons: ['https://explorer.pezkuwichain.io/icon-192.png'],
        // Lets Pezkuwi Wallet return to the browser after approving (phone).
        redirect: { native: '', universal: 'https://explorer.pezkuwichain.io' },
      },
    }))
    .then((c) => {
      client = c;
      // Only the session this page holds: another topic ending says nothing about this one.
      c.on('session_delete', ({ topic }) => { if (!session || session.topic === topic) drop(); });
      c.on('session_expire', ({ topic }) => { if (!session || session.topic === topic) drop(); });
      c.on('session_update', ({ topic, params }) => { if (session?.topic === topic) session = { ...session, namespaces: params.namespaces }; });
      return c;
    })
    .catch((e) => { initP = null; throw e; });
  return initP;
}

// The SS58 addresses the session shares, without duplicates (one key appears once per chain).
export function sessionAccounts(s: Session | null = session): string[] {
  const accounts = s?.namespaces.polkadot?.accounts ?? [];
  return [...new Set(accounts.map((a) => a.split(':').pop() ?? '').filter(Boolean))];
}

// The wallet's name as it introduced itself in the session (shown as "WalletConnect (name)").
export function sessionPeerName(s: Session | null = session): string | null {
  return s?.peer?.metadata?.name || null;
}

// A kept session must cover every chain the proposal requires, or signing on the missing chain would fail later.
// pwap (restoreSession) discards such a session so the next pairing asks for all three again.
function coversAllChains(s: Session): boolean {
  const ns = s.namespaces.polkadot;
  const chains = ns?.chains ?? ns?.accounts?.map((a) => a.split(':').slice(0, 2).join(':')) ?? [];
  return PEZKUWI_CHAINS.every((c) => chains.includes(c));
}

export type Pairing = { uri: string; deepLink: string; approval(): Promise<string[]> };

// Begins a pairing. The caller shows uri (as a QR) or follows deepLink, then awaits approval(), which resolves
// to the shared addresses and keeps the session. Aborting rejects the wait with an AbortError; an approval
// that arrives after the abort is disconnected at once and never stored.
export async function startPairing(signal?: AbortSignal): Promise<Pairing> {
  if (signal?.aborted) throw aborted();
  const c = await init();
  const { uri, approval } = await c.connect({ requiredNamespaces: wcRequiredNamespaces() });
  if (!uri) throw new RejectedError();
  const pending = approval();
  pending.catch(() => {}); // a proposal nobody waits for may expire; that is not an unhandled error
  // A late approval is disconnected at once and never reaches the caller.
  const cancelLate = () => { pending.then((late) => c.disconnect({ topic: late.topic, reason: { code: 6000, message: 'cancelled' } })).catch(() => {}); };
  if (signal?.aborted) { cancelLate(); throw aborted(); }
  return {
    uri,
    deepLink: deepLinkFor(uri),
    approval: async () => {
      if (signal?.aborted) { cancelLate(); throw aborted(); }
      const stop = new Promise<never>((_, rej) => signal?.addEventListener('abort', () => rej(aborted()), { once: true }));
      let s: Session;
      try {
        s = await Promise.race([pending, stop]);
      } catch (e) {
        if (signal?.aborted) { cancelLate(); throw e instanceof DOMException ? e : aborted(); }
        throw new RejectedError();
      }
      // A session kept for an earlier account must not outlive it: end it as this one takes its place. Quietly,
      // without the disconnected event, because the account now opening is this new session's.
      const earlier = session?.topic ?? storage.get(WC_SESSION_KEY);
      if (earlier && earlier !== s.topic) void c.disconnect({ topic: earlier, reason: { code: 6000, message: 'replaced' } }).catch(() => {});
      session = s;
      storage.set(WC_SESSION_KEY, s.topic);
      return sessionAccounts(s);
    },
  };
}

// Pairs and returns the shared addresses; onPairing receives the uri and deep link to show while waiting.
export async function walletConnectAccounts(onPairing: (p: { uri: string; deepLink: string }) => void, signal?: AbortSignal): Promise<string[]> {
  const p = await startPairing(signal);
  onPairing({ uri: p.uri, deepLink: p.deepLink });
  return p.approval();
}

// Picks up the session kept from an earlier visit, so the wallet ending it is heard again.
// 'none': no session was kept. 'gone': one was kept but the wallet no longer has it (deleted or expired), or it
// lacks one of the three chains (then it is ended here, as pwap does).
export async function restoreWalletConnect(): Promise<{ state: 'none' } | { state: 'gone' } | { state: 'live'; accounts: string[]; peerName: string | null }> {
  const topic = storage.get(WC_SESSION_KEY);
  if (!topic) return { state: 'none' };
  const c = await init();
  const s = c.session.getAll().find((x) => x.topic === topic);
  if (s && s.expiry > Math.floor(Date.now() / 1000)) {
    if (coversAllChains(s)) { session = s; return { state: 'live', accounts: sessionAccounts(s), peerName: sessionPeerName(s) }; }
    void c.disconnect({ topic: s.topic, reason: { code: 6000, message: 'Session missing required chains' } }).catch(() => {});
  }
  session = null;
  storage.remove(WC_SESSION_KEY);
  return { state: 'gone' };
}

// Sign-out: ends the kept session. The client is created only when a session was kept; never throws.
export async function disconnectWalletConnect(): Promise<void> {
  const topic = session?.topic ?? storage.get(WC_SESSION_KEY);
  if (!topic) return;
  // Forgotten locally at once, so a pairing made while the relay answers is never the one cleared.
  session = null;
  storage.remove(WC_SESSION_KEY);
  try {
    const c = await init();
    await c.disconnect({ topic, reason: { code: 6000, message: 'User disconnected' } });
  } catch { /* already gone on the wallet side, or the relay is unreachable: the local sign-out stands */ }
  window.dispatchEvent(new Event(WC_DISCONNECTED));
}
