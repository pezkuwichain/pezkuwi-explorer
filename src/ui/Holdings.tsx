import { useTranslation } from 'react-i18next';
import type { Holding } from '../data/balances';
import { HOLDING_CHAINS } from './holdingChains';
import { BigAmount } from './BigAmount';
import { ChainIcon, TokenIcon } from './assetIcons';
import { formatNumber } from '../lib/format';
import './Holdings.css';

// The native total and, when known, where it sits: one tile per chain.
export function HoldingsTotal({ holdings }: { holdings: Holding[] }) {
  const { t, i18n } = useTranslation();
  const native = holdings[0];
  if (!native) return null;
  return (
    <>
      <BigAmount className="total-amount" value={native.amount} decimals={native.decimals} symbol={native.symbol} />
      {native.perChain && <ul className="chains">{HOLDING_CHAINS.map((c) => (
        <li key={c} className="chain-tile">
          <ChainIcon chain={c} />
          <span className="chain-name">{t(`chain.${c}`)}</span>
          <bdi className="chain-amount">{formatNumber(native.perChain![c], native.decimals, i18n.language)}</bdi>
        </li>))}</ul>}
    </>
  );
}

// One row per token: the native token first (on every chain), then the Asset Hub assets with their standard label.
export function HoldingsTokens({ holdings }: { holdings: Holding[] }) {
  const { t, i18n } = useTranslation();
  return (
    <section className="tokens" aria-label={t('account.tokens')}>
      <ul>{holdings.map((h, i) => (
        <li key={h.symbol} className="token-row">
          <TokenIcon symbol={h.symbol} />
          <span className="token-name"><span className="token-symbol">{h.symbol}</span><span className="token-chain">{i === 0 ? 'PezkuwiChain' : h.standard ? `${t('chain.assetHub')} (${h.standard})` : t('chain.assetHub')}</span></span>
          <bdi className="token-amount">{formatNumber(h.amount, h.decimals, i18n.language)}</bdi>
        </li>))}</ul>
    </section>
  );
}
