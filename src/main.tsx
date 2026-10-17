import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import i18n, { setLanguage, type Locale } from './i18n';
import './ui/theme.css';
import './ui/components.css';
import App from './App';
import { startTheme } from './ui/theme';
import { markWalletBrowser } from './ui/walletBrowser';
import { startInstallCapture } from './ui/install';

// Before anything renders: Chromium may fire beforeinstallprompt early, and a missed event is not sent again.
startInstallCapture();
setLanguage(i18n.language as Locale);
startTheme();
markWalletBrowser();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
