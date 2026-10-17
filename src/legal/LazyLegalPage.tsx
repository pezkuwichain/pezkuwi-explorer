import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import type { LegalKind } from '.';

// The pages carry six languages of long text: they load on first visit only, so the main bundle stays under the
// service worker's 2 MiB precache limit (vite-plugin-pwa) and the first screen does not wait for them.
const LegalPage = lazy(() => import('./LegalPage'));

export default function LazyLegalPage({ kind }: { kind: LegalKind }) {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<p className="card-note" role="status">{t('state.loading')}</p>}>
      <LegalPage kind={kind} />
    </Suspense>
  );
}
