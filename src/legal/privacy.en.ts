import type { LegalDoc } from './types';

// Owner-approved draft (Serok, 2026-10-17), verbatim: res/explorer/legal-drafts-2026-10-17.md.
const doc: LegalDoc = {
  title: 'Privacy',
  scope: 'explorer.pezkuwichain.io and i-Wallet',
  updated: 'Last updated: 17 October 2026',
  intro: [
    { p: 'This notice covers explorer.pezkuwichain.io, including the i-Wallet tab and the short address cuzdan.pex.network. Matters not covered here are governed by the PezkuwiChain Privacy Policy at pezkuwichain.io/en/privacy. Contact: privacy@pezkuwichain.io.' },
  ],
  sections: [
    {
      heading: '1. What we do not collect.',
      blocks: [{ p: 'The explorer has no user accounts, no analytics, no advertising and no tracking cookies. We do not ask for your e-mail, phone number or location.' }],
    },
    {
      heading: '2. What stays on your device.',
      blocks: [
        { p: "The following are kept only in your browser's storage on your device. They are never sent to us:" },
        { ul: [
          'your language, theme and network choices;',
          'the address you open;',
          'in i-Wallet, your encrypted key, your encrypted backup words and the optional Face ID record;',
          'the name and referrer you type in the citizenship form.',
        ] },
        { p: "Clearing your browser's site data deletes them. We cannot restore them." },
      ],
    },
    {
      heading: '3. What the networks you connect to can see.',
      blocks: [
        { p: 'To show balances and send transactions, your browser connects directly to:' },
        { ul: [
          'PezkuwiChain nodes (rpc, asset-hub-rpc, people-rpc and the Zagros test nodes);',
          'the history indexer at subquery.pezkuwichain.io.',
        ] },
        { p: 'Like any web server, these see your IP address and the requests you make, including the addresses you look up. We use these logs only to run and protect the service. They are deleted automatically after 14 days.' },
        { p: "If you sign in with the Pezkuwi Wallet app through WalletConnect, the connection passes through WalletConnect's relay (a third party), under its own privacy terms." },
      ],
    },
    {
      heading: '4. What becomes public on the blockchain.',
      blocks: [{ p: 'Transactions you send are public and permanent by the nature of a blockchain. This includes the citizenship application. For citizenship, i-Wallet records only a one-way code made from your name, your address and a random value kept on your device. Your name cannot be read back from it, and the name itself never leaves your device.' }],
    },
    {
      heading: '5. Your rights.',
      blocks: [{ p: 'Because we hold no personal data about you on our servers apart from short-lived logs, there is in most cases nothing for us to access, correct or delete. Write to privacy@pezkuwichain.io with any request or question. If you are in the EU/EEA or the UK, you may also complain to your data-protection authority.' }],
    },
    {
      heading: '6. Changes.',
      blocks: [{ p: 'We will post changes on this page with a new date.' }],
    },
  ],
};
export default doc;
