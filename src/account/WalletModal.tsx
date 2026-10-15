import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CHROME_STORE, PLAY_STORE, useAccount, type WalletAccount } from './AccountContext';
import { WalletConnectModal } from './WalletConnectModal';
import { useIsMobile } from '../hooks/useIsMobile';
import { shortAddress } from '../lib/address';
import { Dialog } from '../ui/Dialog';
import { IconBrowser, IconCheck, IconCopy, IconCross, IconExternal, IconLoader, IconLogOut, IconPhone, IconWallet } from '../ui/icons';
import './wallet.css';

// Port of pwap web/src/components/wallet/WalletModal.tsx. Not connected: the browser extension and the mobile
// wallet (a phone gets the mobile wallet only). Errors in pwap's three kinds, each with its way on. Connected:
// name, address with copy, where it came from, Disconnect, and the other accounts when the wallet shared more.
// Left out: pwap's four on-chain scores and "View on explorer" (this is the explorer).
const COPIED_MS = 2000;

// The copy button: a check for two seconds after a copy (pwap), a cross when the browser would not copy.
function CopyButton({ address }: { address: string }) {
  const { t } = useTranslation();
  const [note, setNote] = useState<'copied' | 'copyFailed' | null>(null);
  const [count, setCount] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    let n: 'copied' | 'copyFailed' = 'copied';
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(address);
    } catch { n = 'copyFailed'; }
    clearTimeout(timer.current);
    setNote(n);
    setCount((c) => c + 1);
    timer.current = setTimeout(() => setNote(null), COPIED_MS);
  };
  return (
    <>
      <button type="button" className={`wallet-icon-btn${note === 'copyFailed' ? ' is-bad' : note ? ' is-ok' : ''}`} onClick={() => void copy()} aria-label={t('account.copy')}>
        {note === 'copied' ? <IconCheck size={18} /> : note === 'copyFailed' ? <IconCross size={18} /> : <IconCopy size={18} />}
      </button>
      {/* Each copy changes the live text (an invisible mark alternates), so a second copy is announced again. */}
      <span className="sr-only" role="status">{note ? t(`account.${note}`) + (count % 2 ? '\u200B' : '') : ''}</span>
    </>
  );
}

const accountName = (a: WalletAccount | undefined, unnamed: string) => a?.name || unnamed;

export function WalletModal({ isOpen, onClose }: { isOpen: boolean; onClose(): void }) {
  const { t } = useTranslation();
  const { address, source, accounts, wcPeerName, error, connectWallet, selectAccount, forget } = useAccount();
  const isMobile = useIsMobile();
  const [showWCModal, setShowWCModal] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const selected = address ? (accounts.find((a) => a.address === address) ?? { address, name: null, source: null }) : null;
  const errorText = error ? (error.key ? t(error.key) : error.message) : null;

  const handleConnect = async () => {
    setIsConnecting(true);
    try { await connectWallet(); } finally { setIsConnecting(false); }
  };
  const handleSelectAccount = (a: WalletAccount) => { selectAccount(a.address); onClose(); };
  const handleDisconnect = () => { forget(); onClose(); };

  const sourceLine = source === 'walletconnect'
    ? <><IconPhone size={14} />WalletConnect{wcPeerName ? ` (${wcPeerName})` : ''}</>
    : source === 'address' ? t('walletModal.address') : (selected?.source || 'pezkuwi');

  return (
    <>
      <Dialog open={isOpen} onClose={onClose} icon={<IconWallet size={20} />}
        title={selected ? t('walletModal.connected') : t('walletModal.connect')}
        description={selected ? t('walletModal.manageAccount') : t('walletModal.connectDesc')}>

        {/* Extension installed but not authorised. */}
        {error?.kind === 'authorize' && (
          <div className="wallet-stack">
            <p className="wallet-note wallet-note-plain" role="alert">{errorText}</p>
            <button type="button" className="btn btn-primary" onClick={() => void handleConnect()}>
              <IconWallet size={18} />{t('walletModal.tryAgain')}
            </button>
          </div>
        )}

        {/* No extension installed. */}
        {error?.kind === 'notFound' && (
          <div className="wallet-stack">
            <p className="wallet-note wallet-note-zer" role="alert">{errorText}</p>
            <a className="btn btn-primary" href={CHROME_STORE} target="_blank" rel="noopener noreferrer">
              <IconBrowser size={18} />{t('walletModal.installChrome')}
            </a>
            <p className="wallet-small wallet-center">{t('walletModal.afterInstall')}</p>
          </div>
        )}

        {/* Any other error. */}
        {error?.kind === 'generic' && (
          <div className="wallet-stack">
            <p className="wallet-note wallet-note-bad" role="alert">{errorText}</p>
            <button type="button" className="btn btn-primary" onClick={() => void handleConnect()} disabled={isConnecting}>
              {isConnecting
                ? <><IconLoader size={18} />{t('walletModal.connectingExtension')}</>
                : <><IconWallet size={18} />{t('walletModal.tryAgain')}</>}
            </button>
          </div>
        )}

        {/* Connected. */}
        {selected && !error && (
          <div className="wallet-stack">
            <dl className="wallet-facts">
              <div>
                <dt>{t('walletModal.accountName')}</dt>
                <dd className="wallet-name">{accountName(selected, t('walletModal.unnamed'))}</dd>
              </div>
              <div>
                <dt>{t('walletModal.address')}</dt>
                <dd className="wallet-address-row">
                  <code className="wallet-mono" dir="ltr" title={selected.address}>{shortAddress(selected.address)}</code>
                  <CopyButton address={selected.address} />
                </dd>
              </div>
              <div>
                <dt>{t('walletModal.source')}</dt>
                <dd className="wallet-source">{sourceLine}</dd>
              </div>
            </dl>

            <button type="button" className="btn btn-quiet wallet-disconnect" onClick={handleDisconnect}>
              <IconLogOut size={18} />{t('walletModal.disconnect')}
            </button>

            {accounts.length > 1 && (
              <div className="wallet-stack wallet-tight">
                <p className="wallet-label">{t('walletModal.switchAccount')}</p>
                <div className="wallet-list">
                  {accounts.map((a) => (
                    <button type="button" key={a.address} onClick={() => handleSelectAccount(a)}
                      className={`wallet-account${a.address === selected.address ? ' is-current' : ''}`} aria-current={a.address === selected.address || undefined}>
                      <span className="wallet-account-name">{accountName(a, t('walletModal.unnamed'))}</span>
                      <code className="wallet-mono wallet-small" dir="ltr">{shortAddress(a.address)}</code>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Not connected. */}
        {!selected && !error && (
          <div className="wallet-stack">
            {/* The browser extension: desktop only (an extension cannot be installed on a phone). */}
            {!isMobile && (
              <section className="wallet-card" aria-labelledby="wallet-ext-title">
                <div className="wallet-card-head">
                  <span className="wallet-card-icon is-kesk" aria-hidden="true"><IconBrowser size={22} /></span>
                  <div>
                    <h3 id="wallet-ext-title" className="wallet-card-title">{t('walletModal.extensionTitle')}</h3>
                    <p className="wallet-small">{t('walletModal.extensionDesc')}</p>
                  </div>
                </div>
                <button type="button" className="btn btn-primary wallet-btn" onClick={() => void handleConnect()} disabled={isConnecting}>
                  {isConnecting
                    ? <><IconLoader size={18} />{t('walletModal.connectingExtension')}</>
                    : <><IconWallet size={18} />{t('walletModal.extensionConnect')}</>}
                </button>
                <a className="wallet-link" href={CHROME_STORE} target="_blank" rel="noopener noreferrer"><IconExternal size={14} />{t('walletModal.extensionGet')}</a>
              </section>
            )}

            {/* The mobile wallet, over WalletConnect. */}
            <section className="wallet-card" aria-labelledby="wallet-mobile-title">
              <div className="wallet-card-head">
                <span className="wallet-card-icon is-zer" aria-hidden="true"><IconPhone size={22} /></span>
                <div>
                  <h3 id="wallet-mobile-title" className="wallet-card-title">{t('walletModal.mobileTitle')}</h3>
                  <p className="wallet-small">{t('walletModal.mobileDesc')}</p>
                </div>
              </div>
              <button type="button" className="btn btn-quiet wallet-btn" onClick={() => setShowWCModal(true)}>
                <IconPhone size={18} />{t('walletModal.mobileConnect')}
              </button>
              <a className="wallet-link" href={PLAY_STORE} target="_blank" rel="noopener noreferrer"><IconExternal size={14} />{t('walletModal.mobilePlayStore')}</a>
            </section>
          </div>
        )}
      </Dialog>

      <WalletConnectModal
        isOpen={showWCModal}
        onClose={() => {
          setShowWCModal(false);
          // Connected over WalletConnect: the main dialog closes too.
          if (address) onClose();
        }}
      />
    </>
  );
}

// The one WalletModal of the app, opened from anywhere through useAccount().openWalletModal().
export function WalletModalHost() {
  const { walletModalOpen, closeWalletModal } = useAccount();
  return <WalletModal isOpen={walletModalOpen} onClose={closeWalletModal} />;
}
