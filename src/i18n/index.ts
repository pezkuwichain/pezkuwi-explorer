import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { storage } from '../lib/storage';
import kmr from './locales/kmr.json';
import ckb from './locales/ckb.json';
import tr from './locales/tr.json';
import en from './locales/en.json';
import fa from './locales/fa.json';
import ar from './locales/ar.json';

export const LOCALES = ['kmr', 'ckb', 'tr', 'en', 'fa', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
const RTL = new Set<string>(['ckb', 'fa', 'ar']);
export const isRtl = (lang: string) => RTL.has(lang);

const saved = storage.get('lang');
const initial: Locale = (LOCALES as readonly string[]).includes(saved ?? '') ? (saved as Locale) : 'kmr';

void i18n.use(initReactI18next).init({
  resources: { kmr: { t: kmr }, ckb: { t: ckb }, tr: { t: tr }, en: { t: en }, fa: { t: fa }, ar: { t: ar } },
  lng: initial,
  fallbackLng: 'kmr',
  defaultNS: 't',
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: Locale) {
  void i18n.changeLanguage(lang);
  storage.set('lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = isRtl(lang) ? 'rtl' : 'ltr';
}
export default i18n;
