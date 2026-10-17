// The Digital Kurdistan citizen number, exactly as pwap (shared/lib/tiki.ts generateCitizenNumber) and the exchange
// (api-gateway/src/services/citizenUid.js) build it: `#42-<item>-<six digits>`. It is already written into P2P bank
// transfer references and checked at citizen sign-in, so every product must produce the same string; the tests pin
// vectors taken from the exchange's own function.
//
// "42" is a fixed prefix, not the chain value: on chain the citizen NFTs live in collection 0 (tiki.tikiCollectionId,
// measured 2026-10-17). Changing the prefix would break every reference already written.
export const CITIZEN_COLLECTION_ID = 42;

// Six digits derived from the owner address, so adjacent item ids do not give adjacent numbers. Not a security property.
export function generateCitizenNumber(ownerAddress: string, collectionId: number, itemId: number): string {
  let hash = 0;
  for (let i = 0; i < ownerAddress.length; i++) {
    hash = ((hash << 5) - hash) + ownerAddress.charCodeAt(i);
    hash = hash | 0; // 32-bit
  }
  hash += collectionId * 1000 + itemId;
  hash = Math.abs(hash);
  return (hash % 1_000_000).toString().padStart(6, '0');
}

// `#42-97-255509`; null when the account holds no citizen NFT. Item id 0 is a real NFT, so only null means none.
export function formatCitizenUid(ownerAddress: string, itemId: bigint | number | null | undefined): string | null {
  if (itemId === null || itemId === undefined || !ownerAddress) return null;
  const item = Number(itemId);
  return `#${CITIZEN_COLLECTION_ID}-${item}-${generateCitizenNumber(ownerAddress, CITIZEN_COLLECTION_ID, item)}`;
}
