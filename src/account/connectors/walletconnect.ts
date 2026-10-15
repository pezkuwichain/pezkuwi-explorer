import { NETWORK, caip2 } from '../../config/network';
import { NoWalletError, RejectedError } from './extension';

// Accounts only. No signing method is requested, so the session cannot be asked to sign.
export const wcNamespaces = () => ({
  polkadot: { methods: [] as string[], chains: [caip2('relay'), caip2('assetHub'), caip2('people')], events: ['accountsChanged'] },
});

export async function walletConnectAccounts(onUri: (uri: string) => void, signal?: AbortSignal): Promise<string[]> {
  // Without a project id WalletConnect cannot start; behave like "no wallet".
  if (!NETWORK.walletConnectProjectId) throw new NoWalletError();
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
  const { default: SignClient } = await import('@walletconnect/sign-client');
  const client = await SignClient.init({
    projectId: NETWORK.walletConnectProjectId,
    metadata: { name: 'Pezkuwi Explorer', description: 'Pezkuwi Explorer', url: 'https://explorer.pezkuwichain.io', icons: ['https://explorer.pezkuwichain.io/icon-192.png'] },
  });
  const { uri, approval } = await client.connect({ optionalNamespaces: wcNamespaces() });
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
  if (uri) onUri(uri);
  // A pairing that is abandoned must not stay open: reject the wait when aborted.
  const aborted = new Promise<never>((_, rej) => signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')), { once: true }));
  const pending = approval();
  let session: Awaited<typeof pending>;
  try {
    session = await Promise.race([pending, aborted]);
  } catch (e) {
    if (signal?.aborted) {
      // A late approval is disconnected at once and never reaches the caller.
      pending.then((late) => client.disconnect({ topic: late.topic, reason: { code: 6000, message: 'cancelled' } })).catch(() => {});
      throw e instanceof DOMException ? e : new DOMException('aborted', 'AbortError');
    }
    throw new RejectedError();
  }
  const addrs = Object.values(session.namespaces).flatMap((n) => n.accounts).map((a) => a.split(':')[2]);
  await client.disconnect({ topic: session.topic, reason: { code: 6000, message: 'address read' } }).catch(() => {});
  return [...new Set(addrs)];
}
