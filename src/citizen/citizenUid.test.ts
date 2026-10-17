import { describe, expect, it } from 'vitest';
import { formatCitizenUid, generateCitizenNumber } from './citizenUid';

// Vectors produced by the exchange's own formatCitizenUid (api-gateway/src/services/citizenUid.js) on 2026-10-17.
const VECTORS: [string, number, string][] = [
  ['5FuesBLjbaC32RwqKSJhndF3sgBG27r7thubSQ1rzg5z6sTF', 97, '#42-97-255509'],
  ['5CtEnJffHdHfgFodZPyV9mKXHRvnjY7uMhcuvCe8z3bJnA7b', 67, '#42-67-583723'],
  ['5CyuFfbF95rzBxru7c9yEsX4XmQXUxpLUcbj9RLg9K1cGiiF', 0, '#42-0-832967'],
];

describe('citizen number', () => {
  it('matches the exchange and pwap for the same owner and item', () => {
    for (const [address, item, uid] of VECTORS) expect(formatCitizenUid(address, BigInt(item))).toBe(uid);
  });
  it('treats item 0 as a real NFT and null as none', () => {
    expect(formatCitizenUid(VECTORS[2][0], 0n)).toBe('#42-0-832967');
    expect(formatCitizenUid(VECTORS[0][0], null)).toBeNull();
  });
  it('gives six digits', () => {
    expect(generateCitizenNumber(VECTORS[0][0], 42, 97)).toMatch(/^\d{6}$/);
  });
});
