import { NextResponse } from "next/server";
import { requireAdmin, extractVideoId } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("lectures")
    .select("*")
    .order("order_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lectures: data });
}

export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const {
    title, description, videoLink, video_provider, order_index,
    course_id, chapter, chapter_order, duration_minutes, difficulty, practice_type, batch_id,
  } = body;

  const provider = video_provider === "drive" ? "drive" : "youtube";

  if (!title || !videoLink) {
    return NextResponse.json(
      { error: "العنوان ورابط الفيديو مطلوبين" },
      { status: 400 }
    );
  }

  const fileId = extractVideoId(videoLink, provider);
  const supabase = createAdminClient();

  // لو ما تحدد ترتيب، حطها آخر وحدة
  let finalOrder = order_index;
  if (finalOrder === undefined || finalOrder === null || finalOrder === "") {
    const { data: maxRow } = await supabase
      .from("lectures")
      .select("order_index")
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    finalOrder = (maxRow?.order_index ?? 0) + 1;
  }

  const { data, error } = await supabase
    .from("lectures")
    .insert({
      title,
      description: description || null,
      youtube_video_id: fileId,
      video_provider: provider,
      order_index: finalOrder,
      course_id: course_id || null,
      batch_id: batch_id || null,
      chapter: chapter || null,
      chapter_order: chapter_order === "" || chapter_order === undefined ? null : Number(chapter_order),
      duration_seconds: duration_minutes ? Math.round(Number(duration_minutes) * 60) : null,
      difficulty: difficulty || null,
      practice_type: practice_type || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lecture: data });
}
