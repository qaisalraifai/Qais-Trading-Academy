import { createAdminClient } from "@/lib/supabase-server";

// يرجّع batch_id اللي الطالب مسجّل فيها فعليًا لدورة معينة، أو null لو لسا ما
// انسجّل بولا دفعة لهاي الدورة (يعني لازم يعدي أول على صفحة الدورة نفسها
// عشان يتسجّل تلقائيًا بالدفعة الافتراضية أو يختار دفعته — شوف app/course/[id]/page.js).
// تُستخدم من كل صفحات الطالب اللي لازم تفلتر محتواها حسب الدفعة (محاضرة، اختبار...).
//
// المرحلة 2 من إعادة تصميم الدفعات: الطالب هلأ ينسجّل بمستوى الدفعة (تسجيل
// وحدة بيفتح كل دورات الدفعة)، مش لكل دورة لحالها. عشان هيك صار في مسارين:
//   1) تسجيل جديد (batch-level): صف بـ batch_enrollments بدون course_id،
//      ونتأكد إن الدورة المطلوبة فعلًا ضمن دورات هاي الدفعة عبر batch_courses.
//   2) تسجيل قديم (course-level): صف بـ batch_enrollments له course_id محدد
//      زي ما كان النظام يشتغل قبل هاي المرحلة — يضل يشتغل بدون أي تغيير.
export async function getStudentBatchId(userId, courseId) {
  const admin = createAdminClient();

  const { data: enrollments } = await admin
    .from("batch_enrollments")
    .select("batch_id, course_id")
    .eq("user_id", userId);

  if (!enrollments || enrollments.length === 0) return null;

  // مسار 2: تسجيل قديم لنفس الدورة تحديدًا (أولوية، لأنه أدق)
  const legacyMatch = enrollments.find((e) => e.course_id === courseId);
  if (legacyMatch) return legacyMatch.batch_id;

  // مسار 1: تسجيل بمستوى الدفعة — نتأكد إن هاي الدورة ضمن دورات إحدى دفعاته
  const batchIds = [...new Set(enrollments.map((e) => e.batch_id))];
  if (batchIds.length === 0) return null;

  const { data: match } = await admin
    .from("batch_courses")
    .select("batch_id")
    .in("batch_id", batchIds)
    .eq("course_id", courseId)
    .maybeSingle();

  return match?.batch_id || null;
}
