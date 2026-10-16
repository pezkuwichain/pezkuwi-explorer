import { isHex } from '@pezkuwi/util';
import { checkAddress, decodeAddress, encodeAddress } from '@pezkuwi/util-crypto';
import { IWALLET_NETWORK } from '../config/iwallet-network';

export type Recipient = { ok: true; address: string } | { ok: false; reason: 'invalid' | 'network' };

// A recipient for an i-Wallet transfer: SS58 with a valid checksum AND the mainnet prefix. An address of another
// network is refused, not silently re-encoded (it would look different on the confirm screen, and an exchange
// deposit address for another chain would never credit here). A raw hex key has no checksum and is refused.
export function parseRecipient(input: string): Recipient {
  const text = input.trim();
  if (!text || isHex(text)) return { ok: false, reason: 'invalid' };
  let pk: Uint8Array;
  try { pk = decodeAddress(text); } catch { return { ok: false, reason: 'invalid' }; }
  if (pk.length !== 32) return { ok: false, reason: 'invalid' };
  if (!checkAddress(text, IWALLET_NETWORK.ss58)[0]) return { ok: false, reason: 'network' };
  return { ok: true, address: encodeAddress(pk, IWALLET_NETWORK.ss58) };
}
