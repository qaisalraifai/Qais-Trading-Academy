import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// راوت خفيف بس للقراءة — بيرجّع حالة الخبر الحالية من قاعدة البيانات
// (تحديداً ai_data) من غير ما يشغّل تحليل جديد. مستخدم من الواجهة للـ polling
// لما تكون فاتحة خبر لسا تحليله ما خلص، حتى تعرف أول ما يجهز بدون ما المستخدم
// يعمل Refresh يدوي.
export async function GET(request, { params }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: "معرّف الخبر مفقود" }, { status: 400 });
  }

  const { data: event, error } = await supabase
    .from("economic_events")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "صار خطأ بجلب الخبر" }, { status: 502 });
  }
  if (!event) {
    return NextResponse.json({ error: "الخبر غير موجود" }, { status: 404 });
  }

  return NextResponse.json({ success: true, event });
}
