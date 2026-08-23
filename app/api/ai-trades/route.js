import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

const OPEN_STATUSES = ["Open", "Running", "TP1 Hit", "TP2 Hit", "TP3 Hit", "TP4 Hit"];

// GET /api/ai-trades?symbol=XAUUSD — هل فيه صفقة QAIS AI مفتوحة حالياً على هاد الرمز
// للطالب الحالي؟ (تستخدمها Chart Synchronization لاحقاً بدل ما تنشئ صفقة مكرّرة)
export async function GET(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  const admin = createAdminClient();
  let query = admin.from("qais_ai_trades").select("*").eq("user_id", user.id).order("created_at", { ascending: false });

  if (symbol) {
    query = query.eq("symbol", symbol).in("status", OPEN_STATUSES).limit(1);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (symbol) return NextResponse.json({ trade: data?.[0] || null });
  return NextResponse.json({ trades: data || [] });
}

// POST /api/ai-trades — إنشاء صفقة QAIS AI جديدة من نسخة (snapshot) قرار الرادار
// وقت الضغط على "Execute AI Trade". هاد Endpoint ما بيلمس منطق التحليل إطلاقاً —
// بس بياخد نتيجة analyzeSymbol() الجاهزة من الواجهة ويخزّنها.
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { symbol, timeframe, decision } = body;

  if (!symbol || !decision) {
    return NextResponse.json({ error: "بيانات الصفقة ناقصة" }, { status: 400 });
  }
  if (decision.entryStatus !== "Ready" || !decision.tradeValid) {
    return NextResponse.json({ error: "الإعداد غير جاهز للتنفيذ (Entry Status ≠ Ready)" }, { status: 400 });
  }
  if (decision.entry == null || decision.stopLoss == null) {
    return NextResponse.json({ error: "Entry أو Stop Loss مفقود بالتحليل" }, { status: 400 });
  }

  const admin = createAdminClient();

  // ما منسمح بأكثر من صفقة QAIS AI مفتوحة بنفس الوقت لنفس الطالب على نفس الرمز
  const { data: existing } = await admin
    .from("qais_ai_trades")
    .select("id")
    .eq("user_id", user.id)
    .eq("symbol", symbol)
    .in("status", OPEN_STATUSES)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "فيه صفقة QAIS AI مفتوحة أصلاً على هاد الرمز" }, { status: 409 });
  }

  const targets = Array.isArray(decision.targets) ? decision.targets : [];
  const tpPrice = (i) => {
    const t = targets[i];
    if (!t) return null;
    return t.price ?? t.level ?? null;
  };

  const row = {
    user_id: user.id,
    symbol,
    direction: decision.direction,
    timeframe: timeframe || "M15",
    entry: decision.entry,
    stop_loss: decision.stopLoss,
    tp1: tpPrice(0),
    tp2: tpPrice(1),
    tp3: tpPrice(2),
    tp4: tpPrice(3),
    /* ⚠️ `confidence` بيطلع `null`. كان `aiConfidence` — مجموع موزون ثابت
       بـ`decision.js`، ما إله علاقة بأي نموذج. العمود انترك بمكانه لأن
       تغيير المخطط قرار منفصل، بس ما بينكتب فيه رقم مخترع. */
    confidence: null,
    risk_reward: decision.riskReward ?? null,
    ai_analysis: {
      /* خريطة الشروط كاملة — كل سطر بيرجع لقاعدة إلها رقم واسم بالمنهجية.
         هاي اللي بتتعرض بصفحة الصفقة بدل «Confidence ٩٥٪». */
      conditions: decision.readiness?.rows || null,
      conditionsMet: decision.readiness?.metCount ?? null,
      conditionsTotal: decision.readiness?.totalCount ?? null,
      /* سلسلة الدخول الفعلية: الكتلة → الثلث → SMT → CISD. */
      chain: decision.skV2?.activeSetup?.chain || null,
      blockLevels: decision.skV2?.activeSetup?.block?.levels || null,
      direction: decision.direction || null,
      session: decision.session || null,
      sessionLabel: decision.sessionLabel || null,
      sequence: decision.sequence || null,
    },
    status: "Open",
    source: "QAIS AI",
    last_checked_price: decision.price ?? decision.entry,
    last_checked_at: new Date().toISOString(),
  };

  const { data, error } = await admin.from("qais_ai_trades").insert(row).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ trade: data });
}
