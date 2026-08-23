import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { assertLiveSessionAccess } from "@/lib/live-access";

// GET /api/live/qna?sessionId=...
export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId مطلوب" }, { status: 400 });

  const admin = createAdminClient();
  const access = await assertLiveSessionAccess(admin, user.id, sessionId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { data, error } = await admin
    .from("live_qna")
    .select("id, username, question, is_answered, upvotes, created_at")
    .eq("session_id", sessionId)
    .order("upvotes", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ questions: data || [] });
}

// POST /api/live/qna { sessionId, question }
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const payload = await request.json().catch(() => ({}));
  const { sessionId, question } = payload;
  if (!sessionId || !question?.trim()) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const admin = createAdminClient();
  const access = await assertLiveSessionAccess(admin, user.id, sessionId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { data, error } = await admin
    .from("live_qna")
    .insert({ session_id: sessionId, user_id: user.id, username: access.username || "مستخدم", question: question.trim() })
    .select("id, username, question, is_answered, upvotes, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ question: data });
}

// PATCH /api/live/qna { id, sessionId, action } — action: 'upvote' | 'answer' (answer بس للمدرب/المشرف)
export async function PATCH(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const admin = createAdminClient();
  const payload = await request.json().catch(() => ({}));
  const { id, sessionId, action } = payload;
  if (!id || !sessionId || !action) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const access = await assertLiveSessionAccess(admin, user.id, sessionId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  if (action === "upvote") {
    const { data: row } = await admin.from("live_qna").select("upvotes").eq("id", id).maybeSingle();
    if (!row) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    const { error } = await admin.from("live_qna").update({ upvotes: row.upvotes + 1 }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (action === "answer") {
    if (access.role === "student") return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
    const { error } = await admin.from("live_qna").update({ is_answered: true }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
