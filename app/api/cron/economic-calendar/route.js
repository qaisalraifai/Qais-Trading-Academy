import { refreshEconomicCalendar } from "@/lib/economic-calendar";

// هاد الراوت بيلف على كل أخبار الأسبوع وبيحلل كل خبر متوسط/عالي التأثير عبر Gemini
// (كل استدعاء ياخد ثواني)، فسقف الـ 10 ثواني الافتراضي مش كافي. رفعناه لأقصى حد
// مسموح بخطة Hobby (60 ثانية). لو عدد الأخبار يلي تحتاج تحليل كبير، ممكن يضل الراوت
// ينقطع قبل ما يخلص الكل — الأخبار يلي تعدّت أثناء الانقطاع بترجع تتحلل بالمرة الجاية
// (لأنه ai_data إلها بيضل فاضي) أو لما مشترك يفتحها مباشرة عبر /analyze.
export const maxDuration = 60;

export async function GET(request) {
  if (!process.env.CRON_SECRET) {
    return Response.json(
      { error: "CRON_SECRET غير معرّف بمتغيرات البيئة على السيرفر — لازم تُضاف بإعدادات Vercel (Project Settings → Environment Variables) ثم يُعاد النشر." },
      { status: 500 }
    );
  }
  const authHeader = request.headers.get("authorization");
  const querySecret = new URL(request.url).searchParams.get("secret");
  const authorized =
    authHeader === `Bearer ${process.env.CRON_SECRET}` || querySecret === process.env.CRON_SECRET;
  if (!authorized) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshEconomicCalendar();
    return Response.json({ success: true, ...result });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
