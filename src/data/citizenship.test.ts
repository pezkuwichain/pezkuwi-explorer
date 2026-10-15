// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { loadCitizenship } from './citizenship';

const people = (status: string, nft: boolean, tikis: string[], trust: bigint) => () => Promise.resolve({
  query: {
    identityKyc: { kycStatuses: () => Promise.resolve({ type: status }) },
    tiki: {
      citizenNft: () => Promise.resolve({ isSome: nft }),
      userTikis: () => Promise.resolve(tikis.map((t) => ({ type: t }))),
    },
    trust: { trustScores: () => Promise.resolve({ toBigInt: () => trust }) },
  },
}) as never;

describe('loadCitizenship', () => {
  it.each([
    ['NotStarted', false, 'notStarted'],
    ['PendingReferral', false, 'applied'],
    ['ReferrerApproved', false, 'applied'],
    ['Approved', false, 'approved'],
    ['Approved', true, 'citizen'],
    ['Revoked', false, 'revoked'],
  ])('%s (nft %s) -> %s', async (status, nft, stage) => {
    const r = await loadCitizenship('5Grw', { getApi: people(status, nft as boolean, [], 0n) });
    expect(r.stage).toBe(stage);
  });
  it('returns roles and trust', async () => {
    const r = await loadCitizenship('5Grw', { getApi: people('Approved', true, ['Welati', 'Noter'], 42n) });
    expect(r).toEqual({ stage: 'citizen', roles: ['Welati', 'Noter'], trust: 42n });
  });
});
