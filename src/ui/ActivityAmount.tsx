import type { Activity } from '../data/history';
import { Amount } from './Layout';

// An asset the network config does not know has no decimals: show its symbol only, never a guessed amount.
export const ActivityAmount = ({ a }: { a: Activity }) =>
  a.decimals === null ? <bdi dir="ltr">{a.symbol}</bdi> : <Amount value={a.amount} decimals={a.decimals} symbol={a.symbol} />;
