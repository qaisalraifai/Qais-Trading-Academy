import { refreshEconomicCalendar } from "@/lib/economic-calendar";

// نسخة سريعة من مزامنة التقويم الاقتصادي: بس تجيب القيم الفعلية/التوقع/السابق
// من المصدر وتحدّث قاعدة البيانات، من غير ما تستنى تحليل الذكاء الاصطناعي (Gemini).
// مصممة عشان تُستدعى كل 10-15 دقيقة من كرون خارجي (مثل cron-job.org) يلي سقف
// المهلة عنده 30 ثانية بالخطة المجانية — هاي النسخة بتخلص بثواني قليلة.
// التحليل بالذكاء الاصطناعي يضل مسؤولية الكرون الأصلي /api/cron/economic-calendar
// (المجدول مرة باليوم عبر vercel.json، وما إله قيد 30 ثانية لأنه فيرسل نفسه بيشغّله).
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
