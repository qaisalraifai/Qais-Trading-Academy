import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { fetchYahooCandles } from "@/lib/yahoo-candles";
import { getAssetByValue } from "@/lib/assets";

const YAHOO_OVERRIDE = { XAUEUR: "XAUEUR=X" };
const CLOSED_STATUSES = ["Closed Winner", "Stopped Out"];

// ترتيب المراحل — نفس ترتيب الطلب بالفيتشر: Open→Running→TP1→TP2→TP3→TP4→Closed Winner
const STATUS_ORDER = ["Open", "Running", "TP1 Hit", "TP2 Hit", "TP3 Hit", "TP4 Hit", "Closed Winner"];

// POST /api/ai-trades/[id]/check — فحص عند الطلب (لما الطالب يفتح صفحة الصفقات
// أو تفاصيل صفقة). بيجيب شموع M5 من نفس مزوّد الأسعار الحالي (Yahoo عبر
// lib/yahoo-candles.js، بدون أي تغيير على منطق الجلب نفسه) ويمشي عليها زمنياً
// من آخر نقطة فحص لتحديث حالة الصفقة تلقائياً — بدون كرون دوري.
export async function POST(request, { params }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const admin = createAdminClient();
  const { data: trade, error: fetchError } = await admin
    .from("qais_ai_trades")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !trade) return NextResponse.json({ error: "الصفقة غير موجودة" }, { status: 404 });

  // صفقة مغلقة أصلاً — ما في داعي فحص، منرجعها متل ما هي
  if (CLOSED_STATUSES.includes(trade.status)) {
    return NextResponse.json({ trade, updated: false });
  }

  const yahoo = getAssetByValue(trade.symbol)?.yahoo || YAHOO_OVERRIDE[trade.symbol];
  if (!yahoo) return NextResponse.json({ error: "رمز غير معروف لمزوّد الأسعار" }, { status: 400 });

  const { candles, error: candlesError } = await fetchYahooCandles(yahoo, "5min", 5000);
  if (candlesError || !Array.isArray(candles) || candles.length === 0) {
    return NextResponse.json({ error: "تعذّر جلب السعر الحالي حالياً" }, { status: 502 });
  }

  const sinceSec = Math.floor(new Date(trade.last_checked_at || trade.created_at).getTime() / 1000);
  const newCandles = candles.filter((c) => c.time > sinceSec);

  // الأهداف المتبقية بترتيبها (بس اللي إلها سعر محدّد)
  const isBuy = trade.direction === "up";
  const targetLevels = [
    { key: "TP1 Hit", price: trade.tp1 },
    { key: "TP2 Hit", price: trade.tp2 },
    { key: "TP3 Hit", price: trade.tp3 },
    { key: "TP4 Hit", price: trade.tp4 },
  ].filter((t) => t.price != null);

  let currentIdx = STATUS_ORDER.indexOf(trade.status);
  if (currentIdx < 0) currentIdx = 0;
  let newStatus = trade.status;
  let closedAt = null;
  let lastPrice = trade.last_checked_price ?? trade.entry;

  outer: for (const candle of newCandles.sort((a, b) => a.time - b.time)) {
    lastPrice = candle.close;

    // أولوية فحص وقف الخسارة أولاً بكل شمعة (لو انضرب الـ SL والـ TP بنفس الشمعة،
    // منعتبرها ستوب — أكثر تحفظاً وأمان تعليمياً)
    const slHit = isBuy ? candle.low <= trade.stop_loss : candle.high >= trade.stop_loss;
    if (slHit) {
      newStatus = "Stopped Out";
      closedAt = new Date(candle.time * 1000).toISOString();
      break outer;
    }

    // فحص الأهداف بالترتيب — أول هدف ما انضرب بعد بيوقف الفحص عند أبعد هدف تحقق بهاي الشمعة
    for (let i = targetLevels.length - 1; i >= 0; i--) {
      const already = STATUS_ORDER.indexOf(targetLevels[i].key) <= currentIdx;
      if (already) continue;
      const tpHit = isBuy ? candle.high >= targetLevels[i].price : candle.low <= targetLevels[i].price;
      if (tpHit) {
        newStatus = targetLevels[i].key;
        currentIdx = STATUS_ORDER.indexOf(newStatus);
        if (i === targetLevels.length - 1) {
          newStatus = "Closed Winner";
          closedAt = new Date(candle.time * 1000).toISOString();
          break outer;
        }
        break; // انتقل للشمعة الجاية بعد ما سجّلنا أبعد هدف بهاي الشمعة
      }
    }

    // ولا SL ولا أي TP جديد انضرب بهاي الشمعة — أول شمعة بعد الفتح بتخلي الصفقة "Running"
    if (newStatus === "Open") newStatus = "Running";
  }

  const updates = {
    status: newStatus,
    last_checked_price: lastPrice,
    last_checked_at: new Date().toISOString(),
    ...(closedAt ? { closed_at: closedAt } : {}),
  };

  const { data: updated, error: updateError } = await admin
    .from("qais_ai_trades")
    .update(updates)
    .eq("id", trade.id)
    .select("*")
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ trade: updated, updated: newStatus !== trade.status });
}
