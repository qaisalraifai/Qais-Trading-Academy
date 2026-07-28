import { randomUUID } from "crypto";

// كود شهادة قصير وقابل للقراءة، وبنفس الوقت فريد عمليًا (مبني على UUID).
// شكله مثلاً: QTA-8F3C1A2D
export function generateCertificateCode() {
  return `QTA-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

// يحسب نسبة إكمال طالب معيّن لكل محاضرات دفعته (المحاضرات المرتبطة بنفس الـ batch_id فقط،
// نفس منطق فلترة المحتوى بالمرحلة 6). يرجّع { total, completed, percent }.
export async function computeBatchProgress(admin, batchId, userId) {
  const { data: lectures } = await admin
    .from("lectures")
    .select("id")
    .eq("batch_id", batchId);

  const total = lectures?.length || 0;
  if (total === 0) return { total: 0, completed: 0, percent: 0 };

  const lectureIds = lectures.map((l) => l.id);
  const { data: progressRows } = await admin
    .from("lecture_progress")
    .select("lecture_id, completed")
    .eq("user_id", userId)
    .in("lecture_id", lectureIds)
    .eq("completed", true);

  const completed = progressRows?.length || 0;
  const percent = Math.round((completed / total) * 100);
  return { total, completed, percent };
}

// لو الطالب خلّص 100% من محاضرات دفعته وما عنده شهادة أصلاً، بتصدرله وحدة تلقائيًا.
// بترجّع الشهادة (سواء موجودة مسبقًا أو تلقائية جديدة)، أو null لو لسا ما وصل نسبة الإكمال.
export async function ensureAutoCertificate(admin, batchId, userId) {
  const { data: existing } = await admin
    .from("batch_certificates")
    .select("*")
    .eq("batch_id", batchId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing;

  const { percent, total } = await computeBatchProgress(admin, batchId, userId);
  if (total === 0 || percent < 100) return null;

  const { data: created, error } = await admin
    .from("batch_certificates")
    .insert({
      batch_id: batchId,
      user_id: userId,
      certificate_code: generateCertificateCode(),
      is_automatic: true,
      issued_by: null,
    })
    .select()
    .single();

  if (error) return null; // ممكن يحصل تعارض لحظي (طالب ثاني عمل نفس الإصدار)، تجاهل بأمان
  return created;
}
