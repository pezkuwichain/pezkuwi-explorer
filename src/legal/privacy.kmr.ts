import type { LegalDoc } from './types';

// Draft translation of privacy.en.ts, awaiting native and legal reading (docs/i18n-review.md, "Privacy and terms").
const doc: LegalDoc = {
  title: 'Nepenîtî',
  scope: 'explorer.pezkuwichain.io û i-Wallet',
  updated: 'Rojanekirina dawî: 17 Cotmeh 2026',
  intro: [
    { p: 'Ev daxuyanî explorer.pezkuwichain.io digire nav xwe, tevî beşa i-Wallet û navnîşana kurt cuzdan.pex.network. Ji bo mijarên ku li vir nehatine gotin, Polîtîkaya Nepenîtiyê ya PezkuwiChain li pezkuwichain.io/en/privacy derbasdar e. Têkilî: privacy@pezkuwichain.io.' },
  ],
  sections: [
    {
      heading: '1. Tiştên ku em berhev nakin.',
      blocks: [{ p: 'Di Pezkuwi Explorer de hesabên bikarhêneran, analîtîk, reklam û cookieyên şopandinê tune ne. Em e-mail, hejmara telefonê an cihê te ji te naxwazin.' }],
    },
    {
      heading: '2. Tiştên ku li ser cîhaza te dimînin.',
      blocks: [
        { p: 'Ev tişt tenê di geroka te de, li ser cîhaza te, têne tomarkirin. Ew qet ji me re nayên şandin:' },
        { ul: [
          'hilbijartinên te yên ziman, tema û torê;',
          'navnîşana ku tu vedikî;',
          'di i-Wallet de, mifteya te ya şîfrekirî, peyvên te yên vegerandinê yên şîfrekirî û tomara Face ID ya bijarteyî;',
          'nav û referansa ku tu di forma welatîbûnê de dinivîsî.',
        ] },
        { p: 'Heke tu daneyên malperê di geroka xwe de jê bibî, ev tişt jî tên jêbirin. Em nikarin wan vegerînin.' },
      ],
    },
    {
      heading: '3. Torên ku tu bi wan ve girêdidî çi dibînin.',
      blocks: [
        { p: 'Ji bo nîşandana balansan û şandina danûstandinan, geroka te rasterast bi van re girêdide:' },
        { ul: [
          'nodên PezkuwiChain (rpc, asset-hub-rpc, people-rpc û nodên ceribandinê yên Zagros);',
          'indexera dîrokê li subquery.pezkuwichain.io.',
        ] },
        { p: 'Wek her serverekî webê, ev jî navnîşana IP ya te û daxwazên ku tu dikî dibînin, tevî navnîşanên ku tu lê digerî. Em van tomaran tenê ji bo xebitandin û parastina xizmetê bi kar tînin. Ew piştî 14 rojan bi awayekî xweber têne jêbirin.' },
        { p: 'Heke tu bi sepana Pezkuwi Wallet bi rêya WalletConnect têkevî, girêdan di ser servera navberê ya WalletConnect (aliyê sêyem) re derbas dibe, û şertên wê yên nepenîtiyê derbasdar in.' },
      ],
    },
    {
      heading: '4. Tiştên ku li ser blokzincîrê ji her kesî re vekirî ne.',
      blocks: [{ p: 'Danûstandinên ku tu dişînî, ji ber xwezaya blokzincîrê, ji her kesî re vekirî û herdemî ne. Serlêdana welatîbûnê jî tê de ye. Ji bo welatîbûnê, i-Wallet li ser zincîrê tenê kodekê tomar dike ku ji navê te, navnîşana te û nirxekî rasthatî yê li ser cîhaza te tê hilanîn hatiye çêkirin. Navê te ji vê kodê nayê xwendin, û nav bi xwe qet ji cîhaza te dernakeve.' }],
    },
    {
      heading: '5. Mafên te.',
      blocks: [{ p: 'Ji ber ku ji xeynî tomarên kurt-demî em tu daneyên te yên kesane li ser serverên xwe hilnagirin, di piraniya rewşan de tiştek tune ye ku em nîşanî te bidin, rast bikin an jê bibin. Ji bo her daxwaz an pirsê ji privacy@pezkuwichain.io re binivîse. Heke tu li Yekîtiya Ewropayê (EU/EEA) an Keyaniya Yekbûyî (UK) yî, tu dikarî gilî jî bidî desthilata parastina daneyan a welatê xwe.' }],
    },
    {
      heading: '6. Guhertin.',
      blocks: [{ p: 'Em ê guhertinan li ser vê rûpelê bi dîrokeke nû biweşînin.' }],
    },
  ],
};
export default doc;
