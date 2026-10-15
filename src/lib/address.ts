import { decodeAddress, encodeAddress } from '@pezkuwi/util-crypto';
import { NETWORK } from '../config/network';

export function normaliseAddress(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  try {
    const pk = decodeAddress(text);
    if (pk.length !== 32) return null;
    return encodeAddress(pk, NETWORK.ss58);
  } catch {
    return null;
  }
}

export const shortAddress = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-6)}` : a);
