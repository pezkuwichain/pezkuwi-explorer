import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { normaliseAddress } from '../lib/address';
import { storage } from '../lib/storage';

type Ctx = { address: string | null; open(address: string): boolean; forget(): void };
const AccountCtx = createContext<Ctx | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(() => normaliseAddress(storage.get('account') ?? ''));
  const open = useCallback((input: string) => {
    const a = normaliseAddress(input);
    if (!a) return false;
    storage.set('account', a);
    setAddress(a);
    return true;
  }, []);
  const forget = useCallback(() => { storage.remove('account'); setAddress(null); }, []);
  return <AccountCtx.Provider value={{ address, open, forget }}>{children}</AccountCtx.Provider>;
}

export function useAccount(): Ctx {
  const c = useContext(AccountCtx);
  if (!c) throw new Error('useAccount outside AccountProvider');
  return c;
}
