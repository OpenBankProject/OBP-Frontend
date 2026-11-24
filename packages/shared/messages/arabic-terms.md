# Arabic term list

The Arabic words used for the main terms in the OBP-Frontend apps, starting with the Conformator. Every Arabic message in `ar.json` uses these words, so the same thing is always called the same. A model wrote the first version; a native speaker reviews this list first, then the messages.

To change a term, change it here and in every message that uses it.

## How the Arabic is written

- Modern Standard Arabic, in a formal, plain style suitable for a regulator and banks.
- Buttons and menu items are short: a noun (الإعداد) or an imperative (تحقّق من تقرير).
- Product names stay in Latin letters: Conformator, OBP-API, API Manager, Portal, Opey, GitHub.
- Codes stay exactly as they are: Role names (CanGetAnyUser), API versions (v5.1.0), account numbers, IDs, URLs, JSON field names.
- Numbers and dates follow the installation's `ARABIC_DIGITS` setting (Western 123 by default, or Arabic-Indic ١٢٣).

## Terms

| English | Arabic | Notes |
|---|---|---|
| conformance | المطابقة | As in conformance testing: اختبار المطابقة |
| conformance report | تقرير المطابقة | |
| signed report | تقرير موقّع رقمياً | Signed with the regulator's key |
| regulator | الجهة الرقابية | The organisation running Conformator, not named in the app |
| regulator's staff | موظفو الجهة الرقابية | Menu heading: الموظفون |
| participant | المشارك (المشاركون) | A bank or other firm being tested |
| organisation | المؤسسة | "Your organisation": مؤسستك |
| space | مساحة العمل | A participant's own area in Conformator; the menu says مؤسستك |
| system | النظام (الأنظمة) | A participant's API system under test |
| test | الاختبار (الاختبارات) | |
| test suite | مجموعة الاختبار (مجموعات الاختبار) | |
| test catalogue | دليل الاختبارات | The list of suites and tests |
| test run | تشغيل الاختبار (عمليات التشغيل) | |
| requirement | المتطلب (المتطلبات) | A rule from the regulator that tests check |
| evidence | الأدلة | What a run records to show the result |
| assessment | التقييم | A reviewer's judgement on evidence |
| waiver | الإعفاء | Permission not to meet a requirement |
| appeal | التظلّم | A participant asks for a decision to be looked at again |
| submission | الطلب المقدَّم (الطلبات المقدَّمة) | A finished run sent for review |
| runner | المشغّل | The separate service that calls participants' systems |
| outcome | النتيجة | pass ناجح, fail راسب, blocked متوقف, not executed لم يُنفَّذ, not applicable غير منطبق |
| mandatory | إلزامي | |
| severity | درجة الخطورة | critical حرجة, high مرتفعة, medium متوسطة, low منخفضة |
| automated test | اختبار آلي | |
| evidence review | مراجعة الأدلة | A kind of test |
| organisational control | ضابط تنظيمي | A kind of test |
| test platform | منصة الاختبار | Conformator and its runner, as opposed to the participant's side |
| reference (of a report) | الرقم المرجعي | Such as CR-2026-7K3QX9MD |
| public key | المفتاح العام | |
| hash | قيمة التجزئة (hash) | |
| withdrawn / superseded / expired | مسحوب / مستبدَل / منتهي الصلاحية | A report's standing; valid is ساري المفعول |
| review | المراجعة | |
| reviewer | المراجِع (المراجعون) | |
| approval | الاعتماد | Of a report |
| approver | المعتمِد (المعتمِدون) | The person who makes the final decision |
| separation of duties | الفصل بين المهام | The person who approves is not the person who reviewed |
| Role | الدور (الأدوار) | An OBP-API Role (entitlement); the Role's own name stays in Latin letters |
| administrator | المسؤول | An OBP-API administrator |
| Consumer, Platform App, Scope | Consumer، Platform App، النطاق (Scope) | OBP-API terms: Consumer and Platform App stay in Latin letters; Scope is النطاق with (Scope) after it |
| client id, token | معرّف العميل (client id)، الرمز المميز (token) | |
| endpoint | نقطة النهاية (نقاط النهاية) | An API endpoint |
| API | واجهة برمجة التطبيقات | "API" in Latin letters is fine in technical text |
| open banking | الخدمات المصرفية المفتوحة | |
| sandbox | البيئة التجريبية | |
| example data | بيانات نموذجية | |
| dashboard | لوحة المعلومات | |
| setup | الإعداد | |
| Prepare Conformator for Use | تهيئة Conformator للاستخدام | The page that lists everyone's steps |
| log in / log out | تسجيل الدخول / تسجيل الخروج | |
| My Account | حسابي | |
| About | حول | |
