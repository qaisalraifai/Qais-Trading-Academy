import { NextResponse } from "next/server";
import { requireAdmin, extractDriveFileId } from "@/lib/admin-auth";
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
  const { title, description, driveLink, order_index } = body;

  if (!title || !driveLink) {
    return NextResponse.json(
      { error: "العنوان ورابط Drive مطلوبين" },
      { status: 400 }
    );
  }

  const fileId = extractDriveFileId(driveLink);
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
      order_index: finalOrder,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lecture: data });
}
