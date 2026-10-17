import { Fragment, type ReactNode } from 'react';

export const CONTACT = 'privacy@pezkuwichain.io';

// The addresses the texts name, in every language. The contact becomes a mailto link, the two general policies on
// pezkuwichain.io open in a new tab, and the host names are kept left to right inside right-to-left text.
const TOKENS = /(privacy@pezkuwichain\.io|pezkuwichain\.io\/en\/(?:privacy|terms)|(?:explorer|subquery)\.pezkuwichain\.io|cuzdan\.pex\.network)/;

export function linkify(text: string): ReactNode[] {
  return text.split(TOKENS).map((part, i) => {
    if (i % 2 === 0) return part ? <Fragment key={i}>{part}</Fragment> : null;
    if (part === CONTACT) return <a key={i} href={`mailto:${CONTACT}`}><bdi dir="ltr">{part}</bdi></a>;
    if (part.startsWith('pezkuwichain.io/')) {
      return <a key={i} href={`https://${part}`} target="_blank" rel="noopener"><bdi dir="ltr">{part}</bdi></a>;
    }
    return <bdi key={i} dir="ltr">{part}</bdi>;
  });
}
