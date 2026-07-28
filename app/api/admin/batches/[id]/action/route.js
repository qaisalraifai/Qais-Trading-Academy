import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// POST /api/admin/batches/[id]/action { action, payload }
// actions: archive | unarchive | open_registration | close_registration | duplicate
export async function POST(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = params;
  const { action, payload = {} } = await request.json().catch(() => ({}));
  const supabase = createAdminClient();

  const { data: batch } = await supabase.from("batches").select("*").eq("id", id).maybeSingle();
  if (!batch) return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });

  switch (action) {
    case "archive": {
      if (batch.is_default) {
        return NextResponse.json({ error: "ما فيك تأرشفي الدفعة الافتراضية" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("batches")
        .update({ is_archived: true, registration_status: "closed" })
        .eq("id", id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ batch: data });
    }

    case "unarchive": {
      const { data, error } = await supabase
        .from("batches")
        .update({ is_archived: false })
        .eq("id", id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ batch: data });
    }

    case "open_registration": {
      if (batch.is_archived) {
        return NextResponse.json({ error: "الدفعة مؤرشفة — فكّي أرشفتها أول" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("batches")
        .update({ registration_status: "open" })
        .eq("id", id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ batch: data });
    }

    case "close_registration": {
      const { data, error } = await supabase
        .from("batches")
        .update({ registration_status: "closed" })
        .eq("id", id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ batch: data });
    }

    case "duplicate": {
      // نسخ إعدادات الدفعة (الاسم، المدرب، عدد المقاعد) لدفعة جديدة
      // التواريخ ما بتتنسخ عمدًا (دفعة جديدة = مواعيد جديدة)، وحالة التسجيل
      // بتبلّش "مغلقة" افتراضيًا لحد ما الأدمن يحدد المواعيد ويفتحها بنفسه
      const newName = payload.name?.trim() || `${batch.name} (نسخة)`;
      const { data, error } = await supabase
        .from("batches")
        .insert({
          course_id: batch.course_id,
          name: newName,
          instructor_id: batch.instructor_id,
          seats_total: batch.seats_total,
          start_date: null,
          end_date: null,
          registration_status: "closed",
          is_default: false,
        })
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ batch: { ...data, seats_taken: 0, seats_remaining: data.seats_total, is_full: false } });
    }

    default:
      return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  }
}
