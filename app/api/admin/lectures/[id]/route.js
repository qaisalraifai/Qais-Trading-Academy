import { NextResponse } from "next/server";
import { requireAdmin, extractVideoId } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

export async function PUT(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const {
    title, description, videoLink, video_provider, order_index,
    course_id, chapter, chapter_order, duration_minutes, difficulty, practice_type,
  } = body;

  const provider = video_provider === "drive" ? "drive" : "youtube";

  const updateData = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description || null;
  if (video_provider !== undefined) updateData.video_provider = provider;
  if (videoLink !== undefined) updateData.youtube_video_id = extractVideoId(videoLink, provider);
  if (order_index !== undefined && order_index !== "") updateData.order_index = order_index;
  if (course_id !== undefined) updateData.course_id = course_id || null;
  if (chapter !== undefined) updateData.chapter = chapter || null;
  if (chapter_order !== undefined) updateData.chapter_order = chapter_order === "" ? null : Number(chapter_order);
  if (duration_minutes !== undefined) updateData.duration_seconds = duration_minutes === "" ? null : Math.round(Number(duration_minutes) * 60);
  if (difficulty !== undefined) updateData.difficulty = difficulty || null;
  if (practice_type !== undefined) updateData.practice_type = practice_type || null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("lectures")
    .update(updateData)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lecture: data });
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("lectures").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
