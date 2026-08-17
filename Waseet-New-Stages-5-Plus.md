# الترتيب الجديد للمراحل 5 فما بعد — Course-sale Waseet-native

هذه القائمة تلغي ترتيب الباتشات القديم من المرحلة 5 فما بعد. الحزمة المسلّمة تطبق المراحل كلها في **باتش موحّد واحد**، لكن التقسيم التالي هو ترتيبها المعماري الصحيح للتدقيق والصيانة.

## PATCH 5 — Waseet Core والأمان

- جعل Waseet نظام الشحن الوحيد في الـBusiness Logic الجديد.
- عميل API خادمي مركزي: Login، Token Cache، مهلات، أخطاء موحّدة، وفاصل مركزي بين الطلبات.
- منع إرسال بيانات دخول الوسيط أو `SUPABASE_SERVICE_ROLE_KEY` إلى المتصفح.
- جلسة دخول موقعة وCookies آمنة في الإنتاج.
- Health endpoint إداري لاختبار المصادقة من دون كشف التوكن.

## PATCH 6 — قاعدة البيانات والترحيل الحقيقي

- نموذج `orders` جديد يفصل بين حالة السجل الداخلية وحالة المزامنة وحالة الشحنة في الوسيط.
- حفظ IDs وأسماء City/Region/Package Size الرسمية.
- استبدال `basePrice + deliveryFee` بحقل `collection_amount` لمبلغ التحصيل الكامل.
- إنشاء جداول Metadata والحالات التاريخية وAudit وAPI logs.
- Snapshot للبيانات القديمة قبل إزالة أعمدتها، مع حجب روابط/بيانات Waseet التي قد تحتوي Token.
- وضع الطلبات القديمة الناقصة في `manual_review` من دون تخمين أو إرسال تلقائي.
- RLS ومنع وصول anon/authenticated المباشر للجداول التشغيلية.

## PATCH 7 — Waseet Metadata ونموذج الطلب

- جلب Cities وRegions وPackage Sizes وStatuses من API الوسيط.
- Cache محلي كامل مع إبقاء آخر Snapshot صالح إذا فشل التحديث الجديد.
- Searchable Select للمحافظة والمنطقة؛ المنطقة مرتبطة بالمحافظة المختارة.
- منع “المحافظة غير معروفة = بغداد”، ومنع اختيار أول Region.
- منع `package_size = 1` الثابت؛ الاختيار من أحجام الوسيط الفعلية.
- فصل Region الرسمي عن تفاصيل العنوان ونقطة الدالة.
- Validation من الواجهة والخادم وقاعدة البيانات.

## PATCH 8 — AI Parser 2.0 وملء النموذج

- فهم الأرقام العربية والإنجليزية وصيغ `+964` والكتابة العراقية غير المرتبة.
- استخراج الاسم، الهاتفين، المحافظة، المنطقة، العنوان، الدالة، المبلغ، القطع، نوع الطلب والملاحظات.
- تطبيع عربي وExact/Alias/Fuzzy matching مقابل Metadata الرسمية.
- Confidence واقتراحات؛ لا اختيار عشوائي عند الالتباس.
- تعبئة نفس State الخاصة بالنموذج والـSearchable Select، لا نسخة منفصلة للـAI.
- Preview ومراجعة إلزامية قبل الحفظ أو الإرسال.

## PATCH 9 — الإنشاء الذري ومنع تكرار الطلب

- إنشاء الطلب وحجز كود الدورة داخل RPC ذرية واحدة.
- Idempotency عبر رقم الوصل وبصمة Payload.
- منع استهلاك كود جديد عند تكرار نفس الحفظ أو فقدان استجابة الحفظ.
- منع تغيير دورة طلب محجوز له كود من دورة أخرى.
- إصلاح Code Vault وإضافة `/api/codes` الفعلي مع حماية الأكواد المستخدمة.

## PATCH 10 — Single Dispatch وWorkflow عدم اليقين

- Preview وإرسال طلب واحد إلى `create-order` من الخادم.
- حجز محاولة الإرسال في قاعدة البيانات قبل الاتصال.
- عدم إعادة Create تلقائياً عند Timeout أو استجابة غير قابلة للقراءة.
- حالة `needs_verification` عند احتمال أن الوسيط أنشأ الشحنة من دون تثبيت النتيجة محلياً.
- إجراء مدير لربط رقم الشحنة الحقيقي أو تأكيد عدم إنشائها بعد الفحص.
- منع أرشفة طلب ذي محاولة إرسال غير محسومة.

## PATCH 11 — التعديل والحالة الحية والطباعة

- استخدام `edit-order` عند تعديل شحنة مرسلة، وعرض سبب الرفض من الوسيط.
- منع اختلاف صامت بين بيانات Course-sale وبيانات الوسيط عند Timeout غير محسوم.
- مزامنة حالة الشحنة من Waseet API إلى قاعدة البيانات ثم الواجهة.
- حفظ Driver/Issue Notes، الرسوم المالية، وآخر وقت مزامنة.
- سجل كامل لانتقالات الحالة.
- Proxy خادمي لملصق PDF؛ تخزين رابط منـزوع التوكن وإضافة Token حديث لحظة الطباعة.

## PATCH 12 — Bulk Sync وBulk Dispatch

- اختيار مجموعة طلبات وإرسالها بالتسلسل مع نتيجة مستقلة لكل طلب.
- عدم إعادة إرسال الطلب الناجح أو الطلب الذي يحتاج تحققاً.
- مزامنة بحد أقصى 25 Waseet Order IDs في الدفعة.
- فاصل مركزي محافظ واحترام Rate Limit.
- Progress ونجاح/فشل واضحان لكل طلب.

## PATCH 13 — الطلبات والأداء والـResponsive

- Server pagination وServer search وفلاتر City/Region/Sync/Status/Date.
- عدم تحميل جميع الطلبات عند فتح الصفحة.
- Statistics endpoint منفصل.
- واجهة الطلبات تعرض المبلغ، QR، حالة الوسيط، Sync state، آخر تحديث وملاحظات المشكلة.
- دعم Desktop/Laptop/Tablet/Mobile من دون إبقاء Columns النظام القديم.

## PATCH 14 — المالية والمراقبة

- قراءة فواتير الوسيط وطلبات الفاتورة من الخادم فقط.
- عرض `company_price`, `city_fees`, `merchant_price`, `cash_fee`, `delivery_price` كمخرجات من الوسيط، لا كقيم يخمنها نموذج الطلب.
- Audit log لكل Dispatch/Edit/Sync/Archive/Resolution.
- API log لزمن الطلب، النتيجة، Request ID والخطأ من دون تخزين الأسرار.

## PATCH 15 — Legacy Extermination وFinal QA

- إزالة order statuses المحلية وProducts/Shipping helpers والحقول المالية والشحنية القديمة المتعارضة.
- إزالة Routes وImports وTypes وStates الميتة.
- التحقق من عدم وجود مراجع إلى `basePrice`, `deliveryFee`, `totalPrice`, Prime أو حقول Waseet prototype القديمة داخل Runtime source.
- فحص TypeScript/TSX، الاستيرادات المحلية، package-lock، SQL، وسلامة ZIP.
- تشغيل `npm ci && npm run validate` في بيئة متصلة قبل النشر النهائي.

## التدفق النهائي

```text
رسالة الطالب / إدخال يدوي
        ↓
AI Extraction + Review
        ↓
Waseet-native Order Form
        ↓
Waseet City → Waseet Region
        ↓
Address + Amount + Package Size
        ↓
Server + Database Validation
        ↓
Atomic Local Order + Code Reservation
        ↓
Single/Bulk Dispatch with Duplicate Protection
        ↓
Waseet Shipment + QR Label
        ↓
Waseet Status Sync
        ↓
Delivered / Returned / Any Official Waseet Status
```
