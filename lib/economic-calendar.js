import { createClient } from "@supabase/supabase-js";

const IMPACT_MAP = { High: "high", Medium: "medium", Low: "low", Holiday: "holiday" };

function buildAnalysisPrompt(ev) {
  const released = !!ev.actual;
  const postReleaseNote = released
    ? `\n\nملاحظة مهمة: هذا الخبر **صدرت نتيجته الفعلية بالفعل** (${ev.actual} مقابل توقع ${ev.forecast || "غير متوفر"}). ركّز تحليلك على تفسير هذه النتيجة تحديداً وشو المتوقع يصير بالأسواق بعدها الآن (وليس احتمالات مستقبلية لنتيجة لم تصدر بعد). بالنسبة لحقل "scenarios"، اجعل السيناريو المطابق لما صدر فعلياً هو صاحب أعلى نسبة probability (قريبة من 100) ووضّح بوصفه أنه ما حصل فعلاً، والسيناريوهين الآخرين اجعل probability لهما قريب من صفر مع وصف مختصر لماذا لم يتحققا.`
    : `\n\nملاحظة: هذا الخبر لسا ما صدرت نتيجته الفعلية، فحلل الاحتمالات المستقبلية الثلاثة بشكل متوازن.`;

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
القيمة الفعلية: ${ev.actual || "لم تصدر بعد"}${postReleaseNote}`;
}

// يستدعي Gemini API (مجاني) ويحلل خبر واحد. يرجّع { aiData, aiAnalysis } لو نجح،
// أو { error: "سبب الفشل" } لو فشل (بدل null بس - عشان نقدر نعرض السبب الحقيقي
// بدل ما يضل مخفي بلوغز السيرفر بس).
export async function analyzeEventWithAI(ev) {
  if (!process.env.GEMINI_API_KEY) {
    const msg = "GEMINI_API_KEY غير موجود بمتغيرات البيئة";
    console.error("AI analysis skipped:", msg);
    return { error: msg };
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
      const msg = `Gemini رجّع status ${aiRes.status} — ${errBody.slice(0, 300)}`;
      console.error("AI analysis error:", msg);
      return { error: msg };
    }

    const aiRes2 = await aiRes.json();
    const finishReason = aiRes2?.candidates?.[0]?.finishReason;
    const rawText = aiRes2?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("")
      ?.trim();
    if (!rawText) {
      const msg = `ما رجع نص من Gemini (finishReason: ${finishReason || "غير معروف"})`;
      console.error(`AI analysis error: ${msg} — الرد الكامل:`, JSON.stringify(aiRes2).slice(0, 500));
      return { error: msg };
    }
    if (finishReason === "MAX_TOKENS") {
      console.error("AI analysis error: الرد انقطع بسبب حد التوكنز (MAX_TOKENS) قبل ما يخلص JSON كامل.");
    }

    const cleaned = rawText.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      return { aiData: parsed, aiAnalysis: parsed.summary || null };
    } catch (parseErr) {
      const msg = "فشل تحويل رد Gemini لـ JSON صالح";
      console.error(`AI analysis error: ${msg} —`, cleaned.slice(0, 500));
      return { error: msg };
    }
  } catch (e) {
    const msg = e.message || String(e);
    console.error("AI analysis error:", msg);
    return { error: msg };
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

  if (!result || result.error) return existing;

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

/* ============================================================================
   فلتر الأخبار الاقتصادية لـ QAIS SK Engine (توثيق RADAR — SK+ICT الجديد، الفصل ٩):
   "لا يسمح النظام بفتح أي صفقة أثناء صدور الأخبار الاقتصادية المهمة، بغض النظر
   عن اكتمال باقي الشروط." — بنفحص هل في خبر بتأثير High لأي من عملات الرمز
   المطلوب ضمن نافذة زمنية (قبل/بعد) حول الوقت الحالي.

   @param {string[]} currencies - مثلاً ["USD"] أو ["EUR","USD"]
   @param {number} windowMinutes - نصف عرض النافذة بالدقائق (افتراضي 30)
   @returns {Promise<object|null>} أقرب خبر High ضمن النافذة، أو null إذا ما في شي
   ============================================================================ */
export async function getActiveNewsBlock(currencies, windowMinutes = 30) {
  if (!currencies?.length) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const now = Date.now();
  const from = new Date(now - windowMinutes * 60000).toISOString();
  const to = new Date(now + windowMinutes * 60000).toISOString();

  const { data, error } = await supabase
    .from("economic_events")
    .select("event_title, currency, impact, event_datetime")
    .eq("impact", "high")
    .in("currency", currencies)
    .gte("event_datetime", from)
    .lte("event_datetime", to)
    .order("event_datetime", { ascending: true })
    .limit(1);

  if (error || !data?.length) return null;

  const ev = data[0];
  return {
    title: ev.event_title,
    currency: ev.currency,
    impact: ev.impact,
    time: ev.event_datetime,
    minutesFromNow: Math.round((new Date(ev.event_datetime).getTime() - now) / 60000),
  };
}

export async function refreshEconomicCalendar({ analyze = true } = {}) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const res = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`تعذر جلب بيانات التقويم: status ${res.status}`);
  const bodyText = await res.text();
  let rawEvents;
  try {
    rawEvents = JSON.parse(bodyText) || [];
  } catch {
    // المصدر (ForexFactory عبر nfs.faireconomy.media) معروف إنه بيحدّ عدد الطلبات
    // المسموحة من نفس الـIP (تقريباً طلبين كل 5 دقائق)، وبيرجّع صفحة HTML
    // "Request Denied" بدل JSON لما يتجاوزها - وهاد شائع جداً مع IPs مزودي
    // الاستضافة السحابية (Vercel/AWS...) لأنها مشتركة بين آلاف المشاريع. لو صار
    // هيك، بنرمي رسالة واضحة (بدل خطأ "Unexpected token <" المبهم) عشان يبين
    // بلوغز Vercel أو برد الطلب اليدوي شو السبب الحقيقي فوراً.
    const looksBlocked = /request denied|<!doctype html|<html/i.test(bodyText);
    throw new Error(
      looksBlocked
        ? "مصدر التقويم (nfs.faireconomy.media) رفض الطلب - غالباً IP سيرفر Vercel محظور/متجاوز حد الطلبات المسموح عندهم. جرّبي مصدر بديل أو Proxy لو استمرت المشكلة."
        : `المصدر رجّع رد غير متوقع (مش JSON صالح): ${bodyText.slice(0, 150)}`
    );
  }

  const validEvents = rawEvents.filter((ev) => ev.title && ev.date);

  // بدل ما نسأل قاعدة البيانات مرتين لكل خبر بالتسلسل (وهاد يلي كان يخلي الطلب ياخد
  // عشرات الثواني حتى بدون تحليل AI)، نجيب كل السجلات الموجودة أصلاً دفعة وحدة
  // بسؤال واحد، ونعمل upsert دفعة وحدة كمان بسؤال واحد بالآخر.
  const eventDates = [...new Set(validEvents.map((ev) => ev.date.split("T")[0]))];

  const existingMap = new Map();
  if (eventDates.length) {
    const { data: existingRows } = await supabase
      .from("economic_events")
      .select("event_date, event_title, currency, actual, ai_analysis, ai_data, analyzed_at")
      .in("event_date", eventDates);

    for (const row of existingRows || []) {
      existingMap.set(`${row.event_date}|${row.event_title}|${row.currency}`, row);
    }
  }

  let analyzed = 0;
  let errors = 0;
  const analysisErrorSamples = new Set();
  const rows = [];
  const analysisQueue = [];

  for (const ev of validEvents) {
    const eventDate = ev.date.split("T")[0];
    const eventTime = new Date(ev.date).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    const impact = IMPACT_MAP[ev.impact] || "low";
    const currency = ev.country || "";
    const existing = existingMap.get(`${eventDate}|${ev.title}|${currency}`);

    // نحافظ على القيمة الفعلية المحفوظة أصلاً لو المصدر رجّع فاضي هالمرة (تعليق مؤقت بالمصدر)
    const actualValue = ev.actual || existing?.actual || null;
    const actualChanged = !!existing && !!actualValue && existing.actual !== actualValue;
    // تحليل الذكاء الاصطناعي بيصير بحالتين:
    // 1) الكرون اليومي الكامل (analyze=true) بيحلل أي خبر ما إله تحليل لسا.
    // 2) بغض النظر عن نوع الكرون، لو القيمة الفعلية تغيّرت هسا (يعني الخبر صدر تواً)
    //    منعمل تحليل فوري حتى لو كنا بالمزامنة السريعة كل ١٠-١٥ دقيقة —
    //    عشان تحليل الذكاء الاصطناعي يعكس النتيجة الفعلية بسرعة، مو يستنى للكرون الساعة ٦ صباحاً.
    const needsAnalysis =
      (impact === "high" || impact === "medium") &&
      !!process.env.GEMINI_API_KEY &&
      ((analyze && !existing?.ai_data) || actualChanged);

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
      ai_analysis: existing?.ai_analysis || null,
      ai_data: existing?.ai_data || null,
      analyzed_at: existing?.analyzed_at || null,
      updated_at: new Date().toISOString(),
    };

    rows.push(row);
    if (needsAnalysis) analysisQueue.push({ ev: { ...ev, currency }, row });
  }

  // تحليل الذكاء الاصطناعي (لو مطلوب) بس للأخبار المتوسطة/العالية يلي محتاجاه فعلاً —
  // هاي الخطوة الوحيدة يلي ممكن تاخد وقت، وبتصير بس بوضع analyze=true (الكرون اليومي).
  //
  // حد أقصى + تباعد بين الطلبات: خطة Gemini المجانية عندها حد صارم بالدقيقة (RPM)
  // غالباً ١٠-١٥ طلب/دقيقة. لو عدد الأخبار يلي تحتاج تحليل صار كبير (يوم حافل
  // بالأخبار، أو تشغيل يدوي متكرر للاختبار)، معالجتها كلها فوراً وبدون تباعد
  // بتضرب هاد الحد بسرعة وبترجع 429/400 لمعظمها - بالضبط الشي يلي صار معنا.
  // فبدل هيك: نعالج حد أقصى آمن بكل تشغيلة، بفاصل زمني بينهم يحترم الحد، والباقي
  // بينحلل تلقائياً بالمرة الجاية (لأنه ai_data بيضل فاضي) أو فوراً لو مشترك فتح
  // الخبر بنفسه (analyzeExistingEvent).
  const MAX_AI_PER_RUN = 6;
  const AI_CALL_SPACING_MS = 6000; // ~10 طلبات/دقيقة كحد أقصى فعلي - تحت أي حد RPM معروف بالخطة المجانية
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const toAnalyzeNow = analysisQueue.slice(0, MAX_AI_PER_RUN);
  const deferredCount = analysisQueue.length - toAnalyzeNow.length;

  for (let i = 0; i < toAnalyzeNow.length; i++) {
    const { ev, row } = toAnalyzeNow[i];
    if (i > 0) await sleep(AI_CALL_SPACING_MS);
    const result = await analyzeEventWithAI(ev);
    if (result && !result.error) {
      row.ai_data = result.aiData;
      row.ai_analysis = result.aiAnalysis;
      row.analyzed_at = new Date().toISOString();
      analyzed += 1;
    } else {
      errors += 1;
      if (result?.error && analysisErrorSamples.size < 5) analysisErrorSamples.add(result.error);
    }
  }

  let stored = 0;
  let upsertErrorMessage = null;
  if (rows.length) {
    const { error: upsertError } = await supabase
      .from("economic_events")
      .upsert(rows, { onConflict: "event_date,event_title,currency" });

    if (upsertError) {
      errors += rows.length;
      upsertErrorMessage = upsertError.message || String(upsertError);
      console.error("economic_events upsert error:", upsertErrorMessage, upsertError);
    } else {
      stored = rows.length;
    }
  }

  return {
    totalFetched: rawEvents.length,
    stored,
    analyzed,
    errors,
    deferredAnalysis: deferredCount || undefined,
    analysisErrorSamples: analysisErrorSamples.size ? [...analysisErrorSamples] : undefined,
    upsertError: upsertErrorMessage,
    timestamp: new Date().toISOString(),
  };
}
