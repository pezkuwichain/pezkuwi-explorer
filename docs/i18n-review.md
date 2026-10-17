# i18n review list

Native-speaker review is required before launch for every row below marked "draft".
Turkish and English are written directly and are not listed.

- source "pwap": kmr and ckb are taken verbatim from the pezkuwichain/pwap repo (web/src/i18n/locales/kmr.ts and ckb.ts). fa and ar are always drafts.
- source "draft": written for this project, not reviewed by a native speaker. Some drafts reuse words found in pwap (pejirandeker, serlêdan, hemwelatî, pejirandî) in a new form; these still need review.
- source "dks.news": taken verbatim from the dks.news site (site/news.js; its `ku` is our ckb). fa and ar there are drafts too, so those rows stay marked draft.
- walletModal kmr: pwap verbatim except its "berîk" is written "cuzdan" (the owner's choice for this site, PR #8), masculine as in the Ferheng (Zeynelabidin): "Cuzdanê ku pere dixin navê" (Xelîtk), so "cuzdanê", never "cuzdana".
- source "brand": the product name, identical in every locale.
- **Owner decision (Serok, 2026-10-16): in Kurmancî, citizenship is "Welatîbûn" and a citizen is "welatî" everywhere in the explorer, never "Hemwelatî"** (Hemwelatî carries the compatriot sense). Changed: `home.citizenship` and `citizenship.title` → Welatîbûn, `citizenship.citizen` → Welatî, `citizenship.revoked` → Welatîbûn hat rakirin, `citizenship.card` → Karta welatîbûnê. `src/i18n/kmr-spelling.test.ts` bans "hemwelat" in kmr. The rows stay drafts for grammar only.
  - Rationale (Serok, 2026-10-17): the Ferheng has Welatî/m. "Hemwelatî, kesên ji eynî welatê hev in." and Hevwelatî/m. "Hemwelatî, merivên ji welatekî, lê ne ji nijadekê." (Hemwelatî/m. "Hevwelatî, kesên ji eynî welatî ne, lê dibe ku ne ji nijadekê bin."). Hevwelatî / Hemwelatî name people who share a country, the hometown or compatriot sense: the spoken question "Tu hevwelatiyê kû yî?" (said "hewwelatî", written Hevwelatî) asks where someone is from. Welatîbûn and Hemwelatîbûn are not Ferheng entries; they are regular -bûn derivations. Citizenship as membership is therefore "Welatîbûn" and a citizen "Welatî", matching the chain role "Welati" and pwap. The UI is unchanged.
  - Usage rule (Serok, 2026-10-17, final): pick the word by function. Addressing citizens (the state or DKS speaking to its people, "dear citizens") → "Hevwelatiyên birêz". Citizenship as a matter or process (applications, the citizenship tab, citizen issues) → "Welatîbûn". A citizen as a person or role → "Welatî".
- Row account.failed: the kmr cell is verbatim from pwap (settingsScreen.biometricAlerts.failedTitle, "Bi ser neket"); ckb, fa and ar are drafts. The row is therefore marked "draft (kmr: pwap verbatim)".

| key | kmr | ckb | fa | ar | source |
|---|---|---|---|---|---|
| app.name | Pezkuwi Explorer | Pezkuwi Explorer | Pezkuwi Explorer | Pezkuwi Explorer | brand |
| app.experts | Ji bo pisporan: &lt;domain&gt;apps.pezkuwichain.io&lt;/domain&gt; | بۆ شارەزایان: &lt;domain&gt;apps.pezkuwichain.io&lt;/domain&gt; | برای متخصصان: &lt;domain&gt;apps.pezkuwichain.io&lt;/domain&gt; | للخبراء: &lt;domain&gt;apps.pezkuwichain.io&lt;/domain&gt; | draft (the domain tag marks the left-to-right part; keep it around the domain) |
| app.back | Paşve | گەڕانەوە | بازگشت | رجوع | pwap |
| app.language | Ziman | زمان | زبان | اللغة | pwap |
| account.type | Cûre | جۆر | نوع | النوع | pwap (commission.voting.tableType; kmr spelled as in the Ferheng: "cûre"; fa, ar draft) |
| theme.label | Tema | ڕووکار | پوسته | المظهر | dks.news (fa, ar draft) |
| theme.auto | Xweber | خۆکار | خودکار | تلقائي | dks.news (fa, ar draft) |
| theme.light | Ronî | ڕووناک | روشن | فاتح | dks.news (fa, ar draft) |
| theme.dark | Tarî | تاریک | تیره | داكن | dks.news (fa, ar draft) |
| home.account | Hesabê min | هەژمارەکەم | حساب من | حسابي | draft |
| home.payment | Dayîna min gihîşt? | پارەدانەکەم گەیشت؟ | پرداخت من رسید؟ | هل وصلت دفعتي؟ | draft |
| home.citizenship | Welatîbûn | هاوڵاتیبوون | شهروندی | المواطنة | draft |
| home.network | Tor | تۆڕ | شبکه | الشبكة | pwap |
| status.up | Tor dixebite | تۆڕ کار دەکات | شبکه کار می‌کند | الشبكة تعمل | draft |
| status.down | Tor bersiv nade | تۆڕ وەڵام نادات | شبکه پاسخ نمی‌دهد | الشبكة لا تستجيب | draft |
| status.checking | Tor tê kontrol kirin… | تۆڕ دەپشکنرێت… | در حال بررسی شبکه… | جارٍ فحص الشبكة… | draft |
| open.title | Hesabê xwe veke | هەژمارەکەت بکەرەوە | حساب خود را باز کنید | افتح حسابك | draft |
| open.wallet | Bi cuzdanê xwe veke | بە جزدانەکەم بیکەرەوە | با کیف پول من باز کن | افتح بمحفظتي | draft |
| open.scan | Koda QR Bişopîne | سکانی کۆدی QR بکە | اسکن QR | مسح رمز QR | pwap |
| open.paste | Navnîşanê bixe vir | ناونیشان لێرە دابنێ | چسباندن آدرس | لصق العنوان | draft |
| open.pastePlaceholder | Navnîşana xwe li vir bixe | ناونیشانەکەت لێرە دابنێ | آدرس خود را اینجا بچسبانید | الصق عنوانك هنا | draft |
| open.invalid | Ev navnîşan ne derbasdar e. Kontrol bike û dîsa biceribîne. | ئەم ناونیشانە دروست نییە. بیپشکنە و دووبارە هەوڵبدەرەوە. | این آدرس معتبر نیست. آن را بررسی کنید و دوباره تلاش کنید. | هذا العنوان غير صالح. تحقق منه وحاول مجددًا. | draft |
| open.noCamera | Kamera venebû. Tu dikarî li şûna wê navnîşanê bixî vir. | کامێرا نەکرایەوە. دەتوانیت لەجیاتی ئەوە ناونیشانەکە دابنێیت. | دوربین باز نشد. می‌توانید به جای آن آدرس را بچسبانید. | تعذر فتح الكاميرا. يمكنك لصق العنوان بدلًا من ذلك. | draft |
| open.go | Veke | بیکەرەوە | باز کن | افتح | draft |
| account.total | Giştî | کۆی گشتی | مجموع | المجموع | draft |
| account.activity | Çalakiya dawî | دوایین چالاکییەکان | فعالیت‌های اخیر | النشاط الأخير | draft |
| account.forget | Ji vê cîhazê bibire | لەم ئامێرەدا بیسڕەوە | فراموش کردن در این دستگاه | انسَ على هذا الجهاز | draft |
| account.sent | Te <amount/> ji <who/> re şand | تۆ <amount/> نارد بۆ <who/> | شما <amount/> به <who/> فرستادید | أرسلت <amount/> إلى <who/> | draft |
| account.received | Te <amount/> ji <who/> wergirt | تۆ <amount/> وەرگرت لە <who/> | شما <amount/> از <who/> دریافت کردید | استلمت <amount/> من <who/> | draft |
| account.fee | Xerc | تێچوو | کارمزد | الرسوم | draft |
| account.when | Kengî | کەی | زمان | الوقت | draft |
| account.from | Ji | لە | از | من | draft |
| account.to | Bo | بۆ | به | إلى | draft |
| account.ok | Qediya | تەواو | انجام شد | تم | draft |
| account.failed | Bi ser neket | سەرکەوتوو نەبوو | ناموفق | فشل | draft (kmr: pwap verbatim) |
| account.empty | Hîna tu çalakî tune. | هێشتا هیچ چالاکییەک نییە. | هنوز فعالیتی نیست. | لا يوجد نشاط بعد. | draft |
| account.code | Koda dayînê | کۆدی پارەدان | کد تراکنش | رمز العملية | draft (the code shown on an activity; same wording as the "transaction code" in payment.placeholder) |
| payment.title | Dayîna min gihîşt? | پارەدانەکەم گەیشت؟ | پرداخت من رسید؟ | هل وصلت دفعتي؟ | draft |
| payment.placeholder | Koda dayînê an navnîşanekê bixe vir | کۆدی پارەدان یان ناونیشانێک لێرە دابنێ | کد تراکنش یا یک آدرس را بچسبانید | الصق رمز العملية أو عنوانًا | draft |
| payment.arrived | Gihîşt | گەیشت | رسید | وصلت | draft |
| payment.onTheWay | Di rê de ye | لە ڕێگایە | در راه است | في الطريق | draft |
| payment.notArrived | Negihîşt | نەگەیشت | نرسید | لم تصل | draft |
| payment.arrivedText | Pere gihîşt <who/>. | پارەکە گەیشتە <who/>. | پول به <who/> رسید. | وصل المال إلى <who/>. | draft |
| payment.notArrivedText | Pêk nehat. Pere ji hesabê şandkar derneket; tenê xerc hat birîn. | ئەنجام نەدرا. پارەکە لە هەژماری نێرەر دەرنەچوو؛ تەنها تێچووەکە بڕدرا. | انجام نشد. پول از حساب فرستنده خارج نشد؛ فقط کارمزد کسر شد. | لم تتم العملية. لم يخرج المال من حساب المرسل؛ أُخذت الرسوم فقط. | draft (neutral: the reader may be the sender or the recipient) |
| payment.notFound | Me hîna ev dayîn nedît. Heke te nû şandiye, deqeyekê bisekine û dîsa biceribîne. | هێشتا ئەم پارەدانەمان نەدۆزییەوە. ئەگەر تازە ناردوتە، خولەکێک چاوەڕێ بکە و دووبارە هەوڵبدەرەوە. | هنوز این پرداخت را پیدا نکردیم. اگر همین حالا فرستاده‌اید، یک دقیقه صبر کنید و دوباره تلاش کنید. | لم نعثر على هذه الدفعة بعد. إذا أرسلتها للتو، انتظر دقيقة وحاول مجددًا. | draft |
| payment.notAPayment | Ev kod ne dayînek e. | ئەم کۆدە پارەدان نییە. | این کد یک پرداخت نیست. | هذا الرمز ليس دفعة. | draft |
| payment.failedNotAPayment | Ev kod ne dayînek e, û pêk jî nehat. | ئەم کۆدە پارەدان نییە، و ئەنجامیش نەدرا. | این کد یک پرداخت نیست و انجام هم نشد. | هذا الرمز ليس دفعة، ولم تتم العملية أيضًا. | draft |
| payment.recent | Dayînên dawî yên <who/> | دوایین پارەدانەکانی <who/> | آخرین پرداخت‌های <who/> | آخر دفعات <who/> | draft (address lookup: heads the list of recent transfers; <who/> is the address looked up) |
| payment.sent | <amount/> ji <who/> re hat şandin | <amount/> نێردرا بۆ <who/> | <amount/> به <who/> فرستاده شد | أُرسل <amount/> إلى <who/> | draft |
| payment.received | <amount/> ji <who/> hat wergirtin | <amount/> وەرگیرا لە <who/> | <amount/> از <who/> دریافت شد | استُلم <amount/> من <who/> | draft |
| payment.to | <amount/> bo <who/> | <amount/> بۆ <who/> | <amount/> به <who/> | <amount/> إلى <who/> | draft |
| payment.several | Ev dayîn pêk hatin | ئەم پارەدانانە ئەنجام دران | این پرداخت‌ها انجام شدند | تمت هذه الدفعات | draft (heading over a code with more than one transfer) |
| payment.notYou | Heke navnîşana te di vê lîsteyê de tune be, vê kodê tu dayîn ji te re nekiriye. | ئەگەر ناونیشانەکەت لەم لیستەدا نییە، ئەم کۆدە پارەی بۆ تۆ نەداوە. | اگر آدرس شما در این فهرست نیست، این کد به شما پرداختی نکرده است. | إذا لم يكن عنوانك في هذه القائمة، فهذا الرمز لم يدفع لك. | draft |
| payment.more | Dibe ku vê kodê ji yên li vir têne nîşandan bêtir veguhastin hebin. Heke navnîşana te di vê lîsteyê de tune be, em ji vir nikarin bizanin ka vê kodê dayîn ji te re kiriye an na. | لەوانەیە ئەم کۆدە گواستنەوەی زیاتری هەبێت لەوەی لێرە پیشان دراوە. ئەگەر ناونیشانەکەت لەم لیستەدا نییە، لێرەوە ناتوانین بزانین ئایا ئەم کۆدە پارەی بۆ تۆ داوە یان نا. | ممکن است این کد انتقال‌های بیشتری از آنچه اینجا نشان داده شده داشته باشد. اگر آدرس شما در این فهرست نیست، از اینجا نمی‌توانیم بگوییم که آیا این کد به شما پرداخت کرده است یا نه. | قد يكون لهذا الرمز تحويلات أكثر مما يظهر هنا. إذا لم يكن عنوانك في هذه القائمة، فلا يمكننا أن نعرف من هنا ما إذا كان هذا الرمز قد دفع لك. | draft (shown when the list of a code may be incomplete; must not claim the code did not pay the reader) |
| payment.failedGroup | Ev pêk nehatin | ئەمانە ئەنجام نەدران | این‌ها انجام نشدند | هذه لم تتم | draft (line above the failed transfers of a code with several transfers) |
| citizenship.title | Welatîbûn | هاوڵاتیبوون | شهروندی | المواطنة | draft |
| citizenship.applied | Serlêdan hat kirin | داواکاری نێردرا | درخواست داده شد | تم تقديم الطلب | draft |
| citizenship.approved | Pejirandî | پەسەندکرا | تأیید شد | تمت الموافقة | draft |
| citizenship.citizen | Welatî | هاوڵاتی | شهروند | مواطن | draft |
| citizenship.notStarted | Hîna serlêdan nehatiye kirin | هێشتا داواکاری نییە | هنوز درخواستی نیست | لا يوجد طلب بعد | draft |
| citizenship.revoked | Welatîbûn hat rakirin | هاوڵاتیبوون هەڵوەشێنرایەوە | شهروندی لغو شد | تم إلغاء المواطنة | draft |
| citizenship.roles | Rol | ڕۆڵ | نقش‌ها | الأدوار | pwap |
| citizenship.trust | Xala Ewlehiyê | خاڵی متمانە | امتیاز اعتماد | درجة الثقة | pwap (review: literal 'ewlehî' ≈ security) |
| citizenship.noRoles | Hîna rol tune. | هێشتا هیچ ڕۆڵێک نییە. | هنوز نقشی نیست. | لا توجد أدوار بعد. | draft |
| citizenship.stepDone | qediya | تەواو بوو | انجام شد | مكتمل | draft (screen-reader text on completed steps; tr/en direct) |
| network.title | Tor | تۆڕ | شبکه | الشبكة | pwap |
| network.votes | Deng | دەنگدان | رأی‌ها | الأصوات | pwap |
| network.votesActive | Dengdanên çalak: {{count, number}} | دەنگدانە چالاکەکان: {{count, number}} | {{count, number}} رأی‌گیری فعال | التصويتات النشطة: {{count, number}} | draft (kmr, ckb, ar use a label-and-number form so the same text is grammatical for every count; en is the ruled "{{count, number}} active votes") |
| network.noVotes | Niha dengdaneke çalak tune. | ئێستا هیچ دەنگدانێکی چالاک نییە. | اکنون رأی‌گیری فعالی نیست. | لا توجد تصويتات نشطة الآن. | draft |
| network.voteHint | Ji bo dengdanê apps.pezkuwichain.io bikar bîne | بۆ دەنگدان apps.pezkuwichain.io بەکاربهێنە | برای رأی دادن از apps.pezkuwichain.io استفاده کنید | للتصويت، استخدم apps.pezkuwichain.io | draft |
| network.treasury | Xezîne | گەنجینە | خزانه | الخزينة | pwap |
| network.validators | Pejirandeker | پشتڕاستکەرەوەکان | تأییدکنندگان | المدققون | draft |
| network.validatorsActive | {{count}} aktîf | {{count}} چالاک | {{count}} فعال | {{count}} نشط | draft |
| state.loading | Tê barkirin... | بارکردن... | در حال بارگذاری… | جارٍ التحميل… | pwap |
| state.error | Ev nehat barkirin. Paşê dîsa biceribîne. | ئەمە بار نەکرا. دواتر دووبارە هەوڵبدەرەوە. | بارگذاری نشد. بعداً دوباره تلاش کنید. | تعذّر التحميل. حاول لاحقًا. | draft |
| state.preparing | Ev beş tê amadekirin. | ئەم بەشە ئامادە دەکرێت. | این بخش در حال آماده‌سازی است. | هذا القسم قيد الإعداد. | draft |
| state.retry | Dîsa biceribîne | دووبارە هەوڵبدەرەوە | تلاش دوباره | حاول مجددًا | pwap |
| time.minutesAgo / hoursAgo / daysAgo | kmr: Berî {{count}} deqîqe / saet / roj | ckb: پێش {{count}} خولەک / کاتژمێر / ڕۆژ | fa: {{count}} دقیقه / ساعت / روز پیش | ar: منذ {{count}} دقيقة / ساعة / يوم | draft |
| tiki.* (58 role names, all on-chain Tiki variants) | kmr = on-chain variant names verbatim (no translation) | ckb drafts: هاوڵاتی / ئەندامی پەرلەمان / سەرۆکی پەرلەمان / سەرۆک / وەزیر / ئەندامی دیوان / دادوەر / داواکار / یاساناس / نۆتەر / گەنجینەدار / باجگر / بەڕێوەبەری سەرچاوەکان / کارپێکەری تۆڕ / شارەزای ئاسایشی سایبەری / بەڕێوەبەری داتا / قسەکەر / تۆمارکەر / باڵیۆز / ناوبژیوان / پارێزەری کولتووری / پشکنەر / کۆنترۆڵکەری کوالیتی / مەلا / فەقێ / پەروەردەکار / بەرهەمهێنەر / بەڕێوەبەری پڕۆژە / سەرۆکی کۆمەڵە / بەڕێوەبەری کۆمەڵگە / ئاغا / پێشەنگ / ڕاوێژکار / حەکەم / مامۆستا / بازرگان / سەرۆک وەزیران / وەزیری دارایی / وەزیری بەرگری / وەزیری دادگا / وەزیری بڵاوکراوەکان / وەزیری تەندروستی / وەزیری ئاو / وەزیری کولتوور / بەرنامەنووس / وەرگێڕ / ئابووریناس / ژمێریار / ڕۆژنامەوان / شارەزای بازاڕکردن / ئاماریناس / پشتڕاستکەرەوە / هەڵبژێر / جێبەجێکار / کارگوزار / پلانساز | fa drafts: شهروند / نماینده پارلمان / رئیس مجلس / رئیس‌جمهور / وزیر / عضو دیوان / قاضی / دادستان / حقوقدان / سردفتر / خزانه‌دار / مأمور مالیات / مدیر منابع / اپراتور شبکه / متخصص امنیت سایبری / مدیر داده / سخنگو / ثبت‌کننده / سفیر / میانجی / نگهبان فرهنگی / بازرس / کنترل‌کننده کیفیت / ملا / طلبه علوم دینی / آموزگار / تولیدکننده محتوا / مدیر پروژه / رئیس انجمن / مدیر انجمن / آغا / پیشگام / مشاور / داور / معلم / بازرگان / نخست‌وزیر / وزیر دارایی / وزیر دفاع / وزیر دادگستری / وزیر نشریات / وزیر بهداشت / وزیر آب / وزیر فرهنگ / برنامه‌نویس / مترجم / اقتصاددان / حسابدار / روزنامه‌نگار / متخصص بازاریابی / آمارشناس / تأییدکننده / رأی‌دهنده / مجری / کارگزار / برنامه‌ریز | ar drafts: مواطن / نائب في البرلمان / رئيس البرلمان / الرئيس / وزير / عضو الديوان / قاضٍ / مدعٍ عام / حقوقي / كاتب عدل / أمين الخزينة / جابي الضرائب / مدير الموارد / مشغّل الشبكة / خبير الأمن السيبراني / مدير البيانات / متحدث رسمي / مسجّل / سفير / وسيط / حارس الثقافة / مفتش / مراقب الجودة / ملا / طالب علم شرعي / مربٍّ / صانع محتوى / مدير المشروع / رئيس الجمعية / مشرف المجتمع / آغا / رائد / مستشار / حكم / معلم / تاجر / رئيس الوزراء / وزير المالية / وزير الدفاع / وزير العدل / وزير النشر / وزير الصحة / وزير المياه / وزير الثقافة / مبرمج / مترجم / اقتصادي / محاسب / صحفي / أخصائي التسويق / إحصائي / مدقّق / ناخب / منفّذ / مسؤول إداري / مخطط | draft |
| tab.label | Beş | بەشەکان | بخش‌ها | الأقسام | draft (kmr "Beş" from the approved mockup; aria-label of the bottom tab bar) |
| tab.home | Mal | ماڵەوە | خانه | الرئيسية | draft (kmr "Mal" introduced by the mockup) |
| tab.account | Hesab | هەژمار | حساب | الحساب | draft (kmr "Hesab" introduced by the mockup) |
| day.today | Îro | ئەمڕۆ | امروز | اليوم | draft (kmr "Îro" introduced by the mockup; activity day header) |
| day.yesterday | Duh | دوێنێ | دیروز | أمس | draft (kmr "Duh", the mockup's "duh"; activity day header) |
| account.receivedShort | Te wergirt | وەرتگرت | دریافت کردید | استلمت | draft (kmr "Te wergirt" introduced by the mockup; activity row title) |
| account.sentShort | Te şand | ناردت | فرستادید | أرسلت | draft (kmr "Te şand" introduced by the mockup; activity row title) |
| account.amount | Mîqdar | بڕ | مبلغ | المبلغ | draft (kmr "Mîqdar" introduced by the mockup) |
| account.copy | Kopî bike | کۆپی بکە | کپی آدرس | نسخ العنوان | draft (kmr "Kopî bike" introduced by the mockup; screen-reader label of the address chip) |
| account.copied | Hat kopîkirin | کۆپی کرا | کپی شد | تم النسخ | draft (spoken after the address is copied) |
| account.copyFailed | Kopî nebû | کۆپی نەکرا | کپی نشد | تعذّر النسخ | draft (review fix: shown on the address chip when the browser refuses to copy) |
| account.tokens | Token | تۆکنەکان | توکن‌ها | العملات | draft (kmr "Token" from the mockup; label of the token list) |
| citizenship.card | Karta welatîbûnê | کارتی هاوڵاتیبوون | کارت شهروندی | بطاقة المواطنة | draft (kmr: owner decision 2026-10-16, welatîbûn replaces the mockup's "hemwelatî"; label of the citizen card) |
| citizenship.steps | Gav | هەنگاوەکان | مراحل | الخطوات | draft (kmr "Gav" from the mockup; label of the step bar) |
| app.expertsShort | Ji bo pisporan | بۆ شارەزایان | برای متخصصان | للخبراء | draft (same words as app.experts without the domain; the button on Citizenship) |
| network.aye | Erê | بەڵێ | موافق | نعم | draft (kmr "Erê" introduced by the mockup; Aye share of a vote) |
| network.nay | Na | نەخێر | مخالف | لا | draft (kmr "Na" introduced by the mockup; Nay share of a vote) |
| chain.relay / chain.assetHub / chain.people | Relay / Asset Hub / People | Relay / Asset Hub / People | Relay / Asset Hub / People | Relay / Asset Hub / People | brand (chain names, identical in every locale) |
| cid.idName | Nasnameya welatî | ناسنامەی هاوڵاتی | کارت شناسایی شهروند | هوية المواطن | draft (citizen ID card) |
| cid.photo | Wêne li cîhazê | وێنە لەسەر ئامێر | عکس روی این دستگاه | صورة على هذا الجهاز | draft (citizen ID card) |
| cid.photoAlt | Wêneyê te | وێنەکەت | عکس شما | صورتك | draft (citizen ID card) |
| cid.given | Nav | ناو | نام | الاسم | draft (citizen ID card) |
| cid.surname | Paşnav | پاشناو | نام خانوادگی | اسم العائلة | draft (citizen ID card) |
| cid.role | Rol | ڕۆڵ | نقش | الدور | draft (citizen ID card) |
| cid.number | Hejmara welatî | ژمارەی هاوڵاتی | شماره شهروندی | رقم المواطن | draft (citizen ID card) |
| cid.wallet | Navnîşana cuzdanê | ناونیشانی جزدان | آدرس کیف پول | عنوان المحفظة | draft (citizen ID card) |
| cid.status | Statû | دۆخ | وضعیت | الحالة | draft (citizen ID card) |
| cid.showBack | Rûyê paşîn nîşan bide | ڕووی پشتەوە پیشان بدە | نمایش پشت کارت | اعرض الوجه الخلفي | draft (citizen ID card) |
| cid.showFront | Rûyê pêşîn nîşan bide | ڕووی پێشەوە پیشان بدە | نمایش روی کارت | اعرض الوجه الأمامي | draft (citizen ID card) |
| cid.hintBack | Ji bo rûyê paşîn bitikîne | بۆ ڕووی پشتەوە دەستی لێ بدە | برای پشت کارت لمس کنید | المس لعرض الوجه الخلفي | draft (citizen ID card) |
| cid.hintFront | Ji bo rûyê pêşîn bitikîne | بۆ ڕووی پێشەوە دەستی لێ بدە | برای روی کارت لمس کنید | المس لعرض الوجه الأمامي | draft (citizen ID card) |
| cid.edit | Wêne û nav li vê cîhazê zêde bike | وێنە و ناو لەم ئامێرەدا زیاد بکە | افزودن عکس و نام در این دستگاه | أضف صورة واسمًا على هذا الجهاز | draft (citizen ID card) |
| cid.localNote | Wêne û nav tenê li vê cîhazê dimînin; qet nayên şandin. | وێنە و ناو تەنها لەم ئامێرەدا دەمێننەوە؛ هەرگیز نانێردرێن. | عکس و نام فقط روی این دستگاه می‌مانند و هرگز ارسال نمی‌شوند. | تبقى الصورة والاسم على هذا الجهاز فقط ولا تُرسل إلى أي مكان. | draft (citizen ID card) |
| cid.choosePhoto | Wêneyekî hilbijêre | وێنەیەک هەڵبژێرە | انتخاب عکس | اختر صورة | draft (citizen ID card) |
| cid.save | Tomar bike | پاشەکەوت بکە | ذخیره | حفظ | draft (citizen ID card) |
| cid.cancel | Betal bike | هەڵوەشاندنەوە | انصراف | إلغاء | draft (citizen ID card) |
| cid.clear | Ji vê cîhazê jê bibe | لەم ئامێرەدا بیسڕەوە | حذف از این دستگاه | احذف من هذا الجهاز | draft (citizen ID card) |
| cid.notImage | Ev pel ne wêne ye. | ئەم فایلە وێنە نییە. | این فایل تصویر نیست. | هذا الملف ليس صورة. | draft (citizen ID card) |
| cid.notSaved | Ev gerok wan nahêle; ew tenê heta ku tu rûpelê bigirî xuya dibin. | ئەم وێبگەڕە هەڵیان ناگرێت؛ تەنها تا داخستنی پەڕەکە دەردەکەون. | این مرورگر آن‌ها را نگه نمی‌دارد؛ فقط تا بستن صفحه دیده می‌شوند. | لا يحتفظ هذا المتصفح بها؛ تظهر فقط حتى تغلق الصفحة. | draft (citizen ID card) |
| mascot.hello | Silav! Ez Pez im. | سڵاو! من پێزم. | سلام! من پز هستم. | مرحبًا! أنا بيز. | draft (desktop mascot speech bubble) |
| mascot.say1 | Hesabê xwe bi yek tikandinê bibîne. | هەژمارەکەت بە یەک دەستلێدان ببینە. | حسابت را با یک لمس ببین. | شاهد حسابك بلمسة واحدة. | draft (desktop mascot speech bubble) |
| mascot.say2 | Dayîna te gihîşt? Li vir bipirse. | پارەدانەکەت گەیشت؟ لێرە بپرسە. | پرداختت رسید؟ اینجا بپرس. | هل وصلت دفعتك؟ اسأل هنا. | draft (desktop mascot speech bubble) |
| mascot.say3 | Tor dixebite — Zagros zindî ye. | تۆڕ کار دەکات — زاگرۆس زیندووە. | شبکه کار می‌کند — زاگرس زنده است. | الشبكة تعمل — زاغروس حيّة. | draft (desktop mascot speech bubble) |
| mascot.say4 | Nasnameya te ya Dijital Kurdistanê li vir e. | ناسنامەی کوردستانی دیجیتاڵیت لێرەیە. | کارت شناسایی کردستان دیجیتال تو اینجاست. | هويتك في كردستان الرقمية هنا. | draft (desktop mascot speech bubble) |
| mascot.say5 | HEZ û PEZ — pereyê Dijital Kurdistanê. | HEZ و PEZ — پارەی کوردستانی دیجیتاڵ. | HEZ و PEZ — پول کردستان دیجیتال. | HEZ و PEZ — مال كردستان الرقمية. | draft (desktop mascot speech bubble) |
| mascot.say6 | Bi telefona xwe veke — QR-ê bişopîne. | لە مۆبایلەکەتدا بیکەرەوە — QR سکان بکە. | روی گوشی‌ات باز کن — QR را اسکن کن. | افتحه على هاتفك — امسح رمز QR. | draft (desktop mascot speech bubble) |
| mascot.alt1 | Pez, maskota Pezkuwi, bi cilên kurdî | پێز، ماسکۆتی Pezkuwi، بە جلی کوردی | پز، نماد Pezkuwi، با لباس کردی | بيز، تميمة Pezkuwi، بملابس كردية | draft (desktop mascot picture description) |
| mascot.alt2 | Pez rûniştî, bi êlekeke kurdî | پێز دانیشتووە، بە کەواوەیەکی کوردی | پز نشسته، با جلیقه کردی | بيز جالسًا بصدرية كردية | draft (desktop mascot picture description) |
| mascot.alt3 | Pez bi cilên kevneşopî | پێز بە جلی نەریتی | پز با لباس سنتی | بيز بالزي التقليدي | draft (desktop mascot picture description) |
| mascot.alt4 | Pez li ber bajarekî kevn û çiyayan | پێز لەبەردەم شارێکی کۆن و چیاکان | پز جلوی یک شهر قدیمی و کوه‌ها | بيز أمام مدينة قديمة وجبال | draft (desktop mascot picture description) |
| mascot.alt5 | Pez li ber bircên nû | پێز لەبەردەم تاوەرە نوێیەکان | پز جلوی برج‌های مدرن | بيز أمام أبراج حديثة | draft (desktop mascot picture description) |
| mascot.alt6 | Pez li ser piyan, li meydanekê | پێز لەسەر پێ، لە گۆڕەپانێکدا | پز ایستاده در یک میدان | بيز واقفًا في ساحة | draft (desktop mascot picture description) |
| walletModal.connect | Cuzdanê Girêbide | جزدان پەیوەست بکە | اتصال کیف پول | توصيل المحفظة | pwap (walletModal.connect; fa, ar draft) |
| walletModal.connected | Cuzdan Girêdayî ye | جزدان پەیوەستە | کیف پول متصل شد | المحفظة متصلة | pwap (walletModal.connected; fa, ar draft) |
| walletModal.connectDesc | Ji bo têkiliya bi PezkuwiChain re pêveka Pezkuwi.js girêbidin | پاشکۆی Pezkuwi.js پەیوەست بکە بۆ کارلێکردن لەگەڵ PezkuwiChain | افزونه Pezkuwi.js خود را متصل کنید تا با PezkuwiChain تعامل کنید | قم بتوصيل إضافة Pezkuwi.js للتفاعل مع PezkuwiChain | pwap (walletModal.connectDesc; fa, ar draft) |
| walletModal.manageAccount | Hesabê xwe yê Pezkuwi birêvebirin | هەژماری Pezkuwi ت بەڕێوەببە | مدیریت حساب Pezkuwi شما | إدارة حساب Pezkuwi الخاص بك | pwap (walletModal.manageAccount; fa, ar draft) |
| walletModal.extensionTitle | Pêveka Gerokê | پێوەکەی وێبگەڕ | افزونه مرورگر | إضافة المتصفح | pwap (walletModal.extensionTitle; fa, ar draft) |
| walletModal.extensionDesc | Ji bo desktop û laptop — ji Chrome Web Store saz bikin | بۆ دێسکتۆپ و لاپتۆپ — لە Chrome Web Store دابەزێنە | برای دسکتاپ و لپ‌تاپ — از فروشگاه وب Chrome نصب کنید | لأجهزة الكمبيوتر — ثبّت من متجر Chrome الإلكتروني | pwap (walletModal.extensionDesc; fa, ar draft) |
| walletModal.extensionConnect | Bi Pêvekê Ve Girêbide | بە پێوەکە پەیوەندی بکە | اتصال با افزونه | اتصل بالإضافة | pwap (walletModal.extensionConnect; fa, ar draft) |
| walletModal.extensionGet | Ji Chrome Web Store Daxîne | لە Chrome Web Store دابەزێنە | دریافت از فروشگاه Chrome | احصل عليه من متجر Chrome | pwap (walletModal.extensionGet; fa, ar draft) |
| walletModal.connectingExtension | Di pêvekê de erê bikin... | لە پێوەکراوەکەدا پەسەندی بکە... | در افزونه تأیید کنید... | وافق في الإضافة... | pwap (walletModal.connectingExtension; fa, ar draft) |
| walletModal.mobileTitle | Cuzdanê Mobîl | جزدانی مۆبایل | کیف پول موبایل | محفظة الجوال | pwap (walletModal.mobileTitle; fa, ar draft) |
| walletModal.mobileDesc | Ji bo mobîl — bi pezWallet QR kodê bişopîne | بۆ مۆبایل — بە pezWallet QR کۆد بخوێنەوە | برای موبایل — کد QR را با اپلیکیشن pezWallet اسکن کنید | للجوال — امسح رمز QR بتطبيق pezWallet | pwap (walletModal.mobileDesc; fa, ar draft) |
| walletModal.mobileConnect | Bi pezWallet Ve Girêbide | بە pezWallet پەیوەندی بکە | اتصال با pezWallet | اتصل بـ pezWallet | pwap (walletModal.mobileConnect; fa, ar draft) |
| walletModal.mobilePlayStore | Ji Play Store dakêşin | دابەزاندن لە Play Store | دانلود از Play Store | تنزيل من Play Store | pwap (walletModal.mobilePlayStore; fa, ar draft) |
| walletModal.tryAgain | Dîsa Biceribîne | دووبارە هەوڵبدەرەوە | دوباره تلاش کنید | حاول مرة أخرى | pwap (walletModal.tryAgain; fa, ar draft) |
| walletModal.installChrome | Ji Chrome Web Store Saz Bikin | لە Chrome Web Store دابگرە | نصب از فروشگاه وب کروم | تثبيت من متجر Chrome الإلكتروني | pwap (walletModal.installChrome; fa, ar draft) |
| walletModal.afterInstall | Piştî sazbûnê, rûpelê nûve bikin û dîsa biceribînin | دوای دابگرتن، لاپەڕەکە نوێ بکەرەوە و دووبارە هەوڵبدەرەوە | پس از نصب، صفحه را بازخوانی کنید و دوباره تلاش کنید | بعد التثبيت، أعد تحميل الصفحة وحاول مرة أخرى | pwap (walletModal.afterInstall; fa, ar draft) |
| walletModal.accountName | Navê Hesabê | ناوی هەژمار | نام حساب | اسم الحساب | pwap (walletModal.accountName; fa, ar draft) |
| walletModal.unnamed | Hesabê Bênav | هەژماری بێناو | حساب بدون نام | حساب بدون اسم | pwap (walletModal.unnamed; fa, ar draft) |
| walletModal.address | Navnîşan | ناونیشان | آدرس | العنوان | pwap (walletModal.address; fa, ar draft) |
| walletModal.source | Çavkanî | سەرچاوە | منبع | المصدر | pwap (walletModal.source; fa, ar draft) |
| walletModal.disconnect | Veqetîne | پچڕاندن | قطع اتصال | قطع الاتصال | pwap (walletModal.disconnect; fa, ar draft) |
| walletModal.switchAccount | Hesab Biguherîne | هەژمار بگۆڕە | تغییر حساب | تبديل الحساب | pwap (walletModal.switchAccount; fa, ar draft) |
| walletModal.wcScanQR | Ji bo girêdanê bi pezWallet re bişopîne | بۆ پەیوەندیکردن بە pezWallet سکان بکە | برای اتصال با pezWallet اسکن کنید | امسح بـ pezWallet للاتصال | pwap (walletModal.wcScanQR; fa, ar draft) |
| walletModal.wcOpenWallet | Bi pezWallet ve girêbide | بە pezWallet پەیوەندی بکە | اتصال با اپلیکیشن pezWallet | اتصل بتطبيق pezWallet | pwap (walletModal.wcOpenWallet; fa, ar draft) |
| walletModal.wcGenerating | QR kod tê çêkirin... | QR کۆد دروستدەکرێت... | در حال ایجاد کد QR... | جاري إنشاء رمز QR... | pwap (walletModal.wcGenerating; fa, ar draft) |
| walletModal.wcWaiting | Li benda girêdana cuzdanê... | چاوەڕوانی پەیوەندیکردنی جزدان... | در انتظار اتصال کیف پول... | في انتظار اتصال المحفظة... | pwap (walletModal.wcWaiting; fa, ar draft) |
| walletModal.wcWaitingMobile | Di pezWallet de girêdanê bipejirîne | لە pezWallet پەیوەندییەکە پشتڕاست بکەوە | اتصال را در pezWallet تأیید کنید | وافق على الاتصال في pezWallet | pwap (walletModal.wcWaitingMobile; fa, ar draft) |
| walletModal.wcOpenApp | pezWallet Veke | pezWallet بکەوە | باز کردن pezWallet | افتح pezWallet | pwap (walletModal.wcOpenApp; fa, ar draft) |
| walletModal.wcInstallHint | pezWallet tune? Ji Play Store dakêşin. | pezWallet نییە؟ لە Play Store دابەزێنە. | pezWallet ندارید؟ از Play Store دانلود کنید. | ليس لديك pezWallet؟ حمّله من Play Store. | pwap (walletModal.wcInstallHint; fa, ar draft) |
| walletModal.wcInstructions | Serlêdana pezWallet veke → Mîheng → WalletConnect → QR kodê bişopîne | ئەپی pezWallet بکەرەوە → ڕێکخستنەکان → WalletConnect → QR کۆد سکان بکە | برنامه pezWallet را باز کنید → تنظیمات → WalletConnect → کد QR را اسکن کنید | افتح تطبيق pezWallet → الإعدادات → WalletConnect → امسح رمز QR | pwap (walletModal.wcInstructions; fa, ar draft) |
| walletModal.wcConnected | Girêdayî! | پەیوەندی کرا! | متصل شد! | تم الاتصال! | pwap (walletModal.wcConnected; fa, ar draft) |
| walletModal.wcRetry | Dîsa biceribîne | دووبارە هەوڵبدەرەوە | تلاش مجدد | حاول مرة أخرى | pwap (walletModal.wcRetry; fa, ar draft) |
| walletModal.wcTimeout | Girêdan qut bû. Ji kerema xwe dîsa biceribîne. | کاتی پەیوەندی تەواو بوو. تکایە دووبارە هەوڵبدەرەوە. | مهلت اتصال تمام شد. لطفا دوباره تلاش کنید. | انتهت مهلة الاتصال. يرجى المحاولة مرة أخرى. | pwap (walletModal.wcTimeout; fa, ar draft) |
| walletModal.errFailed | Girêdana wallet biserneket | پەیوەستکردنی جزدان سەرنەکەوت | اتصال کیف پول ناموفق بود | فشل توصيل المحفظة | pwap (existingAuth.walletConnectFailed; fa, ar draft) |
| walletModal.errAuthorize | Please authorize the connection in your Pezkuwi Wallet extension | Please authorize the connection in your Pezkuwi Wallet extension | Please authorize the connection in your Pezkuwi Wallet extension | Please authorize the connection in your Pezkuwi Wallet extension | draft (pwap fallback only: hard-coded English in pwap PezkuwiContext/WalletConnectModal, no locale entry; every cell is the English text) |
| walletModal.errNotFound | Pezkuwi Wallet extension not found. Please install from Chrome Web Store. | Pezkuwi Wallet extension not found. Please install from Chrome Web Store. | Pezkuwi Wallet extension not found. Please install from Chrome Web Store. | Pezkuwi Wallet extension not found. Please install from Chrome Web Store. | draft (pwap fallback only: hard-coded English in pwap PezkuwiContext/WalletConnectModal, no locale entry; every cell is the English text) |
| walletModal.errNoAccounts | No accounts found. Please create an account in Pezkuwi.js extension | No accounts found. Please create an account in Pezkuwi.js extension | No accounts found. Please create an account in Pezkuwi.js extension | No accounts found. Please create an account in Pezkuwi.js extension | draft (pwap fallback only: hard-coded English in pwap PezkuwiContext/WalletConnectModal, no locale entry; every cell is the English text) |
| walletModal.errExtensionTimeout | Extension connection timed out. Please check if the extension popup is blocked by your browser, then click Authorize and try again. | Extension connection timed out. Please check if the extension popup is blocked by your browser, then click Authorize and try again. | Extension connection timed out. Please check if the extension popup is blocked by your browser, then click Authorize and try again. | Extension connection timed out. Please check if the extension popup is blocked by your browser, then click Authorize and try again. | draft (pwap fallback only: hard-coded English in pwap PezkuwiContext/WalletConnectModal, no locale entry; every cell is the English text) |
| walletModal.errWcRejected | WalletConnect connection was rejected | WalletConnect connection was rejected | WalletConnect connection was rejected | WalletConnect connection was rejected | draft (pwap fallback only: hard-coded English in pwap PezkuwiContext/WalletConnectModal, no locale entry; every cell is the English text) |
| walletModal.errWcStart | Failed to start WalletConnect | Failed to start WalletConnect | Failed to start WalletConnect | Failed to start WalletConnect | draft (pwap fallback only: hard-coded English in pwap PezkuwiContext/WalletConnectModal, no locale entry; every cell is the English text) |
| walletModal.errConnection | Connection failed | Connection failed | Connection failed | Connection failed | draft (pwap fallback only: hard-coded English in pwap PezkuwiContext/WalletConnectModal, no locale entry; every cell is the English text) |
| dialog.close | Bigire | داخستن | بستن | إغلاق | pwap (txModal.close; fa, ar draft) |

Notes on tiki.*: the English and Turkish role names are also unreviewed renderings of Kurmanci titles. Rewsenbir is rendered as "Creator" (not "Writer"; see project decision). Feqi ("Religious Student"), Axa ("Aga"), Hekem ("Arbiter"), Pêseng ("Pioneer"), Karguzar ("Administrator") are culturally loaded and need a native-speaker check in every language.

Redesign (2026-10-15): the rows from tab.label to network.nay and the chain.* row were added with the approved
mockup. Every kmr word the mockup introduced (Mal, Hesab, Îro, Duh, Te wergirt, Te şand, Mîqdar, Kopî bike, Erê, Na,
Beş, Gav, Karta welatîbûnê) is a draft until a native speaker confirms it, as are all ckb, fa and ar cells. The
mockup's "2 saet berê" is not a new string: relative times come from time.* ("Berî 2 saet") where the browser has no
Kurmanji relative-time data. The role name Perwerdekar shown on the citizen screen is the on-chain variant (tiki.*).

Citizen ID card (2026-10-15): the cid.* rows label the digital citizen card and its local photo/name form; all kmr,
ckb, fa and ar cells are drafts (kmr "Rûyê pêşîn/paşîn", "Wêne li cîhazê", "Hejmara welatî", "Navnîşana cuzdanê" and
"Statû" come from the approved mockup). Brand text on the card, identical in every language and not translated:
"KOMARA KURDISTAN", "کۆماری کوردستان", "DIJITAL KURDISTAN", "WELATÎ", "HER BÎJÎ KURDISTAN", "e-ID", "ON-CHAIN · NFT",
"PEZKUWICHAIN" and the MRZ.

Desktop mascots (2026-10-15): mascot.hello and mascot.say1–say6 are the speech bubbles of the desktop layout; the kmr
cells are the approved mockup's sentences (without its brackets) and are drafts like every ckb, fa and ar cell.
mascot.alt1–alt6 describe the pictures. The name "Pez" is a placeholder until the owner names the mascot.

Wallet dialogs (2026-10-15): the walletModal.* rows are the texts of pwap's WalletModal and WalletConnectModal,
copied verbatim from pwap web/src/i18n/locales/*.ts (tr and en too). The rows marked "draft (pwap fallback only)" are
error messages pwap writes in English in its code with no locale entry; every locale carries that English until a
translation is written. dialog.close is the close button of every dialog (pwap txModal.close).

## i-Wallet — awaiting native reading

Task 9 (2026-10-16) replaced the per-task notes that used to stand here. The i-Wallet has 255 keys (`iwallet.*`) in all six files. tr and en are the source texts and are not listed; the tr warning card (`iwallet.warning.*`) is Serok's text verbatim and is never changed. Every kmr, ckb, fa and ar cell is still a draft as a whole until a native reader signs it off; the lists below say which cells could **not** be confirmed and why.

What "confirmed" means here:

- **kmr**: every word is in the Ferheng (Zeynelabidin Zinar, *Ferhenga Bêjebêjê*, 2025) or in pwap's `kmr.ts`, and no grammar or wording question is known. Vocabulary was checked mechanically against both sources; the Ferheng entries relied on are in the table below. Grammar and naturalness were not machine-checked.
- **ckb**: the cell is pwap text verbatim, or every word occurs in pwap's `ckb.ts` or the explorer's other ckb strings, and no wording question is known.
- **fa, ar**: the project has no native-reviewed fa or ar source, so a cell is "confirmed" only if it is pwap text verbatim (or a brand string). Everything else is a draft.
- Brand strings, identical in every language and not translated (4): `iwallet.title`, `iwallet.send.parsed`, `iwallet.citizen.citizen.nft`, `iwallet.citizen.chain.assetHub`. (`iwallet.home.hezSub`, `pezSub`, `usdtSub` were removed on 2026-10-17, see "Per-network HEZ" below.) The network names Relay, Asset Hub and People (`chain.*`, shared with the Account tab) are brand names too.

### Glossary (one term per concept)

| concept | tr | en | kmr | ckb | fa | ar |
|---|---|---|---|---|---|---|
| wallet | cüzdan | wallet | cuzdan (masculine: "cuzdanê") | جزدان | کیف پول | محفظة |
| hot wallet | sıcak cüzdan | hot wallet | cuzdanê germ | جزدانی گەرم | کیف پول گرم | محفظة ساخنة |
| password | parola | password | şîfre | وشەی نهێنی | رمز عبور | كلمة المرور |
| backup words | yedek kelimeler | backup words | peyvên vegerandinê | وشەکانی گەڕاندنەوە | کلمات پشتیبان | كلمات النسخ الاحتياطي |
| key / encrypted | anahtar / şifreli | key / encrypted | mifte / şîfrekirî | کلیل / کۆدکراو | کلید / رمزگذاری‌شده | مفتاح / مشفّر |
| send | gönder | send | şandin (bişîne) | ناردن (بنێرە) | ارسال | إرسال |
| receive | al | receive | wergirtin (wergire) | وەرگرتن | دریافت | استلام |
| network fee | ağ ücreti | network fee | xerca torê | کرێی تۆڕ | کارمزد شبکه | رسوم الشبكة |
| balance / amount | bakiye / tutar | balance / amount | balans / mîqdar | باڵانس / بڕ | موجودی / مبلغ | رصيد / المبلغ |
| address / account | adres / hesap | address / account | navnîşan / hesab | ناونیشان / هەژمار | آدرس / حساب | عنوان / حساب |
| asset (HEZ, PEZ, USDT) | varlık | asset | token | تۆکن | توکن | عملة |
| transaction code | işlem kimliği | transaction ID | koda dayînê | کۆدی پارەدان | کد تراکنش | رمز العملية |
| device / browser | cihaz / tarayıcı | device / browser | cîhaz / gerok | ئامێر / وێبگەڕ | دستگاه / مرورگر | جهاز / متصفح |
| citizenship / citizen | vatandaşlık / vatandaş | citizenship / citizen | welatîbûn / welatî | هاوڵاتیبوون / هاوڵاتی | شهروندی / شهروند | المواطنة / مواطن |
| citizenship chain | vatandaşlık zinciri | citizenship chain | zincîrê welatîbûnê | زنجیرەی هاوڵاتیبوون | زنجیره شهروندی | سلسلة المواطنة |
| move HEZ there (teleport) | taşı | move | birin (bibe wir) | گواستنەوە | انتقال | نقل |
| referrer | referans | referrer | referans | ئاماژەکار | معرف | المحيل |
| deposit | depozito | deposit | depozît | بەرامبەر | سپرده | الإيداع |
| application | başvuru | application | serlêdan | داواکاری | درخواست | الطلب |
| approve / confirm | onayla | approve / confirm | pejirandin / piştrastkirin | پەسەندکردن / پشتڕاستکردنەوە | تأیید | موافقة / تأكيد |

Sources of the terms: pwap (`transfer.*`, `newCitizen.*`, `auth.password`, `wallet.balance`, `p2pWithdraw.networkFee`) where pwap has the concept; otherwise the explorer's own strings (`account.code`, `account.tokens`, `cid.wallet`). Script rules: ckb writes a Latin name with a suffix as `NFT ـی`, `HEZ ـەکەت` (pwap style); ckb numerals ١٢, fa ۱۲, ar 12; fa writes آیفون/اندروید, ar keeps iPhone/Android Latin. No locale uses "hash" or "block" for the user: the transaction ID is the explorer's "transaction code", the block number is a "record number".

### Ferheng entries relied on (kmr)

| word as used | Ferheng entry | note |
|---|---|---|
| cuzdan | Xelîtk/n. Cuzdanê ku pere dixin navê. | masculine → cuzdanê (kmr-spelling.test.ts) |
| mifte | Mifte/m. Zimanok, kilîl, kilîlk, kilîd. | "kilîd" in one draft was replaced by mifte |
| peyv | Peyv/m. Bêje, gotin, pirs. |  |
| vegerandin | Vegerandin/m. a) Hatina bi şûnde … | basis of "peyvên vegerandinê" |
| kaxez | Kaxez/n. … | masculine → "kaxezekî" |
| zincîr | Zincîr/n. Hetîte, xeleqe û xulpoqên hesin bi hev ve … | masculine → "zincîrê welatîbûnê" |
| welatî | Welatî/m. Hemwelatî, kesên ji eynî welatê hev in. | citizen; welatîbûn = welatî + -bûn (pwap newCitizen.*) |
| hemwelatî | Hemwelatî/m. Hevwelatî, kesên ji eynî welatî ne … | means compatriot, so not used for "citizenship" |
| germ | Germ/m. Kelijî, sincirî, ne hênik. | "cuzdanê germ" |
| hişyarî | Hişyarî/m. Pêşnêrî, hişmendî, agahdarî … | warning label |
| demkî | Demkî/m. Hokera demê. | temporary |
| sepan | Sepan/m. Bikaranîn, bicihanîn. | "app" sense is pwap usage |
| weşandin | Weşandin/m. Hejandin, hezandin … | "publish" sense is modern usage (flagged) |
| ewlehî | Ewlehî/m. Pêbawerî. |  |
| piçûk / mezin / girîng | Piçûk/m.; Mezin/m.; Girîng/m. | "biçûk" unified to piçûk |
| şandin | Şandin/m. Şeyandin, hewale, hinartin. |  |
| wergirtin | Wergirtin/m. Kincek … li xwe kirin | Ferheng gives only "put on clothes"; "receive" is pwap/explorer usage |
| pejirandin / piştrast | Pejirandin/m. Erêkirin; Piştrast/m. Ewle, bawer … | approve / confirm |
| serlêdan | Serlêdan/m. a) Çûye pirsa yekî | application (pwap) |
| betalkirin / cemidandin | Betalkirin/m. rawestandin, cemidandin. |  |
| jêbirin / vekirin / girtin | Jêbirin/m.; Vekirin/m.; Girtin/m. |  |
| dabeşkirin / parvekirin | Dabeşkirin/m.; Parvekirin/m. Dabeşkirin. |  |
| hilbijartin / bijarte | Hilbijartin/m.; Bijarte/m. |  |
| pêwîst / berdest / valahî | Pêwîst/m.; Berdest/m.; Valahî/m. |  |
| winda / nasname / şop | Winda/m.; Nasname/m.; Şop/m. |  |
| dane | Dane/m. Lib, heb … | Ferheng sense is "grain"; "data" is pwap usage |
| gerok | Gerok/m. a) Parsek, b) Tûrîst | Ferheng sense differs; "browser" is pwap/explorer usage |
| rûpel / pace / asayî / nepenî / asteng | Rûpel/m.; Pace/m.; Asayî/m.; Nepenî/m.; Asteng/m. |  |
| navnîşan | Navnîşan/m. Pêşwan … |  |
| damezrîner / vexwendin | in text "damezrîner, danî, hîmdar, sazker"; Vexwendin/m. |  |
| pîşe / eşîr | Pîşe/m.; Eşîr/m. | pwap form |
| sînor / hêdî / ceribandin / hejmar | Sînor/n.; Hêdî/m.; Ceribandin/m.; Hejmar/m. |  |
| xerc | Xercî/m.; Mezax/m. Lêçû, mesref, xerc. | fee (explorer account.fee) |
| cîhaz | in text: "Bûjen/m. Cîhaz, malzeme …" | device |

Words not in the Ferheng, taken from pwap's `kmr.ts` (a native reader may prefer other words): şîfre / şîfrekirî, token, mîqdar, derbasdar, referans, depozît, balans, bikarhêner, tomarkirin, server, ekran, guherto, danûstandin (Ferheng has it only as "conversation"), dîjîtal, rol, xizmet, garantî, moda.

### Kurmancî (kmr): 220 confirmed, 35 not confirmed

- `iwallet.citizen.act.teleport`: Zincîr is masculine in the Ferheng (Zincîr/n.), so the ezafe is "zincîrê welatîbûnê"; pwap usually treats it as feminine
- `iwallet.citizen.defaultReferrer`: "Bixweber" (pwap: automatically) for "Default"
- `iwallet.citizen.form.agree`: Zincîr is masculine in the Ferheng (Zincîr/n.), so the ezafe is "zincîrê welatîbûnê"; pwap usually treats it as feminine
- `iwallet.citizen.form.privacy`: Zincîr is masculine in the Ferheng (Zincîr/n.), so the ezafe is "zincîrê welatîbûnê"; pwap usually treats it as feminine
- `iwallet.citizen.fund.body`: Zincîr is masculine in the Ferheng (Zincîr/n.), so the ezafe is "zincîrê welatîbûnê"; pwap usually treats it as feminine
- `iwallet.citizen.fund.title`: Zincîr is masculine in the Ferheng (Zincîr/n.), so the ezafe is "zincîrê welatîbûnê"; pwap usually treats it as feminine
- `iwallet.citizen.fund.waiting`: Zincîr is masculine in the Ferheng (Zincîr/n.), so the ezafe is "zincîrê welatîbûnê"; pwap usually treats it as feminine
- `iwallet.err.assets.BalanceLow`: "token" (pwap) has no Ferheng gender; written masculine ("vî tokenî")
- `iwallet.err.assets.NoAccount`: "token" (pwap) has no Ferheng gender; written masculine ("vî tokenî")
- `iwallet.err.assets.NoPermission`: "token" (pwap) has no Ferheng gender; written masculine ("vî tokenî")
- `iwallet.err.balances.ExistentialDeposit`: the English term "existential deposit" was removed and explained in plain words; check the meaning
- `iwallet.err.pezkuwiXcm.FeesNotMet`: "birin" used as a noun for moving HEZ between chains
- `iwallet.err.pezkuwiXcm.Filtered`: "birin" used as a noun for moving HEZ between chains
- `iwallet.error.networkChanged`: added in the final fix batch (the wallet refuses an endpoint whose chain is not the configured one); not checked against the Ferheng ("sererastkirin" for "fixed")
- `iwallet.home.a2hs`: "Ekrana Malê" for the iPhone Home Screen
- `iwallet.home.hot`: "cuzdanê germ" is a calque of "hot wallet" (Ferheng: Germ = ne hênik)
- `iwallet.home.title`: "Cuzdanê te yê i-Wallet" construction for "Your i-Wallet"
- `iwallet.import.body`: "peyvên vegerandinê" (recovery words) replaces the Turkish loan "yedek", which is not in the Ferheng; the phrase is built from Ferheng words (Peyv/m., Vegerandin/m.) but is new
- `iwallet.import.invalid`: "peyvên vegerandinê" (recovery words) replaces the Turkish loan "yedek", which is not in the Ferheng; the phrase is built from Ferheng words (Peyv/m., Vegerandin/m.) but is new
- `iwallet.quiz.body`: "peyvên vegerandinê" (recovery words) replaces the Turkish loan "yedek", which is not in the Ferheng; the phrase is built from Ferheng words (Peyv/m., Vegerandin/m.) but is new; Kaxez is masculine in the Ferheng (Kaxez/n.), so "kaxezekî" / "li ser kaxez" were written instead of the common "kaxezê"
- `iwallet.quiz.slot`: "Peyv {{n}}" without an ordinal ending
- `iwallet.send.copyTxId`: "Koda dayînê" reuses the explorer's account.code (itself a draft) so the code can be pasted into "Did my payment arrive?"
- `iwallet.send.largeTitle`: "cuzdanê germ" is a calque of "hot wallet" (Ferheng: Germ = ne hênik)
- `iwallet.send.recordNo`: "Hejmara tomarê" (record number) is new wording
- `iwallet.send.txId`: "Koda dayînê" reuses the explorer's account.code (itself a draft) so the code can be pasted into "Did my payment arrive?"
- `iwallet.settings.backup`: "peyvên vegerandinê" (recovery words) replaces the Turkish loan "yedek", which is not in the Ferheng; the phrase is built from Ferheng words (Peyv/m., Vegerandin/m.) but is new
- `iwallet.unavailable.body`: "moda nepenî" for private browsing; "moda" is not in the Ferheng
- `iwallet.unavailable.title`: reworded ("this browser does not let the wallet be saved") instead of a literal "storage"
- `iwallet.warning.body1`: Serok's warning card: needs a reading for faithfulness to the Turkish; "xizmet" (service) is not in the Ferheng (only Xizmetî = kinship); pwap uses it once; "weşandin" in the sense "publish" (Ferheng: Weşandin = hejandin, to shake); "cuzdanê germ" is a calque of "hot wallet" (Ferheng: Germ = ne hênik)
- `iwallet.warning.body2`: Serok's warning card: needs a reading for faithfulness to the Turkish
- `iwallet.warning.title`: Serok's warning card: needs a reading for faithfulness to the Turkish; "xizmet" (service) is not in the Ferheng (only Xizmetî = kinship); pwap uses it once
- `iwallet.words.ack`: Kaxez is masculine in the Ferheng (Kaxez/n.), so "kaxezekî" / "li ser kaxez" were written instead of the common "kaxezê"
- `iwallet.words.list`: "peyvên vegerandinê" (recovery words) replaces the Turkish loan "yedek", which is not in the Ferheng; the phrase is built from Ferheng words (Peyv/m., Vegerandin/m.) but is new
- `iwallet.words.title`: "peyvên vegerandinê" (recovery words) replaces the Turkish loan "yedek", which is not in the Ferheng; the phrase is built from Ferheng words (Peyv/m., Vegerandin/m.) but is new
- `iwallet.words.warnTitle`: Kaxez is masculine in the Ferheng (Kaxez/n.), so "kaxezekî" / "li ser kaxez" were written instead of the common "kaxezê"; "wêneyê ekranê" for screenshot; "ekran" is pwap usage, not in the Ferheng

### Soranî (ckb): 193 confirmed, 62 not confirmed

- `iwallet.citizen.form.agree`: replaced on 2026-10-17 (see "No 'fingerprint'" below); draft
- `iwallet.citizen.form.notSaved`: not attested in pwap or the explorer: بۆیە, فۆرمەکەتی, هەڵنەگرت
- `iwallet.citizen.form.privacy`: replaced on 2026-10-17 (see "No 'fingerprint'" below); draft
- `iwallet.citizen.form.referrerNote`: not attested in pwap or the explorer: کردوویت
- `iwallet.citizen.fund.body`: not attested in pwap or the explorer: لەوێ
- `iwallet.citizen.interrupted`: not attested in pwap or the explorer: هەوڵدانەوە
- `iwallet.citizen.intro`: not attested in pwap or the explorer: دەتناسێت
- `iwallet.citizen.refs.body`: not attested in pwap or the explorer: بردووە
- `iwallet.create.body`: not attested in pwap or the explorer: سێرڤەرەکانمان, نانێردرێت
- `iwallet.err.assets.NoPermission`: not attested in pwap or the explorer: ڕێگەت
- `iwallet.err.balances.ExistentialDeposit`: not attested in pwap or the explorer: دەسڕدرێتەوە
- `iwallet.err.balances.Expendability`: not attested in pwap or the explorer: جێدەهێڵێت, کەمێک
- `iwallet.err.balances.LiquidityRestrictions`: not attested in pwap or the explorer: نانێردرێت
- `iwallet.err.identityKyc.CannotCancelInCurrentState`: not attested in pwap or the explorer: هەڵبوەشێنرێتەوە
- `iwallet.err.identityKyc.IdentityHashAlreadyUsed`: not attested in pwap or the explorer: بەکارهاتووە, تردا
- `iwallet.err.identityKyc.NotTheReferrer`: not attested in pwap or the explorer: داواکارییەکەدا
- `iwallet.err.pezkuwiXcm.LocalExecutionIncompleteWithError`: not attested in pwap or the explorer: زۆرجار, نەگوازرایەوە
- `iwallet.err.tiki.KycNotCompleted`: not attested in pwap or the explorer: kycی
- `iwallet.error.networkChanged`: added in the final fix batch; not checked against pwap wording
- `iwallet.error.notSaved`: not attested in pwap or the explorer: بۆیە, تری, پەنجەرەیەکی
- `iwallet.home.a2hs`: not attested in pwap or the explorer: بسڕدرێتەوە, دەڕوات
- `iwallet.home.hot`: "جزدانی گەرم" is a calque of "hot wallet" (گەرم not in pwap); not attested in pwap or the explorer: گەرم
- `iwallet.home.title`: "i-Wallet ـەکەت" join
- `iwallet.import.body`: "وشەکانی گەڕاندنەوە" (recovery words) replaces "یەدەگ", which pwap never uses; not attested in pwap or the explorer: بۆشاییەک, لەنێوانیاندا
- `iwallet.import.confirmBody`: not attested in pwap or the explorer: بیگەیتێ, بەبێ, جارێکی, کۆنەکە
- `iwallet.import.confirmTitle`: not attested in pwap or the explorer: بگۆڕدرێت
- `iwallet.import.invalid`: "وشەکانی گەڕاندنەوە" (recovery words) replaces "یەدەگ", which pwap never uses; not attested in pwap or the explorer: ڕیزبەندییان
- `iwallet.password.body`: not attested in pwap or the explorer: دادەمەزرێنیتەوە, لەبیرت, وشەکە
- `iwallet.quiz.body`: "وشەکانی گەڕاندنەوە" (recovery words) replaces "یەدەگ", which pwap never uses; not attested in pwap or the explorer: تێپەڕێنرێت, ون, ڕۆژێک
- `iwallet.quiz.wrong`: not attested in pwap or the explorer: وشەکە
- `iwallet.receive.body`: not attested in pwap or the explorer: با, بخوێنێتەوە, بنێرێت, بۆت
- `iwallet.send.copyTxId`: "کۆدی پارەدان" reuses the explorer's account.code (a draft)
- `iwallet.send.decimals`: not attested in pwap or the explorer: وەردەگرێت
- `iwallet.send.exceeds`: not attested in pwap or the explorer: بینێریت
- `iwallet.send.inBlock`: not attested in pwap or the explorer: وەریگرت
- `iwallet.send.interrupted`: not attested in pwap or the explorer: بنێریت
- `iwallet.send.largeAck`: not attested in pwap or the explorer: دەینێرم
- `iwallet.send.largeTitle`: "جزدانی گەرم" is a calque of "hot wallet" (گەرم not in pwap); not attested in pwap or the explorer: بڕە, گەرم
- `iwallet.send.noFee`: not attested in pwap or the explorer: بۆی
- `iwallet.send.otherNetwork`: not attested in pwap or the explorer: ترە, تۆڕێکی
- `iwallet.send.recordNo`: "ژمارەی تۆمار" (record number) is new wording
- `iwallet.send.self`: not attested in pwap or the explorer: بینێریت, خۆتە, دەمێنێتەوە, لای
- `iwallet.send.slow`: not attested in pwap or the explorer: وەریگرت
- `iwallet.send.txId`: "کۆدی پارەدان" reuses the explorer's account.code (a draft)
- `iwallet.settings.backup`: "وشەکانی گەڕاندنەوە" (recovery words) replaces "یەدەگ", which pwap never uses
- `iwallet.settings.backupBody`: not attested in pwap or the explorer: مەدە
- `iwallet.settings.deleteBody`: not attested in pwap or the explorer: تاکە, دەسڕێتەوە, ناگەیتەوە, نەتنووسیبن, وشەکە
- `iwallet.settings.deleteTitle`: not attested in pwap or the explorer: بسڕدرێتەوە
- `iwallet.settings.exportBody`: not attested in pwap or the explorer: بیخەیتە, دادەبەزێنێت
- `iwallet.unavailable.body`: not attested in pwap or the explorer: پەنجەرەیەکی
- `iwallet.unlock.corrupt`: not attested in pwap or the explorer: ناخوێنرێتەوە, وشەکە
- `iwallet.unlock.restore`: not attested in pwap or the explorer: بیگەڕێنەوە
- `iwallet.warning.body1`: Serok's warning card: needs a reading for faithfulness to the Turkish; "جزدانی گەرم" is a calque of "hot wallet" (گەرم not in pwap); not attested in pwap or the explorer: بچووکەکانت, نادەن
- `iwallet.warning.body2`: Serok's warning card: needs a reading for faithfulness to the Turkish; not attested in pwap or the explorer: بڕە
- `iwallet.warning.title`: Serok's warning card: needs a reading for faithfulness to the Turkish
- `iwallet.words.ack`: not attested in pwap or the explorer: وشەکەم
- `iwallet.words.body`: not attested in pwap or the explorer: خودی, وشانە, ون
- `iwallet.words.list`: "وشەکانی گەڕاندنەوە" (recovery words) replaces "یەدەگ", which pwap never uses
- `iwallet.words.title`: "وشەکانی گەڕاندنەوە" (recovery words) replaces "یەدەگ", which pwap never uses
- `iwallet.words.warnBody`: not attested in pwap or the explorer: بیانگەڕێنێتەوە, ناکات, وشانەت, ونت
- `iwallet.words.warnTitle`: not attested in pwap or the explorer: بینووسە, مەگرە

### Persian (fa): 71 confirmed, 184 not confirmed

Every `iwallet.*` cell is a draft except the brand strings above and these 66 cells, which are pwap text verbatim: `warning.label`, `import.confirmNo`, `home.send`, `home.receive`, `home.citizen`, `home.assets`, `home.pezSub`, `next`, `quiz.verify`, `password.label`, `receive.title`, `send.title`, `send.recipient`, `send.scan`, `send.token`, `send.amount`, `send.max`, `send.to`, `send.confirm`, `send.feeLabel`, `citizen.title`, `citizen.apply`, `citizen.cancel`, `citizen.confirm`, `citizen.sign`, `citizen.confirmTitle`, `citizen.form.personal`, `citizen.form.fullName`, `citizen.form.fatherName`, `citizen.form.grandfatherName`, `citizen.form.motherName`, `citizen.form.tribe`, `citizen.form.marital`, `citizen.form.married`, `citizen.form.unmarried`, `citizen.form.childrenCount`, `citizen.form.childName`, `citizen.form.birthYear`, `citizen.form.region`, `citizen.form.selectRegion`, `citizen.form.email`, `citizen.form.emailInvalid`, `citizen.form.profession`, `citizen.form.required`, `citizen.region.bakur`, `citizen.region.basur`, `citizen.region.rojava`, `citizen.region.rojhelat`, `citizen.region.kurdistan_a_sor`, `citizen.region.diaspora`, `citizen.deposit.title`, `citizen.deposit.body`, `citizen.pending.title`, `citizen.pending.body`, `citizen.pending.depositBack`, `citizen.approved.title`, `citizen.approved.body`, `citizen.refs.approve`, `citizen.row.action`, `citizen.row.applicant`, `citizen.row.to`, `citizen.act.confirm`, `citizen.act.cancel`, `citizen.chain.assetHub`, `citizen.done.apply`, `citizen.done.approve`.

### Arabic (ar): 65 confirmed, 190 not confirmed

Every `iwallet.*` cell is a draft except the brand strings above and these 60 cells, which are pwap text verbatim: `import.confirmNo`, `home.send`, `home.receive`, `home.citizen`, `home.pezSub`, `next`, `quiz.verify`, `password.label`, `receive.title`, `send.title`, `send.recipient`, `send.amount`, `send.max`, `send.amountInvalid`, `send.to`, `send.confirm`, `send.done`, `send.feeLabel`, `citizen.title`, `citizen.apply`, `citizen.cancel`, `citizen.confirm`, `citizen.confirmTitle`, `citizen.form.personal`, `citizen.form.fullName`, `citizen.form.fatherName`, `citizen.form.grandfatherName`, `citizen.form.motherName`, `citizen.form.tribe`, `citizen.form.marital`, `citizen.form.married`, `citizen.form.unmarried`, `citizen.form.childrenCount`, `citizen.form.childName`, `citizen.form.birthYear`, `citizen.form.region`, `citizen.form.selectRegion`, `citizen.form.email`, `citizen.form.emailInvalid`, `citizen.form.profession`, `citizen.form.required`, `citizen.region.bakur`, `citizen.region.basur`, `citizen.region.rojava`, `citizen.region.rojhelat`, `citizen.region.kurdistan_a_sor`, `citizen.region.diaspora`, `citizen.deposit.title`, `citizen.pending.title`, `citizen.pending.body`, `citizen.pending.depositBack`, `citizen.approved.title`, `citizen.approved.body`, `citizen.refs.approve`, `citizen.row.to`, `citizen.act.confirm`, `citizen.act.cancel`, `citizen.chain.assetHub`, `citizen.done.apply`, `citizen.done.approve`.

Read first in fa and ar: the warning card (`warning.*`, Serok's text), `home.hot` and `send.largeTitle` ("hot wallet"), `send.txId` / `send.recordNo` (no "hash"/"block"), and the citizenship-chain texts (`citizen.fund.*`).

### Per-network HEZ (2026-10-17)

The home now uses the Account tab's balance card and token rows (HEZ total split over Relay, Asset Hub and People; HEZ, PEZ, USDT rows with the Account tab's network labels), and Send asks for the token, then for HEZ the network. The counts above predate this change.

Removed keys (no longer rendered; ignore their entries above): `iwallet.home.assets`, `iwallet.home.hezSub`, `iwallet.home.pezSub`, `iwallet.home.usdtSub`, `iwallet.home.parts`.

New keys; every kmr, ckb, fa and ar cell below is a draft until a native reader signs it off:

| key | kmr | ckb | fa | ar |
|---|---|---|---|---|
| `iwallet.send.networkTitle` | Ji bo şandina {{token}} torê hilbijêre | تۆڕێک هەڵبژێرە بۆ ناردنی {{token}} | شبکه را برای ارسال {{token}} انتخاب کنید | اختر الشبكة لإرسال {{token}} |
| `iwallet.send.network` | Tor | تۆڕ | شبکه | الشبكة |
| `iwallet.send.change` | Biguherîne | گۆڕین | تغییر | تغيير |
| `iwallet.receive.networks` | Ev navnîşan li her sê torên Pezkuwi werdigire: Relay, Asset Hub û People. | ئەم یەک ناونیشانە لە هەر سێ تۆڕی Pezkuwi وەردەگرێت: Relay، Asset Hub و People. | همین یک آدرس در هر سه شبکه Pezkuwi دریافت می‌کند: Relay، Asset Hub و People. | هذا العنوان الواحد يستقبل على شبكات Pezkuwi الثلاث كلها: Relay وAsset Hub وPeople. |

- **kmr**: vocabulary confirmed: "tor" as in `send.fee` (xerca torê, glossary "network"), "hilbijêre" (Ferheng: Dengdan/m. Hilbijartin; pwap "Wêneyekî hilbijêre"), "biguherîne" (explorer "Erê, biguherîne"; Ferheng guhertin), "werdigire" (wergirtin, glossary "receive"), "her sê". Word order of `networkTitle` ("Ji bo şandina HEZ torê hilbijêre", after the wallet's "Select network for sending %s") was not machine-checked.
- **ckb**: "تۆڕ" as in the glossary (کرێی تۆڕ); "هەڵبژێرە" and "گۆڕین" occur in pwap's `ckb.ts`, "وەردەگرێت" in the explorer's ckb; the sentences as a whole are drafts.
- **fa, ar**: drafts (no pwap source for these sentences).

### No "fingerprint" (2026-10-17, Serok's request)

People read "digital fingerprint" (parmak izi, şop, پەنجەمۆر, اثر انگشت, بصمة) as a real fingerprint being taken. `iwallet.citizen.form.privacy` and `iwallet.citizen.form.agree` were replaced in all six files with Serok's texts, which call it a one-way code made from the data that cannot be read back. No other `iwallet.*` cell uses fingerprint wording (kmr `send.scan` "bişopîne" means "scan").

- tr, en: source texts.
- kmr: new words "kodeke", "çêkirin", "xwendin" are in common use in the explorer's kmr; the ezafe "zincîrê welatîbûnê" follows the note above. Still awaiting a native reading.
- ckb, fa, ar: **flagged for native reading** (both keys), as before.

### Progress while the key is opened (2026-10-17)

New key `iwallet.unlocking`, shown in the Kurdistan-sun overlay while a password opens or saves the key: tr "Açılıyor…", en "Opening…". kmr "Tê vekirin…" (Ferheng Vekirin/m.; same as `unlock.working`). ckb "دەکرێتەوە…", fa "در حال باز کردن…", ar "جارٍ الفتح…" are the existing `unlock.working` texts reused, still drafts for a native reading.

### Add to Home Screen (2026-10-17, Serok's request)

New keys `iwallet.install.*`: the button on the home hint row and on the landing card, the landing card line, and the
iOS dialog (three Safari steps and the storage note). tr and en are the source texts. Every kmr, ckb, fa and ar cell is a
draft until a native reader signs it off.

| key | kmr | ckb | fa | ar |
|---|---|---|---|---|
| `install.button` | Li Ekrana Malê zêde bike | زیادکردن بۆ شاشەی سەرەکی | افزودن به صفحه اصلی | إضافة إلى الشاشة الرئيسية |
| `install.title` | i-Wallet li Ekrana Malê zêde bike | i-Wallet زیاد بکە بۆ شاشەی سەرەکی | i-Wallet را به صفحه اصلی اضافه کنید | أضف i-Wallet إلى الشاشة الرئيسية |
| `install.step1` | Di Safariyê de li nîşana Parvekirinê bitikîne | لە Safari دا دەست بنێ بە ئایکۆنی هاوبەشکردن | در نوار ابزار Safari روی نماد اشتراک‌گذاری بزنید | اضغط على أيقونة المشاركة في شريط أدوات Safari |
| `install.step2` | “Li Ekrana Malê zêde bike” hilbijêre | «زیادکردن بۆ شاشەی سەرەکی» هەڵبژێرە | «افزودن به صفحه اصلی» را انتخاب کنید | اختر «إضافة إلى الشاشة الرئيسية» |
| `install.step3` | Li “Zêde bike” bitikîne | دەست بنێ بە «زیادکردن» | روی «افزودن» بزنید | اضغط على «إضافة» |
| `install.iosNote` | Sepana li Ekrana Malê daneyên xwe ji Safariyê cuda tomar dike: i-Wallet ji Ekrana Malê veke. Heke te cuzdanê xwe di Safariyê de çêkiribe, li wir bi 12 peyvên xwe vegerîne. | بەرنامەکەی سەر شاشەی سەرەکی داتای خۆی جیا لە Safari هەڵدەگرێت: … | برنامهٔ صفحه اصلی فضای ذخیره‌سازی خودش را دارد، جدا از Safari: … | يحتفظ تطبيق الشاشة الرئيسية بتخزينه الخاص، منفصلًا عن Safari: … |
| `install.landing` | Pêşî i-Wallet li Ekrana Malê zêde bike û cuzdanê xwe li wir çêke | سەرەتا i-Wallet زیاد بکە بۆ شاشەی سەرەکی و جزدانەکەت لەوێ دروست بکە | ابتدا i-Wallet را به صفحه اصلی اضافه کنید و کیف پول خود را آنجا بسازید | أضف i-Wallet أولًا إلى الشاشة الرئيسية وأنشئ محفظتك هناك |

- **The quoted iOS labels** (step 2 and step 3) must match what the person's iPhone shows. iOS has no Kurmancî or Soranî
  interface, so a Kurdish reader's iPhone shows Turkish, Arabic, Persian or English labels ("Ana Ekrana Ekle" / "Ekle",
  "إضافة إلى الشاشة الرئيسية" / "إضافة", "Add to Home Screen" / "Add"). The kmr and ckb quotes are translations of the
  label, not the label itself; a native reader should decide whether to quote the English label instead.
- **kmr**: vocabulary confirmed: "Ekrana Malê" and "zêde bike" as in `home.a2hs`; "parvekirin" (Ferheng
  Parvekirin/m.), "nîşan" (Ferheng Nîşan/m. marke, sembol), "cuda" (Ferheng Cihê/n. Cuda), "tomar", "dane", "sepan"
  (pwap usage, see above), "hilbijêre", "vegerîne" (`unlock.restore`), "çêke" (çêkirin). "Bitikîne" for "tap" is
  common usage but not in the Ferheng (it has only "tikandin.") and not in pwap: flagged.
- **ckb**: "شاشەی سەرەکی" and "زیاد بکە" as in `home.a2hs`; "هاوبەش" as in `words.warnBody`; "دەست بنێ" for "tap" is a
  draft.
- **fa, ar**: drafts; "صفحه اصلی" and "الشاشة الرئيسية" as in `home.a2hs`.

### Overlay message by action (2026-10-17, PR #19 review)

The Kurdistan-sun overlay now says what the password is doing. `iwallet.unlocking` stays for opening the key (unlock,
showing the backup words, Settings). Two new keys:

| key | tr | en | kmr | ckb | fa | ar |
|---|---|---|---|---|---|---|
| `iwallet.saving` (a new or imported wallet is sealed) | Cüzdanın kaydediliyor… | Saving your wallet… | Cuzdanê te tê tomarkirin… | جزدانەکەت پاشەکەوت دەکرێت… | در حال ذخیرهٔ کیف پول شما… | جارٍ حفظ محفظتك… |
| `iwallet.signing` (a transfer or citizenship action is signed) | İmzalanıyor… | Signing… | Tê îmzekirin… | واژۆ دەکرێت… | در حال امضا… | جارٍ التوقيع… |

- kmr: "tê tomarkirin" as in `faceid.storage` / `error.notSaved`; "tê îmzekirin" as in `send.pending`.
- ckb: "پاشەکەوت" as in `faceid.storage`; "واژۆ دەکرێت" as in `send.pending`. fa and ar follow `send.pending` and
  `faceid.storage`. All four are drafts for a native reading.

### Short citizenship application (2026-10-17, Serok)

Only a hash goes on chain and the data stays in the browser, so the i-Wallet application now asks only for the full
name (kept on this device for the citizen card) and the optional referrer. The identity hash is now
`blake2(JSON.stringify({ fullName, walletAddress }))`, no longer pwap's nine-field recipe.

Removed keys, in all six files (ignore their entries in the fa / ar lists above):
`iwallet.citizen.form.fatherName`, `grandfatherName`, `motherName`, `tribe`, `marital`, `married`, `unmarried`,
`childrenCount`, `childName`, `birthYear`, `region`, `selectRegion`, `email`, `emailInvalid`, `profession`, and the
whole `iwallet.citizen.region.*` group (six regions). `form.privacy` and `form.agree` are unchanged.

Changed texts (tr and en are Serok's; kmr as below; ckb, fa, ar drafts):

| key | tr | en | kmr | ckb | fa | ar |
|---|---|---|---|---|---|---|
| `iwallet.home.citizen` (home button) | Vatandaşlık başvurusu | Citizenship application | Serlêdana welatîbûnê | داواکاری هاوڵاتیبوون | درخواست شهروندی | طلب المواطنة |
| `iwallet.citizen.pending.title` | Referansının onayı bekleniyor | Waiting for your referrer's approval | Li benda pejirandina referansê ye | چاوەڕوانی پەسەندکردنی ئاماژەکارەکەتە | در انتظار تأیید معرف شما | في انتظار موافقة المحيل |
| `iwallet.citizen.approved.title` | Referansın onayladı | Your referrer approved | Referansa te tu pejirandî | ئاماژەکارەکەت پەسەندی کردیت | معرف شما تأیید کرد | وافق المحيل عليك |
| `iwallet.citizen.approved.body` | Vatandaşlık sürecini tamamlamak için imzan gerekiyor. | Your signature is needed to complete your citizenship. | Ji bo temamkirina pêvajoya welatîbûnê îmzeya te pêwîst e. | بۆ تەواوکردنی پرۆسەی هاوڵاتیبوون واژۆکەت پێویستە. | برای تکمیل روند شهروندی، امضای شما لازم است. | توقيعك مطلوب لإكمال إجراءات المواطنة. |

`iwallet.citizen.citizen.title` already read tr "Vatandaşsın" / en "You are a citizen" / kmr "Tu welatî yî" (a person is
Welatî; Hevwelatî only for formal plural address) and is unchanged. The ar pending title is the old pwap text, kept.

- **kmr `approved.body` — flagged for native reading.** "Îmze", "temamkirin" and "pêvajo" are not headwords in the
  Ferheng, but each is used in its definitions: Qol/n. "… c) Îmze, dema lêkera kirinê têkeve dawiyê dibe îmzekirin";
  Rêkeft/m. "… rêkeftinek îmze kirin"; Jêrnivîs/m. "Imze, hemze, têbinî"; Tûmandin/m. "Kamekirin, temamkirin,
  îkmalkirin"; Têrker/m. "… temamkirin, komplement"; Rewend/m. "a) Reform, b) Pêvajo"; Deqn/m. "… di pêvajoya …".
  The Ferheng gives no gender for îmze; "îmzeya te" writes it feminine (as `iwallet.signing` "Tê îmzekirin" uses the
  verb). Pêwîst/m. is in the table above.
- **kmr `approved.title`**: "Referansa te tu pejirandî" is the ergative past (agent oblique, verb agreeing with "tu");
  "referansa" feminine as in `pending.body`. Flagged for native reading.
- kmr `pending.title`: "Li benda … ye" with Pejirandin/m.; `home.citizen`: Serlêdan/m. + ezafe "welatîbûnê".

### Population directorate button (2026-10-17, Serok)

The explorer's Citizenship tab has a second button under the experts button. It opens a dialog saying the service is
under construction. New keys, all six files:

| key | tr | en | kmr | ckb | fa | ar |
|---|---|---|---|---|---|---|
| `citizenship.directorate` | Nüfus ve Vatandaşlık İşleri Genel Müdürlüğü | General Directorate of Population and Citizenship Affairs | Rêveberiya Giştî ya Karên Gelhe û Welatîbûnê | بەڕێوەبەرایەتی گشتی کاروباری دانیشتوان و هاوڵاتیبوون | اداره کل امور جمعیت و شهروندی | المديرية العامة لشؤون السكان والمواطنة |
| `citizenship.soonTitle` | Yapım aşamasında | Under construction | Di qonaxa avakirinê de ye | لە قۆناغی دروستکردندایە | در دست ساخت | قيد الإنشاء |
| `citizenship.soonBody` | Bu hizmet yakında burada olacak. | This service will be available here soon. | Ev karûbar wê di demeke nêz de li vir be. | ئەم خزمەتگوزارییە بەم زووانە لێرە دەبێت. | این خدمت به‌زودی در اینجا در دسترس خواهد بود. | ستتوفر هذه الخدمة هنا قريبًا. |

- kmr Ferheng entries: Rêveberî/m. "Rayberî, rênîşanderî"; Giştî/m. "Tevek/ seranser"; Kar/m. "b) Şixul, şol, îş";
  Gelhe/m. "nifûs, kes, xelk"; Qonax/m. "Gihanek, qedem, raden"; Avakirin/m. "Şênkirin, ji bingehê ve çêkirin";
  Karûbar/m. "îşûmîş …"; Nêz/m. "Nedûr, nêzîk"; "demeke kurt" as in Bistik/m. and Rekem/m.
- kmr `soonBody` uses "karûbar" for "service" because "xizmet" is not in the Ferheng (only Xizmetî = kinship); flagged
  for native reading, as is the whole sentence.
- ckb, fa, ar: drafts. fa uses "جمعیت" for population rather than Iran's "ثبت احوال" (civil registration); a native
  reader should pick the official-sounding name.
