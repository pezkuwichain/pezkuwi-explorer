import { NETWORK } from '../../config/network';
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
// Pezkuwi Wallet's chain registry (pezkuwi-wallet-utils chains v15/v17) contains only these three chains and
// no Zagros chain, so a proposal that requires a Zagros chain id cannot be approved. The account (public key)
// does not depend on the chain: pair on these three, take the SS58 address, and normaliseAddress turns it
// into the form of the network the explorer reads.
export const PEZKUWI_CHAINS = [
  'polkadot:1aa94987791a5544e9667ec249d2cef1', // Relay
  'polkadot:e7c15092dcbe3f320260ddbbc685bfce', // Asset Hub
  'polkadot:69a8d025ab7b63363935d7d9397e0f65', // People
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
// 'none': no session was kept. 'gone': one was kept but the wallet no longer has it (deleted or expired).
export async function restoreWalletConnect(): Promise<{ state: 'none' } | { state: 'gone' } | { state: 'live'; accounts: string[] }> {
  const topic = storage.get(WC_SESSION_KEY);
  if (!topic) return { state: 'none' };
  const c = await init();
  const s = c.session.getAll().find((x) => x.topic === topic);
  if (s && s.expiry > Math.floor(Date.now() / 1000)) { session = s; return { state: 'live', accounts: sessionAccounts(s) }; }
  session = null;
  storage.remove(WC_SESSION_KEY);
  return { state: 'gone' };
}

// Sign-out: ends the kept session. The client is created only when a session was kept; never throws.
export async function disconnectWalletConnect(): Promise<void> {
  const topic = session?.topic ?? storage.get(WC_SESSION_KEY);
  if (!topic) return;
  try {
    const c = await init();
    await c.disconnect({ topic, reason: { code: 6000, message: 'User disconnected' } });
  } catch { /* already gone on the wallet side, or the relay is unreachable: the local sign-out stands */ }
  session = null;
  storage.remove(WC_SESSION_KEY);
  window.dispatchEvent(new Event(WC_DISCONNECTED));
}
