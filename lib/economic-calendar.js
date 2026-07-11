import { createClient } from "@supabase/supabase-js";

const IMPACT_MAP = { High: "high", Medium: "medium", Low: "low", Holiday: "holiday" };

export async function refreshEconomicCalendar() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const res = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`تعذر جلب بيانات التقويم: status ${res.status}`);
  const rawEvents = await res.json();

  let stored = 0;
  let analyzed = 0;
  let errors = 0;

  for (const ev of rawEvents || []) {
    if (!ev.title || !ev.date) continue;

    const eventDate = ev.date.split("T")[0];
    const eventTime = new Date(ev.date).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    const impact = IMPACT_MAP[ev.impact] || "low";
    const currency = ev.country || "";

    const { data: existing } = await supabase
      .from("economic_events")
      .select("id, actual, ai_analysis, ai_data, analyzed_at")
      .eq("event_date", eventDate)
      .eq("event_title", ev.title)
      .eq("currency", currency)
      .maybeSingle();

    const actualValue = ev.actual || null;
    const actualChanged = !!existing && !!actualValue && existing.actual !== actualValue;
    const needsAnalysis =
      (impact === "high" || impact === "medium") &&
      (!existing?.ai_data || actualChanged) &&
      !!process.env.ANTHROPIC_API_KEY;

    let aiData = existing?.ai_data || null;
    let aiAnalysis = existing?.ai_analysis || null;
    let analyzedAt = existing?.analyzed_at || null;

    if (needsAnalysis) {
      try {
        const prompt = `أنت محلل أسواق مالية محترف متخصص بأسواق الذهب والمؤشرات والعملات. حلل الخبر الاقتصادي التالي وأعطني ردك **بصيغة JSON فقط** بدون أي نص إضافي قبله أو بعده، وبدون علامات markdown​ (لا تستخدم \`\`\`)، مطابق تماماً لهاي البنية:

{
  "confidence": رقم من 0 إلى 100 يمثل ثقتك بالتحليل,
  "summary": "شرح مبسط بجملة أو جملتين بالعربية: شو هذا الخبر ولماذا هو مهم",
  "assets": [
    {"name": "الذهب", "symbol": "XAUUSD", "direction": "up أو down أو neutral", "strength": "strong أو medium أو weak"},
    {"name": "الدولار الأمريكي", "symbol": "DXY", "direction": "...", "strength": "..."},
    {"name": "ناسداك", "symbol": "US100", "direction": "...", "strength": "..."},
    {"name": "يورو/دولار", "symbol": "EURUSD", "direction": "...", "strength": "..."},
    {"name": "بيتكوين", "symbol": "BTCUSD", "direction": "...", "strength": "..."}
  ],
  "scenarios": [
    {"title": "أعلى من المتوقع", "probability": رقم مئوي, "stars": رقم من 1 إلى 5 يمثل قوة التأثير, "description": "جملة قصيرة عن أثره على الذهب والمؤشرات"},
    {"title": "مطابق للتوقعات", "probability": رقم مئوي, "stars": رقم, "description": "..."},
    {"title": "أقل من المتوقع", "probability": رقم مئوي, "stars": رقم, "description": "..."}
  ],
  "tips_before": ["نصيحة قصيرة 1", "نصيحة قصيرة 2"],
  "tips_after": ["نصيحة قصيرة 1", "نصيحة قصيرة 2"]
}

مجموع نسب probability بالسيناريوهات الثلاثة لازم يساوي 100 تقريباً.

الخبر: ${ev.title}
العملة المرتبطة: ${currency}
مستوى الأهمية: ${ev.impact}
التوقع: ${ev.forecast || "غير متوفر"}
القيمة السابقة: ${ev.previous || "غير متوفر"}
القيمة الفعلية: ${ev.actual || "لم تصدر بعد"}`;

        const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 900,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (aiRes.ok) {
          const aiRes2 = await aiRes.json();
          const rawText = aiRes2?.content?.find((c) => c.type === "text")?.text?.trim();
          if (rawText) {
            const cleaned = rawText.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
            try {
              const parsed = JSON.parse(cleaned);
              aiData = parsed;
              aiAnalysis = parsed.summary || null;
              analyzedAt = new Date().toISOString();
              analyzed += 1;
            } catch (parseErr) {
              console.error("JSON parse error for event", ev.title, parseErr);
              errors += 1;
            }
          }
        } else {
          errors += 1;
        }
      } catch (e) {
        console.error("AI analysis error:", e);
        errors += 1;
      }
    }

    const row = {
      event_date: eventDate,
      event_time: eventTime,
      event_datetime: ev.date,
      currency,
      country: currency,
      event_title: ev.title,
      impact,
      forecast: ev.forecast || null,
      previous: ev.previous || null,
      actual: actualValue,
      ai_analysis: aiAnalysis,
      ai_data: aiData,
      analyzed_at: analyzedAt,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("economic_events")
      .upsert(row, { onConflict: "event_date,event_title,currency" });

    if (upsertError) errors += 1;
    else stored += 1;
  }

  return {
    totalFetched: rawEvents?.length || 0,
    stored,
    analyzed,
    errors,
    timestamp: new Date().toISOString(),
  };
}
