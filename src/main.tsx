import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import i18n, { setLanguage, type Locale } from './i18n';
import './ui/theme.css';
import './ui/components.css';
import App from './App';

setLanguage(i18n.language as Locale);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
