import { IconFacebook, IconInstagram, IconTelegram, IconX, IconYouTube } from './icons';

// The same accounts as the dks.news footer (res/explorer/legal-drafts-2026-10-17.md). Brand names, not translated.
export const SOCIAL = [
  { name: 'YouTube', href: 'https://www.youtube.com/@dijitalkurdistan', Icon: IconYouTube },
  { name: 'X', href: 'https://x.com/KuwiPez', Icon: IconX },
  { name: 'Instagram', href: 'https://www.instagram.com/pezkuwichaindks', Icon: IconInstagram },
  { name: 'Facebook', href: 'https://www.facebook.com/1341558285712626', Icon: IconFacebook },
  { name: 'Telegram', href: 'https://t.me/kurdishmedya', Icon: IconTelegram },
] as const;
