import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("order_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ courses: data });
}

export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { title, description, icon, order_index } = body;

  if (!title) {
    return NextResponse.json({ error: "عنوان الكورس مطلوب" }, { status: 400 });
  }

  const supabase = createAdminClient();

  let finalOrder = order_index;
  if (finalOrder === undefined || finalOrder === null || finalOrder === "") {
    const { data: maxRow } = await supabase
      .from("courses")
      .select("order_index")
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    finalOrder = (maxRow?.order_index ?? 0) + 1;
  }

  const { data, error } = await supabase
    .from("courses")
    .insert({
      title,
      description: description || null,
      icon: icon || "📚",
      order_index: finalOrder,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // كل دفعة موجودة أصلًا لازم تاخد هاي الدورة الجديدة تلقائيًا — بدون أي إعداد يدوي
  const { data: allBatches } = await supabase.from("batches").select("id");
  if (allBatches?.length) {
    await supabase.from("batch_courses").insert(
      allBatches.map((b) => ({ batch_id: b.id, course_id: data.id, order_index: finalOrder, status: "not_started" }))
    );
  }

  return NextResponse.json({ course: data });
}
