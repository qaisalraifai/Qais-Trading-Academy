import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { assertLiveSessionAccess } from "@/lib/live-access";

// GET /api/live/polls?sessionId=... — كل الاستطلاعات بهالبث + نتائجها
export async function GET(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId مطلوب" }, { status: 400 });

  const admin = createAdminClient();
  const access = await assertLiveSessionAccess(admin, user.id, sessionId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { data: polls, error } = await admin
    .from("live_polls")
    .select("id, question, options, is_closed, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pollIds = (polls || []).map((p) => p.id);
  let votes = [];
  if (pollIds.length) {
    const { data } = await admin.from("live_poll_votes").select("poll_id, user_id, option_index").in("poll_id", pollIds);
    votes = data || [];
  }

  const result = (polls || []).map((p) => {
    const pollVotes = votes.filter((v) => v.poll_id === p.id);
    const tally = p.options.map((_, i) => pollVotes.filter((v) => v.option_index === i).length);
    const myVote = pollVotes.find((v) => v.user_id === user.id)?.option_index ?? null;
    return { ...p, tally, totalVotes: pollVotes.length, myVote };
  });

  return NextResponse.json({ polls: result });
}

// POST /api/live/polls { sessionId, question, options[] } — بس المدرب/المشرف
export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const payload = await request.json().catch(() => ({}));
  const { sessionId, question, options } = payload;
  if (!sessionId || !question?.trim() || !Array.isArray(options) || options.length < 2) {
    return NextResponse.json({ error: "بيانات الاستطلاع ناقصة" }, { status: 400 });
  }

  const admin = createAdminClient();
  const access = await assertLiveSessionAccess(admin, user.id, sessionId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (access.role === "student") return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  const { data, error } = await admin
    .from("live_polls")
    .insert({ session_id: sessionId, question: question.trim(), options, created_by: user.id })
    .select("id, question, options, is_closed, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ poll: data });
}

// PATCH /api/live/polls { pollId, sessionId } — يقفل استطلاع (مدرب/مشرف)
export async function PATCH(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const admin = createAdminClient();
  const payload = await request.json().catch(() => ({}));
  const { pollId, sessionId } = payload;
  if (!pollId || !sessionId) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const access = await assertLiveSessionAccess(admin, user.id, sessionId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (access.role === "student") return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  const { error } = await admin
    .from("live_polls")
    .update({ is_closed: true, closed_at: new Date().toISOString() })
    .eq("id", pollId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
