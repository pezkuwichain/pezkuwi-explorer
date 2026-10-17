// The card number and the machine-readable zone on its back, built only from real data (and the names the
// person typed on this device). MRZ lines are 30 characters of A–Z, 0–9 and the filler '<'.

const LINE = 30;
const pad = (s: string) => (s + '<'.repeat(LINE)).slice(0, LINE);

import { formatCitizenUid } from './citizenUid';

// The citizen number shared with pwap and the exchange (`#42-97-255509`); null when the account holds no citizen NFT.
export const cidNumber = (nftId: bigint | null, address: string): string | null => formatCitizenUid(address, nftId);

// Folds a name to MRZ letters: diacritics dropped (Ê→E, Ş→S, Ç→C), spaces to '<', anything else removed.
function field(name: string | undefined): string {
  return (name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    .replace(/İ/g, 'I').replace(/\s+/g, '<').replace(/[^A-Z0-9<]/g, '').replace(/^<+|<+$/g, '');
}

export function mrz(d: { nftId: bigint | null; address: string; given?: string; surname?: string }): [string, string, string] {
  // The document number is the citizen number's digits (42, item, six-digit code), as MRZ allows no '#' or '-'.
  const num = (cidNumber(d.nftId, d.address) ?? '').replace(/[^0-9]/g, '');
  const surname = field(d.surname), given = field(d.given);
  const names = surname + (given ? `<<${given}` : '');
  return [pad(`IDDKZ${num}`), pad(d.address.toUpperCase().replace(/[^A-Z0-9]/g, '')), pad(`WELATI<<${names}`)];
}
