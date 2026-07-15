import { refreshEconomicCalendar } from "@/lib/economic-calendar";

// نسخة سريعة من مزامنة التقويم الاقتصادي: بتجيب القيم الفعلية/التوقع/السابق
// من المصدر وتحدّث قاعدة البيانات بسرعة. ما بتعمل تحليل ذكاء اصطناعي شامل لكل
// الأخبار (هاد يضل مسؤولية الكرون اليومي)، لكن **لو خبر معيّن صدرت نتيجته الفعلية
// توّها** (تغيّرت قيمة actual) بتعمل تحليل AI فوري لهاد الخبر تحديداً بس، عشان
// المشترك يشوف تحليل يعكس النتيجة الحقيقية بسرعة، مش يستنى لحد الكرون اليومي.
// مصممة عشان تُستدعى كل 10-15 دقيقة من كرون خارجي (مثل cron-job.org) يلي سقف
// المهلة عنده 30 ثانية بالخطة المجانية.
export const maxDuration = 30;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshEconomicCalendar({ analyze: false });
    return Response.json({ success: true, mode: "sync-only", ...result });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
