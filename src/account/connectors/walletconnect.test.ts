import { describe, expect, it } from 'vitest';
import { wcNamespaces } from './walletconnect';

describe('walletconnect namespaces', () => {
  it('requests accounts only — never a signing method', () => {
    const ns = wcNamespaces();
    expect(ns.polkadot.methods).toEqual([]);
    expect(ns.polkadot.chains).toEqual([
      'polkadot:1b0b4727bbb5e44ed587d1056b4ad537',
      'polkadot:063f739077881df9f291548de301b2e1',
      'polkadot:c72b38f36affaeb2661018b201c2be02',
    ]);
  });
});
