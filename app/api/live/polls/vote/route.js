import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

// POST /api/live/polls/vote { pollId, optionIndex }
export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const payload = await request.json().catch(() => ({}));
  const { pollId, optionIndex } = payload;
  if (!pollId || typeof optionIndex !== "number") {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: poll } = await admin.from("live_polls").select("is_closed").eq("id", pollId).maybeSingle();
  if (!poll) return NextResponse.json({ error: "الاستطلاع غير موجود" }, { status: 404 });
  if (poll.is_closed) return NextResponse.json({ error: "الاستطلاع مقفول" }, { status: 400 });

  const { error } = await admin
    .from("live_poll_votes")
    .upsert({ poll_id: pollId, user_id: user.id, option_index: optionIndex }, { onConflict: "poll_id,user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
