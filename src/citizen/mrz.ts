// The card number and the machine-readable zone on its back, built only from real data (and the names the
// person typed on this device). MRZ lines are 30 characters of A–Z, 0–9 and the filler '<'.

const LINE = 30;
const pad = (s: string) => (s + '<'.repeat(LINE)).slice(0, LINE);

// "DK-" and the citizenship NFT id, at least six digits; null when the account holds no citizenship NFT.
export const cidNumber = (nftId: bigint | null): string | null => (nftId === null ? null : `DK-${nftId.toString().padStart(6, '0')}`);

// Folds a name to MRZ letters: diacritics dropped (Ê→E, Ş→S, Ç→C), spaces to '<', anything else removed.
function field(name: string | undefined): string {
  return (name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    .replace(/İ/g, 'I').replace(/\s+/g, '<').replace(/[^A-Z0-9<]/g, '').replace(/^<+|<+$/g, '');
}

export function mrz(d: { nftId: bigint | null; address: string; given?: string; surname?: string }): [string, string, string] {
  const num = d.nftId === null ? '' : d.nftId.toString().padStart(6, '0');
  const surname = field(d.surname), given = field(d.given);
  const names = surname + (given ? `<<${given}` : '');
  return [pad(`IDDKZ${num}`), pad(d.address.toUpperCase().replace(/[^A-Z0-9]/g, '')), pad(`WELATI<<${names}`)];
}
