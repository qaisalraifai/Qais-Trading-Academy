# المرحلة 11 — الواجبات (جاهزة)

## شو رح يتغيّر
- المدرب/الأدمن بيقدر ينشئ واجب لأي دفعة (عنوان + وصف + موعد تسليم اختياري).
- الطالب بيشوف واجبات دفعته بس بصفحة الدورة، ويقدر يسلّم (ملف و/أو ملاحظة نصية).
- الطالب يقدر يعيد التسليم قبل ما يتقيّم (كل تسليم جديد بيلغي التقييم القديم تلقائيًا).
- الأدمن بيشوف كل التسليمات لكل واجب، ويحط درجة + ملاحظات، والطالب بيوصله إشعار فوري
  (نفس نظام الإشعارات من المرحلة 9).

## الملفات الجاهزة (انسخيها لمكانها بالـ repo مباشرة، بدون أي تعديل)

```
migration-batch-assignments.sql                                  → شغّليه بـ Supabase SQL Editor مرة وحدة

app/api/admin/batches/[id]/assignments/route.js                  → GET/POST (عرض/إنشاء واجب)
app/api/admin/batches/[id]/assignments/[assignmentId]/route.js   → PATCH/DELETE (تعديل/حذف واجب)
app/api/admin/assignments/[assignmentId]/submissions/route.js    → GET (كل تسليمات واجب معين)
app/api/admin/assignments/[assignmentId]/submissions/[submissionId]/route.js → PATCH (تقييم تسليم)

app/api/batches/assignments/route.js                              → GET (واجبات الطالب لدورة معينة)
app/api/batches/assignments/[assignmentId]/submit/route.js        → POST (تسليم/إعادة تسليم)

app/course/[id]/BatchAssignmentsPanel.js                          → واجهة الطالب (جاهزة، مستقلة)
```

## الملفات اللي محتاجة تعديل يدوي بسيط (تعليمات دقيقة مرفقة)
```
تعليمات-دمج-صفحة-الادمن.md    → إضافة زر + نافذة "الواجبات" بلوحة تحكم الدفعات
تعليمات-دمج-صفحة-الطالب.md    → إضافة سطرين بس بصفحة الدورة (import + render)
```

## ترتيب التنفيذ المقترح
1. شغّلي `migration-batch-assignments.sql` بـ Supabase.
2. انسخي كل ملفات الـ `app/api/...` والـ `BatchAssignmentsPanel.js` لمكانها بالضبط بالـ repo
   (نفس المسارات الموجودة بالأعلى — استبدلي أي مجلد ناقص لو ما كان موجود).
3. طبّقي تعليمات `تعليمات-دمج-صفحة-الطالب.md` (سطرين بس).
4. طبّقي تعليمات `تعليمات-دمج-صفحة-الادمن.md` (4 أجزاء صغيرة بنفس مكان نظام الملفات).
5. اعملي commit وpush متل العادة، وراجعي Changes tab بـ GitHub Desktop قبل ما تضغطي Commit
   (تأكدي إنه بس ملفات هاي المرحلة ظاهرة، مش آلاف الملفات).

بعد ما تخلصي وتتأكدي إنه كل شي شغال، قولي "نكمل على 12" ونبدأ المرحلة الجاية (الدردشة).
