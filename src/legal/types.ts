// A legal page as data: the per-language modules (privacy.<lang>.ts, terms.<lang>.ts) hold only text, and
// LegalPage renders every one of them the same way. Addresses and links are written as plain text in the
// paragraphs; the renderer turns the known ones into links (see linkify in LegalPage.tsx).
export type LegalBlock = { p: string } | { ul: string[] };

export interface LegalSection {
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  /** The page title, shown in the one-line page header. */
  title: string;
  /** What the notice covers, under the title. */
  scope: string;
  /** "Last updated: …" in the page's language. */
  updated: string;
  intro: LegalBlock[];
  sections: LegalSection[];
}
