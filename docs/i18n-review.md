# i18n review list

Native-speaker review is required before launch for every row below marked "draft".
Turkish and English are written directly and are not listed.

- source "pwap": kmr and ckb are taken verbatim from the pezkuwichain/pwap repo (web/src/i18n/locales/kmr.ts and ckb.ts). fa and ar are always drafts.
- source "draft": written for this project, not reviewed by a native speaker. Some drafts reuse words found in pwap (pejirandeker, serlêdan, hemwelatî, pejirandî) in a new form; these still need review.
- source "dks.news": taken verbatim from the dks.news site (site/news.js; its `ku` is our ckb). fa and ar there are drafts too, so those rows stay marked draft.
- walletModal kmr: pwap verbatim except its "berîk" is written "cuzdan" (the owner's choice for this site, PR #8), masculine as in the Ferheng (Zeynelabidin): "Cuzdanê ku pere dixin navê" (Xelîtk), so "cuzdanê", never "cuzdana".
- source "brand": the product name, identical in every locale.
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
| home.citizenship | Hemwelatî | هاوڵاتیبوون | شهروندی | المواطنة | draft |
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
| citizenship.title | Hemwelatî | هاوڵاتیبوون | شهروندی | المواطنة | draft |
| citizenship.applied | Serlêdan hat kirin | داواکاری نێردرا | درخواست داده شد | تم تقديم الطلب | draft |
| citizenship.approved | Pejirandî | پەسەندکرا | تأیید شد | تمت الموافقة | draft |
| citizenship.citizen | Hemwelatî | هاوڵاتی | شهروند | مواطن | draft |
| citizenship.notStarted | Hîna serlêdan nehatiye kirin | هێشتا داواکاری نییە | هنوز درخواستی نیست | لا يوجد طلب بعد | draft |
| citizenship.revoked | Hemwelatî hat rakirin | هاوڵاتیبوون هەڵوەشێنرایەوە | شهروندی لغو شد | تم إلغاء المواطنة | draft |
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
| citizenship.card | Karta hemwelatiyê | کارتی هاوڵاتیبوون | کارت شهروندی | بطاقة المواطنة | draft (kmr "Karta hemwelatiyê" from the mockup; label of the citizen card) |
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
Beş, Gav, Karta hemwelatiyê) is a draft until a native speaker confirms it, as are all ckb, fa and ar cells. The
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

Written 2026-10-16 for the i-Wallet tab (Task 4). tr (Serok's own words) and en are not listed. Every row below is a draft that needs a native reading before launch; where a word was uncertain the English or Latin term was kept ("i-Wallet", "App Store", "Android", "iPhone", "Pezkuwi Wallet", "Pezkuwi"). kmr writes the wallet "cuzdan" (masculine "cuzdanê"). Rows are keyed `iwallet.<name>`; the tab label `tab.iwallet` is "i-Wallet" in every language (brand).

- iwallet.mainnet
- iwallet.warning.label, iwallet.warning.title, iwallet.warning.body1, iwallet.warning.body2, iwallet.warning.android
- iwallet.create.title, iwallet.create.body, iwallet.create.cta
- iwallet.import.cta
- iwallet.feature.send, iwallet.feature.citizen, iwallet.feature.balances
- iwallet.unavailable.title, iwallet.unavailable.body
- iwallet.locked.title, iwallet.home.title

Columns: kmr, ckb, fa, ar are all drafts (source "draft"). Words to check first: kmr "Tora sereke" (mainnet), "hişyarî" (warning), "dakêşe" (download), "Karûbarê demkî"; ckb "بیرگە" (storage), "کۆدکراو" (encrypted), "جزدانە پەیوەستبووەکان بە ئینتەرنێتەوە" (internet-connected wallets, used instead of "hot wallet").

Create, import and unlock screens (Task 5, 2026-10-16): every kmr, ckb, fa and ar cell of these rows is a draft needing a native reading; kmr writes "cuzdan", and "Face ID" stays Latin in every language. tr follows the approved mockup where it has the sentence, otherwise it is a draft too.

- iwallet.wizard.step, iwallet.next
- iwallet.words.title, iwallet.words.body, iwallet.words.list, iwallet.words.warnTitle, iwallet.words.warnBody, iwallet.words.ack
- iwallet.quiz.title, iwallet.quiz.body, iwallet.quiz.slot, iwallet.quiz.wrong, iwallet.quiz.verify
- iwallet.password.title, iwallet.password.body, iwallet.password.label, iwallet.password.repeat, iwallet.password.strength.1-4, iwallet.password.mismatch
- iwallet.faceid.title, iwallet.faceid.hint, iwallet.faceid.cancelled, iwallet.faceid.unavailable
- iwallet.create.submit, iwallet.create.working, iwallet.create.done, iwallet.create.openWallet
- iwallet.import.title, iwallet.import.body, iwallet.import.label, iwallet.import.invalid, iwallet.import.confirmTitle, iwallet.import.confirmBody, iwallet.import.confirmYes, iwallet.import.confirmNo, iwallet.import.submit
- iwallet.unlock.body, iwallet.unlock.submit, iwallet.unlock.working, iwallet.unlock.corrupt, iwallet.unlock.restore
- iwallet.error.wrongPassword, iwallet.error.notSaved, iwallet.error.generic

Wallet home, receive and settings (Task 6, 2026-10-16): kmr, ckb, fa and ar cells are drafts needing a native reading; tr follows the mockup where it has the sentence (hot-wallet strip, Send / Receive / Citizenship, asset names), the rest is a draft. kmr writes "cuzdan"; "JSON" and "Pezkuwi Asset Hub" stay Latin.

- iwallet.home.hot, iwallet.home.settings, iwallet.home.send, iwallet.home.receive, iwallet.home.citizen, iwallet.home.assets, iwallet.home.hezSub, iwallet.home.pezSub, iwallet.home.usdtSub, iwallet.home.parts, iwallet.home.a2hs
- iwallet.receive.title, iwallet.receive.body, iwallet.receive.qr, iwallet.receive.warn
- iwallet.settings.title, iwallet.settings.backup, iwallet.settings.backupBody, iwallet.settings.export, iwallet.settings.exportBody, iwallet.settings.lock, iwallet.settings.delete, iwallet.settings.deleteTitle, iwallet.settings.deleteBody, iwallet.settings.deleteConfirm, iwallet.settings.deleteFailed, iwallet.settings.show, iwallet.settings.hide

Fix round (Task 5, 2026-10-16): new drafts iwallet.faceid.storage, iwallet.faceid.enable, iwallet.faceid.enabled; reworded drafts iwallet.faceid.cancelled (now points to Settings) and iwallet.import.title, iwallet.import.body, iwallet.import.label, iwallet.import.invalid (12 or 24 words).

Fix round 1 (Task 6): iwallet.settings.faceOff, iwallet.settings.faceBody, iwallet.settings.faceDisabled (kmr, ckb, fa, ar drafts; tr/en written).
