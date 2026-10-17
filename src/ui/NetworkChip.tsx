import { useTranslation } from 'react-i18next';
import { NETWORK_ID, networkLabelKey } from '../config/network';

// Which network this page reads (src/config/network.ts), shown in the header of every explorer screen so nobody
// mistakes testnet balances for real ones. Not on i-Wallet screens: the i-Wallet is always on mainnet.
export function NetworkChip() {
  const { t } = useTranslation();
  return (
    <span className="net-row">
      <span className={`net-chip net-chip-${NETWORK_ID}`} data-network={NETWORK_ID}>
        <span className="net-chip-dot" aria-hidden="true" />
        {t(networkLabelKey(NETWORK_ID))}
      </span>
    </span>
  );
}
