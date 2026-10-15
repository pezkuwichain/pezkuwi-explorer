// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { loadCitizenship } from './citizenship';

const people = (status: string, nft: boolean, tikis: string[], trust: bigint, nftId = 1042n) => () => Promise.resolve({
  query: {
    identityKyc: { kycStatuses: () => Promise.resolve({ type: status }) },
    tiki: {
      citizenNft: () => Promise.resolve({ isSome: nft, unwrap: () => { if (!nft) throw new Error('None'); return { toBigInt: () => nftId }; } }),
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
  it('an unknown status is an error, never "applied"', async () => {
    await expect(loadCitizenship('5Grw', { getApi: people('SomethingNew', false, [], 0n) })).rejects.toThrow(/SomethingNew/);
  });
  it('returns roles and trust', async () => {
    const r = await loadCitizenship('5Grw', { getApi: people('Approved', true, ['Welati', 'Noter'], 42n) });
    expect(r).toEqual({ stage: 'citizen', roles: ['Welati', 'Noter'], trust: 42n, nftId: 1042n });
  });
  it('exposes the citizen NFT number, and null when there is none', async () => {
    expect((await loadCitizenship('5Grw', { getApi: people('Approved', true, [], 0n, 7n) })).nftId).toBe(7n);
    expect((await loadCitizenship('5Grw', { getApi: people('Approved', false, [], 0n) })).nftId).toBeNull();
    expect((await loadCitizenship('5Grw', { getApi: people('PendingReferral', false, [], 0n) })).nftId).toBeNull();
  });
});
