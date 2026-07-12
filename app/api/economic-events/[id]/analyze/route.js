import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { analyzeExistingEvent } from "@/lib/economic-calendar";

// السقف الافتراضي على Vercel هو 10 ثواني بس، واستدعاء Gemini لتحليل مفصّل
// ممكن ياخد أكتر من هيك. رفعناه لـ 60 ثانية (أقصى حد مسموح بخطة Hobby).
export const maxDuration = 60;

// أي مستخدم مسجّل دخول (مو بس أدمن) يقدر يطلب تحليل خبر معيّن.
// أول مشترك يفتح الخبر بيشغّل التحليل، وبعدها التحليل يصير محفوظ بقاعدة البيانات
// وبيطلع فوراً لباقي المشتركين بدون ما يتكرر استدعاء الذكاء الاصطناعي.
export async function POST(request, { params }) {
  const supabase = createClient();
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

  try {
    const event = await analyzeExistingEvent(id);
    if (!event) {
      return NextResponse.json({ error: "الخبر غير موجود" }, { status: 404 });
    }
    return NextResponse.json({ success: true, event });
  } catch (e) {
    return NextResponse.json({ error: e.message || "صار خطأ بالتحليل" }, { status: 502 });
  }
}
