import type { Activity } from '../data/history';
import { Amount } from './Layout';

// A transaction that moved no funds shows what it was (pallet · call), never "0 HEZ". An asset the network config
// does not know has no decimals: its symbol only, never a guessed amount.
export const ActivityAmount = ({ a }: { a: Activity }) =>
  a.call ? <bdi dir="ltr" className="call-name">{a.call.replace('.', ' · ')}</bdi>
    : a.decimals === null ? <bdi dir="ltr">{a.symbol}</bdi> : <Amount value={a.amount} decimals={a.decimals} symbol={a.symbol} />;
