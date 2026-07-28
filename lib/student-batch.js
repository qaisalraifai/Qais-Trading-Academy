import { createAdminClient } from "@/lib/supabase-server";

// يرجّع batch_id اللي الطالب مسجّل فيها فعليًا لدورة معينة، أو null لو لسا ما
// انسجّل بولا دفعة لهاي الدورة (يعني لازم يعدي أول على صفحة الدورة نفسها
// عشان يتسجّل تلقائيًا بالدفعة الافتراضية أو يختار دفعته — شوف app/course/[id]/page.js).
// تُستخدم من كل صفحات الطالب اللي لازم تفلتر محتواها حسب الدفعة (محاضرة، اختبار...).
export async function getStudentBatchId(userId, courseId) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("batch_enrollments")
    .select("batch_id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();
  return data?.batch_id || null;
}
