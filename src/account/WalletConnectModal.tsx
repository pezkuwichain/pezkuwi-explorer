import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccount, PLAY_STORE } from './AccountContext';
import { deepLinkFor, followDeepLink, WC_CONNECTED } from './connectors/walletconnect';
import { qrModules } from '../citizen/qr';
import { useIsMobile } from '../hooks/useIsMobile';
import { shortAddress } from '../lib/address';
import { Dialog } from '../ui/Dialog';
import { IconCheckCircle, IconExternal, IconFailed, IconLoader, IconPhone } from '../ui/icons';
import './wallet.css';

// Port of pwap web/src/components/wallet/WalletConnectModal.tsx: generating → waiting → connected (closes after
// 1.5 s) or error with Try again; a pairing nobody approves times out after five minutes.
export const CONNECTION_TIMEOUT_MS = 5 * 60 * 1000;
export const CONNECTED_CLOSE_MS = 1500;

type ConnectionState = 'generating' | 'waiting' | 'connected' | 'error';

// The pairing as a QR for a wallet on another device: drawn on the device as an SVG path (the CSP allows no
// remote images), dark modules on a white quiet zone so any wallet camera reads it in either theme.
function PairingQr({ uri }: { uri: string }) {
  const qr = useMemo(() => qrModules(uri), [uri]);
  const pad = 4;
  const side = qr.size + pad * 2;
  return (
    <div className="wc-qr">
      <svg viewBox={`${-pad} ${-pad} ${side} ${side}`} role="img" aria-label="WalletConnect QR Code" shapeRendering="crispEdges">
        <rect x={-pad} y={-pad} width={side} height={side} fill="#FFFFFF" />
        <path fill="#04060E" d={qr.path} />
      </svg>
    </div>
  );
}

export function WalletConnectModal({ isOpen, onClose }: { isOpen: boolean; onClose(): void }) {
  const { t } = useTranslation();
  const { connectWalletConnect, cancelWalletConnect, address, wcPeerName, error } = useAccount();
  const isMobile = useIsMobile();
  const [wcUri, setWcUri] = useState('');
  const [connectionState, setConnectionState] = useState<ConnectionState>('generating');
  const [errorMsg, setErrorMsg] = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectedRef = useRef(false);
  // Each start has a number; a start that a newer one (Try again, or StrictMode's replay) replaced is ignored.
  const runRef = useRef(0);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  const clearConnectionTimeout = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  const startConnection = useCallback(async () => {
    const run = ++runRef.current;
    setConnectionState('generating');
    setErrorMsg('');
    setWcUri('');
    connectedRef.current = false;
    clearConnectionTimeout();
    try {
      const uri = await connectWalletConnect();
      if (run !== runRef.current) return;
      // Only a WalletConnect pairing URI is ever shown or followed.
      if (!uri.startsWith('wc:')) throw new Error('');
      setWcUri(uri);
      timeoutRef.current = setTimeout(() => {
        if (!connectedRef.current && run === runRef.current) {
          setConnectionState('error');
          setErrorMsg(t('walletModal.wcTimeout'));
        }
      }, CONNECTION_TIMEOUT_MS);
      // Phone: open Pezkuwi Wallet on this device at once. Desktop: the QR for a wallet on another device.
      if (isMobile) followDeepLink(deepLinkFor(uri));
      setConnectionState('waiting');
    } catch (err) {
      if (run !== runRef.current) return;
      clearConnectionTimeout();
      setConnectionState('error');
      setErrorMsg(err instanceof Error && err.message ? err.message : t('walletModal.errConnection'));
    }
  }, [connectWalletConnect, isMobile, clearConnectionTimeout, t]);

  // The connected listener is registered before the start, so an approval can never be missed.
  useEffect(() => {
    if (!isOpen) return;
    let closer: ReturnType<typeof setTimeout> | undefined;
    const handleConnected = () => {
      connectedRef.current = true;
      clearConnectionTimeout();
      setConnectionState('connected');
      closer = setTimeout(() => closeRef.current(), CONNECTED_CLOSE_MS);
    };
    window.addEventListener(WC_CONNECTED, handleConnected);
    void startConnection();
    return () => {
      window.removeEventListener(WC_CONNECTED, handleConnected);
      clearTimeout(closer);
      clearConnectionTimeout();
      // A pairing left without an approval is cancelled; one already approved is unaffected.
      if (!connectedRef.current) cancelWalletConnect();
      runRef.current += 1;
      setWcUri('');
      setConnectionState('generating');
      connectedRef.current = false;
    };
    // Started once per opening, as in pwap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // A refusal in the wallet ends the wait at once (pwap keeps waiting until the five-minute timeout).
  useEffect(() => {
    if (!isOpen || connectionState !== 'waiting' || !error?.key?.startsWith('walletModal.errWc')) return;
    clearConnectionTimeout();
    setConnectionState('error');
    setErrorMsg(t(error.key));
  }, [error, isOpen, connectionState, clearConnectionTimeout, t]);

  const handleOpenPezWallet = () => { if (wcUri) followDeepLink(deepLinkFor(wcUri)); };

  return (
    <Dialog open={isOpen} onClose={onClose} icon={<IconPhone size={20} />} title="WalletConnect"
      description={isMobile ? t('walletModal.wcOpenWallet') : t('walletModal.wcScanQR')}>
      <div className="wc-body">
        {connectionState === 'generating' && (
          <div className="wc-state" role="status">
            <IconLoader size={32} className="wc-spinner" />
            <p className="wc-muted">{t('walletModal.wcGenerating')}</p>
          </div>
        )}

        {connectionState === 'waiting' && (isMobile ? (
          <div className="wc-state wc-mobile">
            <span className="wc-phone" aria-hidden="true"><IconPhone size={32} /></span>
            <p className="wc-muted wc-center">{t('walletModal.wcWaitingMobile')}</p>
            <p className="wc-waiting" role="status"><IconLoader size={16} />{t('walletModal.wcWaiting')}</p>
            <button type="button" className="btn btn-primary wallet-wide" onClick={handleOpenPezWallet}>
              <IconExternal size={18} />{t('walletModal.wcOpenApp')}
            </button>
            <a className="wallet-link" href={PLAY_STORE} target="_blank" rel="noopener noreferrer">{t('walletModal.wcInstallHint')}</a>
          </div>
        ) : (
          <>
            {wcUri && <PairingQr uri={wcUri} />}
            <p className="wc-waiting" role="status"><IconLoader size={16} />{t('walletModal.wcWaiting')}</p>
            <p className="wc-small wc-center">{t('walletModal.wcInstructions')}</p>
          </>
        ))}

        {connectionState === 'connected' && (
          <div className="wc-state" role="status">
            <IconCheckCircle size={48} className="wc-ok" />
            <p className="wc-ok-text">{t('walletModal.wcConnected')}</p>
            {wcPeerName && <p className="wc-muted">{wcPeerName}</p>}
            {address && <code className="wc-small wallet-mono" dir="ltr">{shortAddress(address)}</code>}
          </div>
        )}

        {connectionState === 'error' && (
          <div className="wc-state">
            <IconFailed size={48} className="wc-bad" />
            <p className="wc-bad-text" role="alert">{errorMsg}</p>
            <button type="button" className="btn btn-quiet" onClick={() => void startConnection()}>{t('walletModal.wcRetry')}</button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
