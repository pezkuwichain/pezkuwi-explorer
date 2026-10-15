// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { normaliseAddress, shortAddress } from './address';

const ALICE_42 = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const ALICE_POLKADOT = '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5';

describe('normaliseAddress', () => {
  it('accepts a prefix-42 address unchanged', () => expect(normaliseAddress(ALICE_42)).toBe(ALICE_42));
  it('re-encodes an address from another network to prefix 42', () =>
    expect(normaliseAddress(ALICE_POLKADOT)).toBe(ALICE_42));
  it('trims whitespace from pasted text', () => expect(normaliseAddress(`  ${ALICE_42}\n`)).toBe(ALICE_42));
  it('rejects a bad checksum and garbage', () => {
    expect(normaliseAddress(ALICE_42.slice(0, -1) + 'Z')).toBeNull();
    expect(normaliseAddress('hello')).toBeNull();
    expect(normaliseAddress('')).toBeNull();
  });
});

describe('shortAddress', () => {
  it('keeps 6 leading and 6 trailing characters', () => expect(shortAddress(ALICE_42)).toBe('5Grwva…GKutQY'));
});
