// محرك وضع الأعضاء بالشجرة الثنائية (الفصل 15 من الخطة)
// القاعدة المعتمدة (بناءً على قرار المالك):
//   - كل عضو جديد لازم يجي عن طريق كود دعوة (sponsor) — ممنوع تسجيل بدونه.
//   - يُوضع العضو الجديد في أقرب مكان فاضٍ داخل شجرة الراعي نفسه فقط
//     (مش Spillover عام على مستوى الشركة كلها).
//   - البحث بالعرض (BFS) بدءًا من الراعي، يسار قبل يمين، حتى نلاقي أول
//     مكان فاضي — هاد يضمن توزيع متوازن وسريع.

import { logActivity } from "@/lib/activity-log";

/**
 * يلاقي أقرب مكان فاضي بشجرة الراعي (BFS، يسار قبل يمين) ويرجع
 * { parentId, leg }. ما بيلمس قاعدة البيانات — قراءة فقط.
 */
async function findNearestEmptySlot(supabaseAdmin, sponsorId) {
  const queue = [sponsorId];
  const visited = new Set();

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const { data: children, error } = await supabaseAdmin
      .from("profiles")
      .select("id, leg")
      .eq("parent_id", currentId);

    if (error) throw new Error(`findNearestEmptySlot: ${error.message}`);

    const leftChild = (children || []).find((c) => c.leg === "left");
    const rightChild = (children || []).find((c) => c.leg === "right");

    if (!leftChild) return { parentId: currentId, leg: "left" };
    if (!rightChild) return { parentId: currentId, leg: "right" };

    // الاثنان معبّيين — كمّل البحث بالمستوى التالي، يسار قبل يمين
    queue.push(leftChild.id, rightChild.id);
  }

  // نظريًا ما لازم توصل هون إلا لو في مشكلة بالبيانات
  throw new Error("findNearestEmptySlot: لم يتم إيجاد مكان فاضٍ (تحقق من سلامة الشجرة)");
}

/**
 * يحدّث cv_left/cv_right لكل الأجداد بعد إضافة عضو جديد بقيمة CV مبدئية (عادة 0
 * عند التسجيل، وتُحدَّث فعليًا عند أول دفعة — انظر compensation engine لاحقًا).
 * موجودة هون كنقطة توسعة مستقبلية فقط.
 */
async function bumpAncestorsCv(supabaseAdmin, startParentId, leg, cvDelta) {
  if (!cvDelta) return;
  let currentParentId = startParentId;
  let currentLeg = leg;

  while (currentParentId) {
    const column = currentLeg === "left" ? "cv_left" : "cv_right";
    const { data: parent, error } = await supabaseAdmin
      .from("profiles")
      .select(`id, parent_id, leg, ${column}`)
      .eq("id", currentParentId)
      .single();

    if (error || !parent) break;

    await supabaseAdmin
      .from("profiles")
      .update({ [column]: Number(parent[column] || 0) + cvDelta })
      .eq("id", currentParentId);

    currentLeg = parent.leg;
    currentParentId = parent.parent_id;
  }
}

/**
 * نقطة الدخول الرئيسية: تضع عضو جديد بالشجرة تحت راعيه.
 * لازم تُستدعى مرة وحدة بس لكل عضو (بعد إنشاء صف profiles مباشرة).
 *
 * @param {object} supabaseAdmin - عميل Service Role
 * @param {string} newUserId - id العضو الجديد (لازم يكون موجود مسبقًا بـ profiles)
 * @param {string} sponsorId - id الراعي (إلزامي — ما في تسجيل بدون كود دعوة)
 */
export async function placeNewMember(supabaseAdmin, newUserId, sponsorId) {
  if (!sponsorId) {
    throw new Error("placeNewMember: sponsorId مطلوب — التسجيل بدون كود دعوة غير مسموح");
  }
  if (!newUserId) {
    throw new Error("placeNewMember: newUserId مطلوب");
  }

  const { data: sponsor, error: sponsorError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", sponsorId)
    .maybeSingle();

  if (sponsorError || !sponsor) {
    throw new Error("placeNewMember: الراعي غير موجود");
  }

  const { parentId, leg } = await findNearestEmptySlot(supabaseAdmin, sponsorId);

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ sponsor_id: sponsorId, parent_id: parentId, leg })
    .eq("id", newUserId);

  if (updateError) {
    throw new Error(`placeNewMember: فشل تثبيت المكان — ${updateError.message}`);
  }

  await logActivity(newUserId, "note", "تم وضع العضو بالشجرة الثنائية", {
    sponsorId,
    parentId,
    leg,
  }).catch((e) => console.error("logActivity failed:", e.message));

  return { parentId, leg };
}

export { bumpAncestorsCv };
