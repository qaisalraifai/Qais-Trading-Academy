// طبقة موحّدة لتحديد: هل هاد المستخدم مسموحله يوصل لبث معيّن، وشو دوره فيه
// (host / moderator / student) — مبنية على نظام الدفعات (batches) الموجود
// أصلاً بالمنصة. كل بث مرتبط إجباريًا بدفعة (live_sessions.batch_id).

import { LIVE_ROLES } from "@/lib/livekit-server";

/**
 * بيرجع كل الدفعات اللي المستخدم مسجّل فيها كطالب، وكل الدفعات اللي هو مدرب
 * فيها (batch_instructors)، وهل هو أدمن عام.
 */
export async function getUserBatchMembership(admin, userId) {
  const [{ data: profile }, { data: enrollments }, { data: instructorRows }] = await Promise.all([
    admin.from("profiles").select("role, username").eq("id", userId).maybeSingle(),
    admin.from("batch_enrollments").select("batch_id").eq("user_id", userId),
    admin.from("batch_instructors").select("batch_id").eq("instructor_id", userId),
  ]);

  return {
    isGlobalAdmin: profile?.role === "admin",
    username: profile?.username || null,
    enrolledBatchIds: new Set((enrollments || []).map((e) => e.batch_id)),
    instructorBatchIds: new Set((instructorRows || []).map((r) => r.batch_id)),
  };
}

/**
 * بيتحقق إذا المستخدم مسموحله يوصل لبث معيّن، ويحدد دوره فيه.
 * بيرجع { ok:false, status, error } أو { ok:true, role, session }.
 */
export async function assertLiveSessionAccess(admin, userId, sessionId) {
  const { data: session } = await admin
    .from("live_sessions")
    .select("id, room_name, title, description, is_active, batch_id, egress_id, recording_status")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return { ok: false, status: 404, error: "البث غير موجود" };

  const membership = await getUserBatchMembership(admin, userId);

  const isHost = membership.isGlobalAdmin || (session.batch_id && membership.instructorBatchIds.has(session.batch_id));
  const isEnrolled = session.batch_id && membership.enrolledBatchIds.has(session.batch_id);

  if (!isHost && !isEnrolled) {
    return { ok: false, status: 403, error: "أنتِ مو مسجّلة بدفعة هاد البث" };
  }

  let role = LIVE_ROLES.student;
  if (isHost) {
    role = LIVE_ROLES.host;
  } else {
    const { data: mod } = await admin
      .from("live_moderators")
      .select("user_id")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (mod) role = LIVE_ROLES.moderator;
  }

  return { ok: true, role, session, username: membership.username };
}

/**
 * كل البثوث النشطة هلأ اللي المستخدم مسموحله يشوفها وينضم لها:
 * أدمن عام أو مدرب دفعة → كل بثوث دفعاته + كل البثوث لو أدمن عام،
 * طالب → بس بثوث الدفعات اللي مسجّل فيها.
 */
export async function getAccessibleActiveSessions(admin, userId) {
  const membership = await getUserBatchMembership(admin, userId);

  let query = admin
    .from("live_sessions")
    .select("id, room_name, title, description, started_at, batch_id, recording_status, batches(name, course_id, courses(title))")
    .eq("is_active", true)
    .order("started_at", { ascending: false });

  if (!membership.isGlobalAdmin) {
    const allowedBatchIds = [...new Set([...membership.enrolledBatchIds, ...membership.instructorBatchIds])];
    if (allowedBatchIds.length === 0) return [];
    query = query.in("batch_id", allowedBatchIds);
  }

  const { data } = await query;
  return data || [];
}
