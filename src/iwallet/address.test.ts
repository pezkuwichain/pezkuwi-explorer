import { describe, expect, it } from 'vitest';
import { encodeAddress, decodeAddress } from '@pezkuwi/util-crypto';
import { parseRecipient } from './address';

const BOB = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
describe('parseRecipient', () => {
  it('accepts a prefix-42 address', () => {
    expect(parseRecipient(` ${BOB} `)).toEqual({ ok: true, address: BOB });
  });
  it('refuses an address of another network instead of re-encoding it', () => {
    const polkadot = encodeAddress(decodeAddress(BOB), 0);
    const kusama = encodeAddress(decodeAddress(BOB), 2);
    expect(parseRecipient(polkadot)).toEqual({ ok: false, reason: 'network' });
    expect(parseRecipient(kusama)).toEqual({ ok: false, reason: 'network' });
  });
  it('refuses a bad checksum, hex keys and empty input', () => {
    expect(parseRecipient(BOB.slice(0, -1) + 'x')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseRecipient('0x' + '11'.repeat(32))).toEqual({ ok: false, reason: 'invalid' });
    expect(parseRecipient('')).toEqual({ ok: false, reason: 'invalid' });
  });
});
