import type { LegalDoc } from './types';
import privacyEn from './privacy.en';
import privacyTr from './privacy.tr';
import privacyKmr from './privacy.kmr';
import privacyCkb from './privacy.ckb';
import privacyFa from './privacy.fa';
import privacyAr from './privacy.ar';
import termsEn from './terms.en';
import termsTr from './terms.tr';
import termsKmr from './terms.kmr';
import termsCkb from './terms.ckb';
import termsFa from './terms.fa';
import termsAr from './terms.ar';

export type LegalKind = 'privacy' | 'terms';

// EN and TR are the owner-approved texts; kmr, ckb, fa and ar are drafts awaiting native and legal reading.
// The long text lives here, not in the locale JSON files.
export const LEGAL: Record<LegalKind, Partial<Record<string, LegalDoc>>> = {
  privacy: { en: privacyEn, tr: privacyTr, kmr: privacyKmr, ckb: privacyCkb, fa: privacyFa, ar: privacyAr },
  terms: { en: termsEn, tr: termsTr, kmr: termsKmr, ckb: termsCkb, fa: termsFa, ar: termsAr },
};

// English stands in only for a language that has no module.
export const legalDoc = (kind: LegalKind, lang: string): LegalDoc => LEGAL[kind][lang] ?? LEGAL[kind].en!;
