import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconCheck, IconCopy, IconCross } from '../ui/icons';

const COPIED_MS = 2_000;

// Copies the text it is given (an address, a public transaction hash or a referral link; never a secret) to the clipboard
// and says so, or says it failed. With `text` the button shows it beside the icon (and needs no separate label).
export default function CopyAddress({ address, className = 'iw-copy', label, text }: { address: string; className?: string; label?: string; text?: string }) {
  const { t } = useTranslation();
  const [note, setNote] = useState<'copied' | 'copyFailed' | null>(null);
  const [count, setCount] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    let n: 'copied' | 'copyFailed' = 'copied';
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(address);
    } catch { n = 'copyFailed'; }
    clearTimeout(timer.current);
    setNote(n); setCount((c) => c + 1);
    timer.current = setTimeout(() => setNote(null), COPIED_MS);
  };
  return (
    <>
      <button type="button" className={className} onClick={() => void copy()} aria-label={text ? undefined : label ?? t('account.copy')}>
        {note === 'copied' ? <IconCheck size={18} /> : note === 'copyFailed' ? <IconCross size={18} /> : <IconCopy size={18} />}
        {text}
      </button>
      <span className="sr-only" role="status">{note ? t(`account.${note}`) + (count % 2 ? '​' : '') : ''}</span>
    </>
  );
}
