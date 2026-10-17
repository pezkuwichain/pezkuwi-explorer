import { useTranslation } from 'react-i18next';
import PageHeader from '../ui/PageHeader';
import { legalDoc, type LegalKind } from '.';
import type { LegalBlock } from './types';
import { linkify } from './linkify';
import './legal.css';

function Block({ block }: { block: LegalBlock }) {
  if ('p' in block) return <p>{linkify(block.p)}</p>;
  return <ul>{block.ul.map((item, i) => <li key={i}>{linkify(item)}</li>)}</ul>;
}

// /privacy and /terms: one renderer for every language module (src/legal/<kind>.<lang>.ts).
export default function LegalPage({ kind }: { kind: LegalKind }) {
  const { i18n } = useTranslation();
  const doc = legalDoc(kind, i18n.language);
  return (
    <>
      <PageHeader title={doc.title} />
      <article className="legal" aria-labelledby={`legal-${kind}-scope`}>
        <p className="legal-scope" id={`legal-${kind}-scope`}>{linkify(doc.scope)}</p>
        <p className="legal-updated">{doc.updated}</p>
        {doc.intro.map((b, i) => <Block key={i} block={b} />)}
        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h2>{s.heading}</h2>
            {s.blocks.map((b, i) => <Block key={i} block={b} />)}
          </section>
        ))}
      </article>
    </>
  );
}
