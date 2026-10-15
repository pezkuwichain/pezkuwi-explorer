# i18n review list

Native-speaker review is required before launch for every row below marked "draft".
Turkish and English are written directly and are not listed.

- source "pwap": kmr and ckb are taken verbatim from the pezkuwichain/pwap repo (web/src/i18n/locales/kmr.ts and ckb.ts). fa and ar are always drafts.
- source "draft": written for this project, not reviewed by a native speaker. Some drafts reuse words found in pwap (pejirandeker, serlêdan, hemwelatî, pejirandî) in a new form; these still need review.
- source "brand": the product name, identical in every locale.
- Row account.failed: the kmr cell is verbatim from pwap (settingsScreen.biometricAlerts.failedTitle, "Bi ser neket"); ckb, fa and ar are drafts. The row is therefore marked "draft (kmr: pwap verbatim)".

| key | kmr | ckb | fa | ar | source |
|---|---|---|---|---|---|
| app.name | Pezkuwi Explorer | Pezkuwi Explorer | Pezkuwi Explorer | Pezkuwi Explorer | brand |
| app.experts | Ji bo pisporan: &lt;domain&gt;apps.pezkuwichain.io&lt;/domain&gt; | بۆ شارەزایان: &lt;domain&gt;apps.pezkuwichain.io&lt;/domain&gt; | برای متخصصان: &lt;domain&gt;apps.pezkuwichain.io&lt;/domain&gt; | للخبراء: &lt;domain&gt;apps.pezkuwichain.io&lt;/domain&gt; | draft (the domain tag marks the left-to-right part; keep it around the domain) |
| app.back | Paşve | گەڕانەوە | بازگشت | رجوع | pwap |
| app.language | Ziman | زمان | زبان | اللغة | pwap |
| home.account | Hesabê min | هەژمارەکەم | حساب من | حسابي | draft |
| home.payment | Dayîna min gihîşt? | پارەدانەکەم گەیشت؟ | پرداخت من رسید؟ | هل وصلت دفعتي؟ | draft |
| home.citizenship | Hemwelatî | هاوڵاتیبوون | شهروندی | المواطنة | draft |
| home.network | Tor | تۆڕ | شبکه | الشبكة | pwap |
| status.up | Tor dixebite | تۆڕ کار دەکات | شبکه کار می‌کند | الشبكة تعمل | draft |
| status.down | Tor bersiv nade | تۆڕ وەڵام نادات | شبکه پاسخ نمی‌دهد | الشبكة لا تستجيب | draft |
| status.checking | Tor tê kontrol kirin… | تۆڕ دەپشکنرێت… | در حال بررسی شبکه… | جارٍ فحص الشبكة… | draft |
| open.title | Hesabê xwe veke | هەژمارەکەت بکەرەوە | حساب خود را باز کنید | افتح حسابك | draft |
| open.wallet | Bi berîka xwe veke | بە جزدانەکەم بیکەرەوە | با کیف پول من باز کن | افتح بمحفظتي | draft |
| open.wcHint | Heke berîka te venebe, vegere û li şûna wê navnîşana xwe bixe vir an jî koda QR bişopîne. | ئەگەر جزدانەکەت نەکرایەوە، بگەڕێوە و لەجیاتی ئەوە ناونیشانەکەت دابنێ یان سکانی بکە. | اگر کیف پول شما باز نشد، برگردید و به جای آن آدرس خود را بچسبانید یا اسکن کنید. | إذا لم تُفتح محفظتك، ارجع والصق عنوانك أو امسحه ضوئيًا بدلًا من ذلك. | draft (shown under the wallet link; some wallets, e.g. on iOS, do not open from it) |
| open.scan | Koda QR Bişopîne | سکانی کۆدی QR بکە | اسکن QR | مسح رمز QR | pwap |
| open.paste | Navnîşanê bixe vir | ناونیشان لێرە دابنێ | چسباندن آدرس | لصق العنوان | draft |
| open.pastePlaceholder | Navnîşana xwe li vir bixe | ناونیشانەکەت لێرە دابنێ | آدرس خود را اینجا بچسبانید | الصق عنوانك هنا | draft |
| open.invalid | Ev navnîşan ne derbasdar e. Kontrol bike û dîsa biceribîne. | ئەم ناونیشانە دروست نییە. بیپشکنە و دووبارە هەوڵبدەرەوە. | این آدرس معتبر نیست. آن را بررسی کنید و دوباره تلاش کنید. | هذا العنوان غير صالح. تحقق منه وحاول مجددًا. | draft |
| open.noWallet | Li ser vê cîhazê berîkeke Pezkuwi nehat dîtin. | لەم ئامێرەدا جزدانی Pezkuwi نەدۆزرایەوە. | هیچ کیف پول Pezkuwi در این دستگاه پیدا نشد. | لم يتم العثور على محفظة Pezkuwi على هذا الجهاز. | draft |
| open.rejected | Berîkê hesabek parve nekir. | جزدانەکە هەژمارێکی هاوبەش نەکرد. | کیف پول حسابی را به اشتراک نگذاشت. | لم تشارك المحفظة أي حساب. | draft |
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

Notes on tiki.*: the English and Turkish role names are also unreviewed renderings of Kurmanci titles. Rewsenbir is rendered as "Creator" (not "Writer"; see project decision). Feqi ("Religious Student"), Axa ("Aga"), Hekem ("Arbiter"), Pêseng ("Pioneer"), Karguzar ("Administrator") are culturally loaded and need a native-speaker check in every language.

Redesign (2026-10-15): the rows from tab.label to network.nay and the chain.* row were added with the approved
mockup. Every kmr word the mockup introduced (Mal, Hesab, Îro, Duh, Te wergirt, Te şand, Mîqdar, Kopî bike, Erê, Na,
Beş, Gav, Karta hemwelatiyê) is a draft until a native speaker confirms it, as are all ckb, fa and ar cells. The
mockup's "2 saet berê" is not a new string: relative times come from time.* ("Berî 2 saet") where the browser has no
Kurmanji relative-time data. The role name Perwerdekar shown on the citizen screen is the on-chain variant (tiki.*).
