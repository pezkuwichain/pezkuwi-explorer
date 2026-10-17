import type { LegalDoc } from './types';

// Owner-approved draft (Serok, 2026-10-17), verbatim: res/explorer/legal-drafts-2026-10-17.md.
const doc: LegalDoc = {
  title: 'Gizlilik',
  scope: 'explorer.pezkuwichain.io ve i-Wallet',
  updated: 'Son güncelleme: 17 Ekim 2026',
  intro: [
    { p: "Bu bildirim explorer.pezkuwichain.io'yu kapsar; i-Wallet sekmesi ve kısa adres cuzdan.pex.network dahil. Burada yer almayan konularda pezkuwichain.io/en/privacy adresindeki PezkuwiChain Gizlilik Politikası geçerlidir. İletişim: privacy@pezkuwichain.io." },
  ],
  sections: [
    {
      heading: '1. Neyi toplamıyoruz.',
      blocks: [{ p: "Explorer'da kullanıcı hesabı, analitik, reklam ya da izleme çerezi yoktur. E-posta, telefon numarası veya konum istemeyiz." }],
    },
    {
      heading: '2. Cihazında kalanlar.',
      blocks: [
        { p: 'Aşağıdakiler yalnız cihazındaki tarayıcı deposunda tutulur ve bize asla gönderilmez:' },
        { ul: [
          'dil, tema ve ağ tercihlerin;',
          'açtığın adres;',
          "i-Wallet'ta şifreli anahtarın, şifreli yedek kelimelerin ve isteğe bağlı Face ID kaydın;",
          'vatandaşlık formuna yazdığın ad ve referans.',
        ] },
        { p: 'Tarayıcının site verisini silmek bunları siler. Bunları geri getiremeyiz.' },
      ],
    },
    {
      heading: '3. Bağlandığın ağların görebildikleri.',
      blocks: [
        { p: 'Bakiyeleri göstermek ve işlem göndermek için tarayıcın doğrudan şunlara bağlanır:' },
        { ul: [
          'PezkuwiChain düğümleri (rpc, asset-hub-rpc, people-rpc ve Zagros test düğümleri);',
          "subquery.pezkuwichain.io'daki geçmiş indeksleyicisi.",
        ] },
        { p: 'Her web sunucusu gibi bunlar da IP adresini ve yaptığın istekleri, sorguladığın adresler dahil, görür. Bu kayıtları yalnız hizmeti çalıştırmak ve korumak için kullanırız; 14 gün sonra otomatik olarak silinirler.' },
        { p: 'Pezkuwi Wallet uygulamasıyla WalletConnect üzerinden giriş yaparsan bağlantı, üçüncü taraf olan WalletConnect aktarıcısından geçer ve onun gizlilik koşullarına tabidir.' },
      ],
    },
    {
      heading: '4. Blokzincirde herkese açık olanlar.',
      blocks: [{ p: 'Gönderdiğin işlemler, blokzincirin doğası gereği herkese açık ve kalıcıdır; vatandaşlık başvurusu da buna dahildir. Vatandaşlıkta i-Wallet zincire yalnızca adından, adresinden ve cihazında saklanan rastgele bir değerden üretilen tek yönlü bir kod yazar. Bu koddan adın geri okunamaz; adın da cihazından hiç çıkmaz.' }],
    },
    {
      heading: '5. Hakların.',
      blocks: [{ p: "Kısa ömürlü kayıtlar dışında sunucularımızda senin hakkında kişisel veri tutmadığımız için çoğu durumda erişilecek, düzeltilecek ya da silinecek bir şey yoktur. Her talep ve soru için privacy@pezkuwichain.io adresine yaz. AB/AEA'da ya da Birleşik Krallık'taysan kendi veri koruma otoritene de şikâyette bulunabilirsin." }],
    },
    {
      heading: '6. Değişiklikler.',
      blocks: [{ p: 'Değişiklikleri bu sayfada yeni tarihle yayımlarız.' }],
    },
  ],
};
export default doc;
