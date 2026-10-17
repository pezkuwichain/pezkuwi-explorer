import type { LegalDoc } from './types';

// Owner-approved draft (Serok, 2026-10-17), verbatim: res/explorer/legal-drafts-2026-10-17.md.
const doc: LegalDoc = {
  title: 'Terms of use',
  scope: 'explorer.pezkuwichain.io and i-Wallet',
  updated: 'Last updated: 17 October 2026',
  intro: [
    { p: 'These terms add to the PezkuwiChain Terms of Service at pezkuwichain.io/en/terms. By using the explorer or i-Wallet you accept both.' },
  ],
  sections: [
    {
      heading: '1. A non-custodial tool.',
      blocks: [{ p: 'The explorer only reads public blockchain data. i-Wallet creates and keeps your key in your own browser. We never hold, see or control your key, your backup words or your funds, and we cannot reverse, stop or recover a transaction.' }],
    },
    {
      heading: '2. Your backup words are the only recovery.',
      blocks: [{ p: 'If you lose your 12 or 24 backup words and your browser data is cleared, your wallet is lost for good. Nobody, including us, can restore it. Never share your words. We will never ask for them.' }],
    },
    {
      heading: '3. A hot wallet, for small amounts.',
      blocks: [{ p: 'i-Wallet is a temporary service for iPhone users until the Pezkuwi Wallet is available on the App Store. A key kept in a browser is exposed to the risks of the device and the browser. Use i-Wallet for small transfers and citizenship work only. For larger or critical amounts, use the Pezkuwi Wallet on Android, or wait for the App Store release.' }],
    },
    {
      heading: '4. Test network.',
      blocks: [{ p: 'The Zagros network is a test network: its tokens have no value and it may be reset at any time.' }],
    },
    {
      heading: '5. As is.',
      blocks: [
        { p: 'The explorer and i-Wallet are provided "as is" and "as available", without warranties of any kind. To the extent the law allows, we are not liable for:' },
        { ul: [
          'losses from lost words or a lost device;',
          'losses from transactions you sign, or from network outages;',
          'losses on the Zagros test network;',
          'losses from errors in third-party services.',
        ] },
      ],
    },
    {
      heading: '6. Your responsibilities.',
      blocks: [{ p: 'Check the recipient, the network and the amount before you confirm. You are responsible for complying with the laws that apply to you.' }],
    },
    {
      heading: '7. Changes and contact.',
      blocks: [{ p: 'We may change these terms by posting a new version here. Questions: privacy@pezkuwichain.io.' }],
    },
  ],
};
export default doc;
