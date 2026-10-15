import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { THEME_MODES, chooseTheme, storedMode, subscribeTheme, type ThemeMode } from './theme';
import { IconCheck, IconMoon, IconSun, IconThemeAuto } from './icons';

const ICON = { auto: IconThemeAuto, light: IconSun, dark: IconMoon } as const;

// The theme switch, ported from dks.news: a round button showing the current mode and a menu of three
// (Auto, Light, Dark) with menuitemradio semantics, arrow/Home/End/Escape keys and outside-tap to close.
export default function ThemePicker() {
  const { t } = useTranslation();
  const mode = useSyncExternalStore(subscribeTheme, storedMode);
  const [open, setOpen] = useState(false);
  const [spun, setSpun] = useState(0);
  const pick = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const focusAt = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const at = focusAt.current ?? THEME_MODES.indexOf(mode);
    items.current[at]?.focus();
    focusAt.current = null;
    const away = (e: PointerEvent) => { if (!pick.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open, mode]);

  const close = (back: boolean) => { setOpen(false); if (back) btn.current?.focus(); };
  const choose = (m: ThemeMode) => { close(true); setSpun((n) => n + 1); chooseTheme(m, btn.current); };
  const onButtonKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusAt.current = THEME_MODES.length - 1; setOpen(true); }
  };
  const onMenuKey = (e: KeyboardEvent) => {
    const n = THEME_MODES.length;
    const i = items.current.indexOf(document.activeElement as HTMLButtonElement);
    const go = (j: number) => { e.preventDefault(); items.current[(j + n) % n]?.focus(); };
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(n - 1);
    else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') close(false);
  };

  const label = `${t('theme.label')}: ${t(`theme.${mode}`)}`;
  const Current = ICON[mode];
  return (
    <div ref={pick} className={`theme-pick${open ? ' is-open' : ''}`}>
      <button
        ref={btn} type="button" className="theme-btn" data-mode={mode} key={spun} data-spun={spun > 0 || undefined}
        aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} aria-controls="theme-menu"
        onClick={() => (open ? close(true) : setOpen(true))} onKeyDown={onButtonKey}
      >
        <Current size={19} />
      </button>
      <div className="theme-menu" id="theme-menu" role="menu" aria-label={t('theme.label')} hidden={!open} onKeyDown={onMenuKey}>
        {THEME_MODES.map((m, i) => {
          const Icon = ICON[m];
          return (
            <button
              key={m} ref={(el) => { items.current[i] = el; }} type="button" role="menuitemradio" tabIndex={-1}
              className="theme-menu-item" aria-checked={m === mode} onClick={() => choose(m)}
            >
              <span className="theme-menu-ic"><Icon size={18} /></span>
              <span className="theme-menu-t">{t(`theme.${m}`)}</span>
              <IconCheck size={16} stroke={2.4} className="theme-menu-ok" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
