import { getApi as realGetApi, REQUEST_TIMEOUT_MS } from '../chain/connections';
import { withTimeout } from '../lib/timeout';

export type Stage = 'notStarted' | 'applied' | 'approved' | 'citizen' | 'revoked';

export async function loadCitizenship(address: string, deps = { getApi: realGetApi }) {
  const api = await deps.getApi('people');
  // kycStatuses, userTikis, trustScores are ValueQuery (default value returned);
  // citizenNft is OptionQuery. Measured live on Zagros People chain.
  const q = api.query as never as {
    identityKyc: { kycStatuses(a: string): Promise<{ type: string }> };
    tiki: { citizenNft(a: string): Promise<{ isSome: boolean }>; userTikis(a: string): Promise<{ type: string }[]> };
    trust: { trustScores(a: string): Promise<{ toBigInt(): bigint }> };
  };
  const [status, nft, tikis, trust] = await withTimeout(Promise.all([
    q.identityKyc.kycStatuses(address), q.tiki.citizenNft(address), q.tiki.userTikis(address), q.trust.trustScores(address),
  ]), REQUEST_TIMEOUT_MS);
  // Only known variants map to a stage. A variant added by a runtime upgrade must not be shown as
  // "applied": it surfaces as a load error until this mapping is updated.
  const stage: Stage =
    status.type === 'Revoked' ? 'revoked'
    : status.type === 'Approved' ? (nft.isSome ? 'citizen' : 'approved')
    : status.type === 'NotStarted' ? 'notStarted'
    : status.type === 'PendingReferral' || status.type === 'ReferrerApproved' ? 'applied'
    : (() => { throw new Error(`unknown citizenship status: ${status.type}`); })();
  return { stage, roles: tikis.map((t) => t.type), trust: trust.toBigInt() };
}
