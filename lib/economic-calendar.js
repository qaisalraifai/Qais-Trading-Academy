import { createClient } from "@supabase/supabase-js";

const IMPACT_MAP = { High: "high", Medium: "medium", Low: "low", Holiday: "holiday" };

function buildAnalysisPrompt(ev) {
  return `أنت محلل أسواق مالية محترف متخصص بأسواق الذهب والمؤشرات والعملات. حلل الخبر الاقتصادي التالي وأعطني ردك **بصيغة JSON فقط** بدون أي نص إضافي قبله أو بعده، وبدون علامات markdown​ (لا تستخدم \`\`\`)، مطابق تماماً لهاي البنية:

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
  "tips_after": ["نصيحة قصيرة 1", "نصيحة قصيرة 2"],
  "historical_examples": [
    {"year": "سنة سابقة تقريبية", "asset": "اسم الأصل مثل الذهب أو الدولار", "symbol": "رمزه", "direction": "up أو down", "change_pct": "رقم تقريبي بدون علامة %", "note": "جملة قصيرة عن السياق"}
  ]
}

مجموع نسب probability بالسيناريوهات الثلاثة لازم يساوي 100 تقريباً.
historical_examples هي أمثلة توضيحية تقريبية (2 إلى 3 عناصر) عن كيف تفاعلت الأسواق تاريخياً مع أخبار مشابهة لهذا النوع من الأخبار، وليست بالضرورة أرقاماً دقيقة موثقة — وضّح هذا الطابع التقريبي بصياغة الملاحظة (note) بدل تقديمها كحقيقة مؤكدة.

الخبر: ${ev.title}
العملة المرتبطة: ${ev.currency}
مستوى الأهمية: ${ev.impact}
التوقع: ${ev.forecast || "غير متوفر"}
القيمة السابقة: ${ev.previous || "غير متوفر"}
القيمة الفعلية: ${ev.actual || "لم تصدر بعد"}`;
}

// يستدعي Gemini API (مجاني) ويحلل خبر واحد. يرجّع { aiData, aiAnalysis } أو null إذا فشل.
export async function analyzeEventWithAI(ev) {
  if (!process.env.GEMINI_API_KEY) {
    console.error("AI analysis skipped: GEMINI_API_KEY غير موجود بمتغيرات البيئة");
    return null;
  }

  try {
    const prompt = buildAnalysisPrompt(ev);
    const model = "gemini-flash-latest";
    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 3000,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );

    if (!aiRes.ok) {
      const errBody = await aiRes.text().catch(() => "");
      console.error(`AI analysis error: Gemini رجّع status ${aiRes.status} — ${errBody.slice(0, 500)}`);
      return null;
    }

    const aiRes2 = await aiRes.json();
    const finishReason = aiRes2?.candidates?.[0]?.finishReason;
    const rawText = aiRes2?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("")
      ?.trim();
    if (!rawText) {
      console.error(
        `AI analysis error: ما رجع نص من Gemini (finishReason: ${finishReason || "غير معروف"}) — الرد الكامل:`,
        JSON.stringify(aiRes2).slice(0, 500)
      );
      return null;
    }
    if (finishReason === "MAX_TOKENS") {
      console.error("AI analysis error: الرد انقطع بسبب حد التوكنز (MAX_TOKENS) قبل ما يخلص JSON كامل.");
    }

    const cleaned = rawText.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      return { aiData: parsed, aiAnalysis: parsed.summary || null };
    } catch (parseErr) {
      console.error("AI analysis error: فشل تحويل رد Gemini لـ JSON —", cleaned.slice(0, 500));
      return null;
    }
  } catch (e) {
    console.error("AI analysis error:", e.message || e);
    return null;
  }
}

// يحلل خبر موجود أصلاً بقاعدة البيانات (عن طريق id) عند الطلب المباشر (مثلاً لما يفتحه مشترك).
// يرجّع صف الخبر بعد تحديثه، أو null إذا الخبر مش موجود.
export async function analyzeExistingEvent(eventId) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: existing } = await supabase
    .from("economic_events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();

  if (!existing) return null;

  // عنده تحليل جاهز أصلاً؟ رجّعه فوراً بدون استدعاء الذكاء الاصطناعي من جديد.
  if (existing.ai_data) return existing;

  // فقط الأخبار متوسطة/عالية التأثير تستحق تحليل ذكاء اصطناعي.
  if (existing.impact !== "high" && existing.impact !== "medium") return existing;

  const result = await analyzeEventWithAI({
    title: existing.event_title,
    currency: existing.currency,
    impact: existing.impact === "high" ? "High" : "Medium",
    forecast: existing.forecast,
    previous: existing.previous,
    actual: existing.actual,
  });

  if (!result) return existing;

  const { data: updated, error } = await supabase
    .from("economic_events")
    .update({
      ai_data: result.aiData,
      ai_analysis: result.aiAnalysis,
      analyzed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .select("*")
    .single();

  if (error) return existing;
  return updated;
}

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
      !!process.env.GEMINI_API_KEY;

    let aiData = existing?.ai_data || null;
    let aiAnalysis = existing?.ai_analysis || null;
    let analyzedAt = existing?.analyzed_at || null;

    if (needsAnalysis) {
      const result = await analyzeEventWithAI({ ...ev, currency });
      if (result) {
        aiData = result.aiData;
        aiAnalysis = result.aiAnalysis;
        analyzedAt = new Date().toISOString();
        analyzed += 1;
      } else {
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
