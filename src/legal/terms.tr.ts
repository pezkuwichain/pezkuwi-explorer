import type { LegalDoc } from './types';

// Owner-approved draft (Serok, 2026-10-17), verbatim: res/explorer/legal-drafts-2026-10-17.md.
const doc: LegalDoc = {
  title: 'Kullanım koşulları',
  scope: 'explorer.pezkuwichain.io ve i-Wallet',
  updated: 'Son güncelleme: 17 Ekim 2026',
  intro: [
    { p: "Bu koşullar pezkuwichain.io/en/terms adresindeki PezkuwiChain Hizmet Koşulları'na eklenir. Explorer'ı ya da i-Wallet'ı kullanarak ikisini birden kabul etmiş olursun." },
  ],
  sections: [
    {
      heading: '1. Emanet tutmayan bir araç.',
      blocks: [{ p: 'Explorer yalnızca herkese açık blokzincir verisini okur. i-Wallet anahtarını kendi tarayıcında oluşturur ve orada saklar. Anahtarını, yedek kelimelerini ya da fonlarını asla tutmayız, göremeyiz, kontrol edemeyiz. Bir işlemi geri alamaz, durduramaz, kurtaramayız.' }],
    },
    {
      heading: '2. Tek kurtarma yolu yedek kelimelerin.',
      blocks: [{ p: '12 ya da 24 yedek kelimeni kaybedersen ve tarayıcı verin silinirse cüzdanın kalıcı olarak kaybolur. Biz dahil kimse onu geri getiremez. Kelimelerini kimseyle paylaşma; biz onları asla istemeyiz.' }],
    },
    {
      heading: '3. Küçük tutarlar için sıcak cüzdan.',
      blocks: [{ p: "i-Wallet, Pezkuwi Wallet App Store'da yayınlanana kadar iPhone kullanıcılarına sunulan geçici bir hizmettir. Tarayıcıda saklanan anahtar, cihazın ve tarayıcının risklerine açıktır. i-Wallet'ı yalnızca küçük transferler ve vatandaşlık işleri için kullan. Yüksek tutarlı ya da kritik işler için Android'de Pezkuwi Wallet'ı kullan ya da App Store sürümünü bekle." }],
    },
    {
      heading: '4. Test ağı.',
      blocks: [{ p: 'Zagros bir test ağıdır: tokenlerinin değeri yoktur ve her an sıfırlanabilir.' }],
    },
    {
      heading: '5. Olduğu gibi.',
      blocks: [
        { p: 'Explorer ve i-Wallet "olduğu gibi" ve "mevcut olduğu ölçüde", hiçbir garanti olmaksızın sunulur. Yasanın izin verdiği ölçüde şunlardan doğan kayıplardan sorumlu değiliz:' },
        { ul: [
          'kaybolan kelimeler ya da cihaz;',
          'imzaladığın işlemler ya da ağ kesintileri;',
          'Zagros test ağındaki kayıplar;',
          'üçüncü taraf hizmetlerindeki hatalar.',
        ] },
      ],
    },
    {
      heading: '6. Senin sorumlulukların.',
      blocks: [{ p: 'Onaylamadan önce alıcıyı, ağı ve tutarı kontrol et. Sana uygulanan yasalara uymak senin sorumluluğundadır.' }],
    },
    {
      heading: '7. Değişiklikler ve iletişim.',
      blocks: [{ p: 'Bu koşulları burada yeni bir sürüm yayımlayarak değiştirebiliriz. Sorular için: privacy@pezkuwichain.io.' }],
    },
  ],
};
export default doc;
