import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/admin/batches/[id] — تفاصيل دفعة وحدة (لصفحة /admin/batches/[id] — المرحلة 6أ)
// نفس منطق الإثراء المستخدم بقائمة الدفعات (seats_taken/remaining، البث النشط،
// اسم الدورة والمدرب)، بس لدفعة وحدة بدل كل الدفعات.
export async function GET(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const { data: batch, error } = await supabase
    .from("batches")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!batch) return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });

  const [{ count: seatsTaken }, { data: course }, { data: instructor }, { data: liveSession }, { data: batchInstructorRows }] = await Promise.all([
    supabase.from("batch_enrollments").select("id", { count: "exact", head: true }).eq("batch_id", params.id),
    supabase.from("courses").select("id, title, icon").eq("id", batch.course_id).maybeSingle(),
    batch.instructor_id
      ? supabase.from("profiles").select("id, username").eq("id", batch.instructor_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("live_sessions").select("id, room_name, title, started_at").eq("batch_id", params.id).eq("is_active", true).maybeSingle(),
    supabase.from("batch_instructors").select("instructor_id").eq("batch_id", params.id),
  ]);

  // المرحلة 7: قائمة كل المدربين المرتبطين بهاي الدفعة (تعدد مدربين)
  const instructorIds = (batchInstructorRows || []).map((r) => r.instructor_id);
  let instructorsList = [];
  if (instructorIds.length) {
    const { data: profs } = await supabase.from("profiles").select("id, username").in("id", instructorIds);
    instructorsList = profs || [];
  }

  const { data: instructors } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("role", "admin")
    .order("username", { ascending: true });

  const enriched = {
    ...batch,
    seats_taken: seatsTaken || 0,
    seats_remaining: batch.seats_total == null ? null : Math.max(batch.seats_total - (seatsTaken || 0), 0),
    is_full: batch.seats_total != null && (seatsTaken || 0) >= batch.seats_total,
    course: course || null,
    instructor: instructor || null,
    instructors_list: instructorsList,
    live_session: liveSession || null,
  };

  return NextResponse.json({ batch: enriched, instructors: instructors || [] });
}

// PUT /api/admin/batches/[id] — تعديل بيانات دفعة
// ملاحظة: course_id و is_default ما بتتغيّر من هون عمدًا
export async function PUT(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const { name, instructor_ids, start_date, end_date, seats_total, registration_status } = body;
  const instructorIdList = Array.isArray(instructor_ids) ? instructor_ids.filter(Boolean) : undefined;

  const updateData = {};
  if (name !== undefined) {
    if (!name.trim()) return NextResponse.json({ error: "اسم الدفعة مطلوب" }, { status: 400 });
    updateData.name = name.trim();
  }
  if (instructorIdList !== undefined) updateData.instructor_id = instructorIdList[0] || null; // المدرب الرئيسي
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

  // المرحلة 7: تحديث قائمة المدربين المرتبطين (استبدال كامل — أسهل وأضمن من الفرق بين القديم والجديد)
  let instructorsList = [];
  if (instructorIdList !== undefined) {
    await supabase.from("batch_instructors").delete().eq("batch_id", params.id);
    if (instructorIdList.length) {
      await supabase.from("batch_instructors").insert(instructorIdList.map((id) => ({ batch_id: params.id, instructor_id: id })));
      const { data: profs } = await supabase.from("profiles").select("id, username").in("id", instructorIdList);
      instructorsList = profs || [];
    }
  } else {
    const { data: rows } = await supabase.from("batch_instructors").select("instructor_id").eq("batch_id", params.id);
    const ids = (rows || []).map((r) => r.instructor_id);
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username").in("id", ids);
      instructorsList = profs || [];
    }
  }

  return NextResponse.json({ batch: { ...data, instructors_list: instructorsList } });
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
