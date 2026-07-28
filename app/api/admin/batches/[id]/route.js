import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// PUT /api/admin/batches/[id] — تعديل بيانات دفعة
// ملاحظة: course_id و is_default ما بتتغيّر من هون عمدًا
export async function PUT(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const { name, instructor_id, start_date, end_date, seats_total, registration_status } = body;

  const updateData = {};
  if (name !== undefined) {
    if (!name.trim()) return NextResponse.json({ error: "اسم الدفعة مطلوب" }, { status: 400 });
    updateData.name = name.trim();
  }
  if (instructor_id !== undefined) updateData.instructor_id = instructor_id || null;
  if (start_date !== undefined) updateData.start_date = start_date || null;
  if (end_date !== undefined) updateData.end_date = end_date || null;
  if (registration_status !== undefined) {
    updateData.registration_status = registration_status === "closed" ? "closed" : "open";
  }

  const supabase = createAdminClient();

  if (seats_total !== undefined) {
    if (seats_total === null || seats_total === "") {
      updateData.seats_total = null;
    } else {
      const n = Number(seats_total);
      if (!n || n <= 0) {
        return NextResponse.json({ error: "عدد المقاعد لازم يكون رقم أكبر من صفر" }, { status: 400 });
      }
      // ما نسمح ننقص المقاعد لتحت عدد الطلاب المسجلين فعليًا
      const { count } = await supabase
        .from("batch_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", params.id);
      if (count && n < count) {
        return NextResponse.json(
          { error: `مافي فيك تنزلي المقاعد لتحت ${count} — هاد عدد الطلاب المسجلين فعليًا` },
          { status: 400 }
        );
      }
      updateData.seats_total = n;
    }
  }

  const { data, error } = await supabase
    .from("batches")
    .update(updateData)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ batch: data });
}

// DELETE /api/admin/batches/[id] — حذف نهائي (بس لو فاضية تمامًا)
// لو فيها محتوى أو طلاب مسجلين، لازم تتأرشف بدل ما تتحذف (استخدمي action=archive)
export async function DELETE(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const { data: batch } = await supabase.from("batches").select("*").eq("id", params.id).maybeSingle();
  if (!batch) return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });

  if (batch.is_default) {
    return NextResponse.json(
      { error: "ما فيك تحذفي الدفعة الافتراضية للدورة" },
      { status: 400 }
    );
  }

  const { count: studentsCount } = await supabase
    .from("batch_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", params.id);

  if (studentsCount && studentsCount > 0) {
    return NextResponse.json(
      { error: `فيها ${studentsCount} طالب مسجّل — أرشفيها بدل ما تحذفيها عشان ما يضيع سجلهم` },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("batches").delete().eq("id", params.id);

  if (error) {
    // احتياط: لو فيها محتوى (محاضرات/اختبارات) الـ FK رح يمنع الحذف
    if (error.code === "23503") {
      return NextResponse.json(
        { error: "فيها محتوى (محاضرات أو اختبارات) — أرشفيها بدل ما تحذفيها" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
