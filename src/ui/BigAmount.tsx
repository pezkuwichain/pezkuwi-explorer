import { useTranslation } from 'react-i18next';
import { formatCompact, formatExact, formatNumber } from '../lib/format';

// A display figure: the number large in the display face, the symbol smaller beside it. The full,
// exact amount is the title, so a compact figure (40.2M) can always be read in full.
export function BigAmount({ value, decimals, symbol, compact = false, className = '' }: {
  value: bigint; decimals: number; symbol: string; compact?: boolean; className?: string;
}) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const num = compact ? formatCompact(value, decimals, lang) : formatNumber(value, decimals, lang);
  return (
    <span className={`big-amount ${className}`.trim()} title={formatExact(value, decimals, symbol, lang)}>
      <bdi className="num">{num}</bdi> <span className="sym">{symbol}</span>
    </span>
  );
}
