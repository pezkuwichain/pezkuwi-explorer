import { NETWORK, caip2 } from '../../config/network';
import { NoWalletError, RejectedError } from './extension';

// Accounts only. No signing method is requested, so the session cannot be asked to sign.
export const wcNamespaces = () => ({
  polkadot: { methods: [] as string[], chains: [caip2('relay'), caip2('assetHub'), caip2('people')], events: ['accountsChanged'] },
});

export async function walletConnectAccounts(onUri: (uri: string) => void): Promise<string[]> {
  // Without a project id WalletConnect cannot start; behave like "no wallet".
  if (!NETWORK.walletConnectProjectId) throw new NoWalletError();
  const { default: SignClient } = await import('@walletconnect/sign-client');
  const client = await SignClient.init({
    projectId: NETWORK.walletConnectProjectId,
    metadata: { name: 'Pezkuwi Explorer', description: 'Pezkuwi Explorer', url: 'https://explorer.pezkuwichain.io', icons: ['https://explorer.pezkuwichain.io/icon-192.png'] },
  });
  const { uri, approval } = await client.connect({ optionalNamespaces: wcNamespaces() });
  if (uri) onUri(uri);
  const session = await approval().catch(() => { throw new RejectedError(); });
  const addrs = Object.values(session.namespaces).flatMap((n) => n.accounts).map((a) => a.split(':')[2]);
  await client.disconnect({ topic: session.topic, reason: { code: 6000, message: 'address read' } }).catch(() => {});
  return [...new Set(addrs)];
}
