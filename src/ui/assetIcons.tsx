import type { ChainKey } from '../config/network';

// Token art from pezkuwi-wallet-utils; wHEZ is HEZ wrapped, so it shares the HEZ mark.
const TOKEN_SRC: Record<string, string> = { HEZ: '/tokens/HEZ.png', wHEZ: '/tokens/HEZ.png', PEZ: '/tokens/PEZ.png', wUSDT: '/tokens/wUSDT.svg' };
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
