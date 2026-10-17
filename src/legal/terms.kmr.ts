import type { LegalDoc } from './types';

// Draft translation of terms.en.ts, awaiting native and legal reading (docs/i18n-review.md, "Privacy and terms").
const doc: LegalDoc = {
  title: 'Şertên bikaranînê',
  scope: 'explorer.pezkuwichain.io û i-Wallet',
  updated: 'Rojanekirina dawî: 17 Cotmeh 2026',
  intro: [
    { p: 'Ev şert li Şertên Karûbarê yên PezkuwiChain li pezkuwichain.io/en/terms zêde dibin. Bi bikaranîna Pezkuwi Explorer an i-Wallet, tu herduyan jî dipejirînî.' },
  ],
  sections: [
    {
      heading: '1. Amûrek ku mifte û pereyên te li cem xwe nagire.',
      blocks: [{ p: 'Pezkuwi Explorer tenê daneyên giştî yên blokzincîrê dixwîne. i-Wallet mifteya te di geroka te bi xwe de çêdike û li wir diparêze. Em qet mifteya te, peyvên te yên vegerandinê an pereyên te li cem xwe nagirin, nabînin û kontrol nakin, û em nikarin danûstandinekê paşve bibin, rawestînin an vegerînin.' }],
    },
    {
      heading: '2. Tenê peyvên te yên vegerandinê cuzdanê te vedigerînin.',
      blocks: [{ p: 'Heke tu 12 an 24 peyvên xwe yên vegerandinê winda bikî û daneyên geroka te werin jêbirin, cuzdanê te bi temamî winda dibe. Tu kes, em jî tê de, nikare wî vegerîne. Peyvên xwe qet bi tu kesî re parve neke. Em qet wan ji te naxwazin.' }],
    },
    {
      heading: '3. Cuzdanê germ, ji bo mîqdarên piçûk.',
      blocks: [{ p: 'i-Wallet heta ku Pezkuwi Wallet di App Store de peyda bibe, xizmeteke demkî ye ji bo bikarhênerên iPhone. Mifteyeke ku di gerokê de tê hilanîn li ber xeterên cîhazê û gerokê vekirî ye. i-Wallet tenê ji bo şandinên piçûk û karên welatîbûnê bi kar bîne. Ji bo mîqdarên mezintir an girîng, Pezkuwi Wallet li ser Android bi kar bîne, an li benda guhertoya App Store bimîne.' }],
    },
    {
      heading: '4. Tora ceribandinê.',
      blocks: [{ p: 'Tora Zagros tora ceribandinê ye: tokenên wê bê nirx in û dibe ku ew her dem ji nû ve were destpêkirin.' }],
    },
    {
      heading: '5. Wek ku heye.',
      blocks: [
        { p: 'Pezkuwi Explorer û i-Wallet "wek ku heye" û "wek ku berdest e", bê tu garantî têne pêşkêşkirin. Heta ku yasa destûrê dide, em ne berpirsyar in ji:' },
        { ul: [
          'ziyanên ji ber peyvên winda an cîhaza winda;',
          'ziyanên ji ber danûstandinên ku tu îmze dikî, an ji ber qutbûna torê;',
          'ziyanên li ser tora ceribandinê ya Zagros;',
          'ziyanên ji ber xeletiyên di xizmetên aliyên sêyem de.',
        ] },
      ],
    },
    {
      heading: '6. Berpirsyariyên te.',
      blocks: [{ p: 'Berî ku tu bipejirînî, wergir, tor û mîqdarê kontrol bike. Tu berpirsyar î ku li gorî yasayên ku li ser te derbasdar in tevbigerî.' }],
    },
    {
      heading: '7. Guhertin û têkilî.',
      blocks: [{ p: 'Em dikarin van şertan bi weşandina guhertoyeke nû li vir biguherînin. Pirs: privacy@pezkuwichain.io.' }],
    },
  ],
};
export default doc;
