import { isHex } from '@pezkuwi/util';
import { decodeAddress, encodeAddress } from '@pezkuwi/util-crypto';
import { NETWORK } from '../config/network';

export function normaliseAddress(input: string): string | null {
  const text = input.trim();
  // decodeAddress also accepts a raw hex public key; that has no checksum, so one typo
  // would silently name a different account. Only SS58 (with its checksum) is an address.
  if (!text || isHex(text)) return null;
  try {
    const pk = decodeAddress(text);
    if (pk.length !== 32) return null;
    return encodeAddress(pk, NETWORK.ss58);
  } catch {
    return null;
  }
}

export const shortAddress = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-6)}` : a);
