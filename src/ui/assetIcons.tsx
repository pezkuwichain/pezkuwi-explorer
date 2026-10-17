import type { ChainKey } from '../config/network';

// The Pezkuwi Wallet's own token art, byte for byte (pezkuwi-wallet-utils icons/tokens/colored/: HEZ.svg,
// PEZ.svg, and wUSDT.png, the Pezkuwi-badged USDT the wallet shows, saved as USDT.png), so a token looks the same here as in the wallet.
const TOKEN_SRC: Record<string, string> = { HEZ: '/tokens/HEZ.svg', PEZ: '/tokens/PEZ.svg', USDT: '/tokens/USDT.png' };
const CHAIN_SRC: Record<ChainKey, string> = { relay: '/chains/relay.png', assetHub: '/chains/assethub.png', people: '/chains/people.png' };

// Decorative: the symbol is always written next to it. An asset without art gets a neutral circle with its name.
export function TokenIcon({ symbol, size = 36 }: { symbol: string; size?: number }) {
  const src = TOKEN_SRC[symbol];
  // The name is drawn by CSS (attr()), so the symbol written beside the circle stays the only text copy of it.
  if (!src) return <span className={`token-icon token-unknown size-${size}`} aria-hidden="true" data-label={symbol} />;
  return <img className="token-icon" src={src} alt="" width={size} height={size} />;
}

export const ChainIcon = ({ chain, size = 22 }: { chain: ChainKey; size?: number }) =>
  <img className="chain-icon" src={CHAIN_SRC[chain]} alt="" width={size} height={size} />;
