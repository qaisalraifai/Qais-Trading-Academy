import { NextResponse } from "next/server";
import { requireAdmin, extractDriveFileId } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

export async function PUT(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { title, description, driveLink, order_index } = body;

  const updateData = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description || null;
  if (driveLink !== undefined) updateData.youtube_video_id = extractDriveFileId(driveLink);
  if (order_index !== undefined && order_index !== "") updateData.order_index = order_index;

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
