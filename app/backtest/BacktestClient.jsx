"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase-client";

/* ===================== قائمة الأصول ===================== */
const ASSETS = [
  {
    group: "المعادن (متابعة مباشرة مدعومة ✅ مجاناً)",
    items: [
      { v: "XAUUSD", label: "(ذهب) XAUUSD", mult: 100, source: "goldapi", sourceSymbol: "XAU" },
      { v: "XAGUSD", label: "(فضة) XAGUSD", mult: 5000, source: "goldapi", sourceSymbol: "XAG" },
      { v: "XPTUSD", label: "(بلاتين) XPTUSD", mult: 100, source: "goldapi", sourceSymbol: "XPT" },
      { v: "XPDUSD", label: "(بلاديوم) XPDUSD", mult: 100, source: "goldapi", sourceSymbol: "XPD" },
      { v: "COPPER", label: "(نحاس) Copper", mult: 1, source: "goldapi", sourceSymbol: "HG" },
    ],
  },
  {
    group: "فوركس (متابعة مباشرة مدعومة ✅ مجاناً)",
    items: [
      { v: "EURUSD", label: "EUR/USD", mult: 100000, source: "yahoo", sourceSymbol: "EURUSD=X" },
      { v: "GBPUSD", label: "GBP/USD", mult: 100000, source: "yahoo", sourceSymbol: "GBPUSD=X" },
      { v: "USDJPY", label: "USD/JPY", mult: 1000, source: "yahoo", sourceSymbol: "USDJPY=X" },
      { v: "USDCHF", label: "USD/CHF", mult: 100000, source: "yahoo", sourceSymbol: "USDCHF=X" },
      { v: "AUDUSD", label: "AUD/USD", mult: 100000, source: "yahoo", sourceSymbol: "AUDUSD=X" },
      { v: "USDCAD", label: "USD/CAD", mult: 100000, source: "yahoo", sourceSymbol: "USDCAD=X" },
      { v: "NZDUSD", label: "NZD/USD", mult: 100000, source: "yahoo", sourceSymbol: "NZDUSD=X" },
      { v: "EURJPY", label: "EUR/JPY", mult: 1000, source: "yahoo", sourceSymbol: "EURJPY=X" },
      { v: "GBPJPY", label: "GBP/JPY", mult: 1000, source: "yahoo", sourceSymbol: "GBPJPY=X" },
      { v: "EURGBP", label: "EUR/GBP", mult: 100000, source: "yahoo", sourceSymbol: "EURGBP=X" },
    ],
  },
  {
    group: "كريبتو (متابعة مباشرة مدعومة ✅)",
    items: [
      { v: "BTCUSD", label: "Bitcoin (BTC/USD)", mult: 1, source: "finnhub", sourceSymbol: "BINANCE:BTCUSDT" },
      { v: "ETHUSD", label: "Ethereum (ETH/USD)", mult: 1, source: "finnhub", sourceSymbol: "BINANCE:ETHUSDT" },
      { v: "SOLUSD", label: "Solana (SOL/USD)", mult: 1, source: "finnhub", sourceSymbol: "BINANCE:SOLUSDT" },
      { v: "XRPUSD", label: "Ripple (XRP/USD)", mult: 1, source: "finnhub", sourceSymbol: "BINANCE:XRPUSDT" },
      { v: "BNBUSD", label: "BNB/USD", mult: 1, source: "finnhub", sourceSymbol: "BINANCE:BNBUSDT" },
      { v: "DOGEUSD", label: "Dogecoin (DOGE/USD)", mult: 1, source: "finnhub", sourceSymbol: "BINANCE:DOGEUSDT" },
    ],
  },
  {
    group: "مؤشرات وأسهم",
    items: [
      { v: "US30", label: "US30 (داو جونز) - مباشر ✅", mult: 1, source: "yahoo", sourceSymbol: "YM=F" },
      { v: "NAS100", label: "NAS100 (ناسداك) - مباشر ✅", mult: 1, source: "yahoo", sourceSymbol: "NQ=F" },
      { v: "SPX500", label: "SPX500 (S&P 500) - مباشر ✅", mult: 1, source: "yahoo", sourceSymbol: "ES=F" },
      { v: "AAPL", label: "Apple (AAPL) - مباشر ✅", mult: 1, source: "finnhub", sourceSymbol: "AAPL" },
      { v: "TSLA", label: "Tesla (TSLA) - مباشر ✅", mult: 1, source: "finnhub", sourceSymbol: "TSLA" },
      { v: "MSFT", label: "Microsoft (MSFT) - مباشر ✅", mult: 1, source: "finnhub", sourceSymbol: "MSFT" },
      { v: "AMZN", label: "Amazon (AMZN) - مباشر ✅", mult: 1, source: "finnhub", sourceSymbol: "AMZN" },
    ],
  },
  {
    group: "أخرى",
    items: [{ v: "CUSTOM", label: "أصل آخر (يدوي)", mult: 1, source: null }],
  },
];

const INITIAL_BALANCE = 3000;
const DEFAULT_API_KEY = "d91i93hr01qqfqkca0b0d91i93hr01qqfqkca0bg";
const APIKEY_STORAGE_KEY = "qta_finnhub_apikey";

function getAssetInfo(symbol) {
  for (const g of ASSETS) {
    const found = g.items.find((i) => i.v === symbol);
    if (found) return found;
  }
  return null;
}

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtBalance(n) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/* تحويل صف من قاعدة البيانات (snake_case) لشكل الأداة الداخلي (camelCase) */
function rowToTrade(row) {
  return {
    id: row.id,
    asset: row.asset,
    date: row.trade_date,
    direction: row.direction,
    lot: Number(row.lot),
    entry: Number(row.entry),
    sl: Number(row.sl),
    tp: Number(row.tp),
    result: row.result,
    setup: row.setup || "",
    reason: row.reason || "",
    riskAmount: Number(row.risk_amount),
    rewardAmount: Number(row.reward_amount),
    rr: Number(row.rr),
    riskPercent: Number(row.risk_percent),
    isLive: !!row.is_live,
    priceSource: row.price_source,
    sourceSymbol: row.source_symbol,
  };
}

function tradeToRow(trade, userId) {
  return {
    user_id: userId,
    asset: trade.asset,
    trade_date: trade.date,
    direction: trade.direction,
    lot: trade.lot,
    entry: trade.entry,
    sl: trade.sl,
    tp: trade.tp,
    result: trade.result,
    setup: trade.setup || null,
    reason: trade.reason || null,
    risk_amount: trade.riskAmount,
    reward_amount: trade.rewardAmount,
    rr: trade.rr,
    risk_percent: trade.riskPercent,
    is_live: trade.isLive,
    price_source: trade.priceSource || null,
    source_symbol: trade.sourceSymbol || null,
  };
}

async function fetchPriceGoldApi(symbol) {
  const res = await fetch(`https://api.gold-api.com/price/${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error("فشل الاتصال بالسعر (Gold API) - كود " + res.status);
  const data = await res.json();
  const price = data.price ?? data.rate ?? data.value ?? null;
  if (price === null) throw new Error("استجابة Gold API غير متوقعة");
  return price;
}

async function fetchPriceFinnhub(symbol, apiKey) {
  const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`);
  if (!res.ok) throw new Error("فشل الاتصال بالسعر (Finnhub) - كود " + res.status);
  const data = await res.json();
  const price = data.c ?? null;
  if (price === null || price === 0) throw new Error("استجابة Finnhub غير متوقعة");
  return price;
}

/* مصدر مجاني بالكامل (بدون مفتاح API) للفوركس والمؤشرات (SPX500/US30/NAS100):
   يوهو فايننس مش ممكن نناديه مباشرة من المتصفح (CORS + محتاج crumb/كوكي جلسة)،
   فبنستخدم البروكسي عندنا (/api/replay-candles) يلي أصلاً مبني لهالغرض لجلب
   شموع الشارت - بنطلب منه آخر شمعتين بفريم دقيقة وحدة (طلب خفيف جداً، ضمن
   مسار "التحديث اللايف" المخفف عندهم أصلاً) وناخد سعر إغلاق آخر شمعة. */
async function fetchPriceYahoo(symbol) {
  const res = await fetch(`/api/replay-candles?symbol=${encodeURIComponent(symbol)}&interval=1min&count=2`);
  if (!res.ok) throw new Error("فشل الاتصال بالسعر (Yahoo Finance) - كود " + res.status);
  const data = await res.json();
  const candles = data.candles || [];
  const last = candles[candles.length - 1];
  if (!last || !Number.isFinite(last.close)) throw new Error("استجابة Yahoo Finance غير متوقعة");
  return last.close;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function BacktestClient({ userId, username, initialBalance, initialTrades, onExit }) {
  const supabase = useRef(createClient()).current;

  const [trades, setTrades] = useState((initialTrades || []).map(rowToTrade));
  const [balance, setBalance] = useState(initialBalance ?? INITIAL_BALANCE);
  const [currentFilter, setCurrentFilter] = useState("all");
  const [currentMode, setCurrentMode] = useState("manual");
  const [searchQuery, setSearchQuery] = useState("");

  // حالة الفورم
  const [asset, setAsset] = useState(ASSETS[0].items[0].v);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [direction, setDirection] = useState("buy");
  const [lot, setLot] = useState("0.01");
  const [result, setResult] = useState("pending");
  const [setup, setSetup] = useState("");
  const [entry, setEntry] = useState("5000");
  const [sl, setSl] = useState("4997");
  const [tp, setTp] = useState("5020");
  const [reason, setReason] = useState("");
  const userEditedEntryRef = useRef(false);

  // بيانات مباشرة مؤقتة (ما بتتخزن بقاعدة البيانات كل تحديث، بس وقت الإغلاق)
  const [liveMeta, setLiveMeta] = useState({}); // { [tradeId]: { currentPrice, lastError } }
  const [liveStatus, setLiveStatus] = useState({ on: false, text: "غير مفعّل", lastUpdate: "" });

  // مودالات
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [newBalanceInput, setNewBalanceInput] = useState(String(balance));
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
  const [apiKeyInput, setApiKeyInput] = useState("");

  const livePollTimerRef = useRef(null);
  const entryLivePriceTimerRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem(APIKEY_STORAGE_KEY);
    if (saved) setApiKey(saved);
  }, []);

  /* ===================== حفظ بقاعدة البيانات ===================== */
  const persistBalance = useCallback(
    async (newBalance) => {
      setBalance(newBalance);
      const { error } = await supabase
        .from("profiles")
        .update({ backtest_balance: newBalance })
        .eq("id", userId);
      if (error) console.error("فشل حفظ الرصيد:", error.message);
    },
    [supabase, userId]
  );

  /* ===================== حساب المعاينة ===================== */
  function calcPreview() {
    const e = parseFloat(entry) || 0;
    const s = parseFloat(sl) || 0;
    const t = parseFloat(tp) || 0;
    const l = parseFloat(lot) || 0;
    const info = getAssetInfo(asset);
    const mult = info ? info.mult : 1;

    const riskAmount = Math.abs(e - s) * l * mult;
    const rewardAmount = Math.abs(t - e) * l * mult;
    const rr = riskAmount > 0 ? rewardAmount / riskAmount : 0;
    const riskPercent = balance > 0 ? (riskAmount / balance) * 100 : 0;

    return { riskAmount, rewardAmount, rr, riskPercent };
  }
  const preview = calcPreview();

  /* ===================== وضع يدوي / مباشر ===================== */
  function stopEntryLivePriceWatch() {
    if (entryLivePriceTimerRef.current) clearInterval(entryLivePriceTimerRef.current);
    entryLivePriceTimerRef.current = null;
  }

  async function updateEntryWithLivePrice() {
    if (currentMode !== "live") return;
    const info = getAssetInfo(asset);
    if (!info || !info.source) return;
    if (info.source === "finnhub" && !apiKey) return;
    try {
      const price =
        info.source === "goldapi"
          ? await fetchPriceGoldApi(info.sourceSymbol)
          : info.source === "yahoo"
          ? await fetchPriceYahoo(info.sourceSymbol)
          : await fetchPriceFinnhub(info.sourceSymbol, apiKey);
      if (price && price > 0 && !userEditedEntryRef.current) {
        setEntry(String(price));
      }
    } catch (e) {
      /* بيتظهر بشريط الحالة عند المتابعة الفعلية */
    }
  }

  function startEntryLivePriceWatch() {
    stopEntryLivePriceWatch();
    updateEntryWithLivePrice();
    entryLivePriceTimerRef.current = setInterval(updateEntryWithLivePrice, 1000);
  }

  function setMode(mode) {
    setCurrentMode(mode);
    if (mode === "live") {
      userEditedEntryRef.current = false;
      setEntry("");
    } else {
      stopEntryLivePriceWatch();
    }
  }

  useEffect(() => {
    if (currentMode === "live") startEntryLivePriceWatch();
    else stopEntryLivePriceWatch();
    return () => stopEntryLivePriceWatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMode, asset, apiKey]);

  function handleAssetChange(v) {
    setAsset(v);
    userEditedEntryRef.current = false;
    if (currentMode === "live") setEntry("");
  }

  /* ===================== إضافة صفقة ===================== */
  async function handleAdd() {
    const l = parseFloat(lot) || 0;
    const e = parseFloat(entry) || 0;
    const s = parseFloat(sl) || 0;
    const t = parseFloat(tp) || 0;

    if (!asset || !date || !l || !e) {
      alert("يرجى تعبئة الحقول الأساسية (الأصل، التاريخ، اللوت، سعر الدخول)");
      return;
    }

    const { riskAmount, rewardAmount, rr, riskPercent } = calcPreview();
    const assetInfo = getAssetInfo(asset);

    let newTrade;
    if (currentMode === "live") {
      if (!assetInfo || !assetInfo.source) {
        alert(
          "هذا الأصل غير مدعوم حالياً للمتابعة المباشرة المجانية. متاح حالياً: المعادن، الكريبتو، وبعض الأسهم الأمريكية."
        );
        return;
      }
      if (assetInfo.source === "finnhub" && !apiKey) {
        alert("لازم تضيفي مفتاح Finnhub API أولاً من زر ⚙ السوق الحي قبل فتح صفقة مباشرة.");
        setSettingsModalOpen(true);
        return;
      }
      newTrade = {
        asset,
        date,
        direction,
        lot: l,
        entry: e,
        sl: s,
        tp: t,
        result: "pending",
        setup: setup.trim(),
        reason: "",
        riskAmount,
        rewardAmount,
        rr,
        riskPercent,
        isLive: true,
        priceSource: assetInfo.source,
        sourceSymbol: assetInfo.sourceSymbol,
      };
    } else {
      newTrade = {
        asset,
        date,
        direction,
        lot: l,
        entry: e,
        sl: s,
        tp: t,
        result,
        setup: setup.trim(),
        reason: reason.trim(),
        riskAmount,
        rewardAmount,
        rr,
        riskPercent,
        isLive: false,
      };
    }

    const { data, error } = await supabase
      .from("trades")
      .insert(tradeToRow(newTrade, userId))
      .select()
      .single();

    if (error) {
      alert("صار خطأ بحفظ الصفقة: " + error.message);
      return;
    }

    const saved = rowToTrade(data);
    setTrades((prev) => [...prev, saved]);

    if (currentMode === "manual") {
      let nb = balance;
      if (result === "win") nb = balance + rewardAmount;
      if (result === "loss") nb = balance - riskAmount;
      if (nb !== balance) await persistBalance(nb);
      setSetup("");
      setReason("");
    } else {
      setSetup("");
    }
  }

  /* ===================== حذف صفقة ===================== */
  async function deleteTrade(id) {
    const t = trades.find((x) => x.id === id);
    if (!t) return;
    const { error } = await supabase.from("trades").delete().eq("id", id).eq("user_id", userId);
    if (error) {
      alert("تعذّر حذف الصفقة: " + error.message);
      return;
    }
    let nb = balance;
    if (t.result === "win") nb -= t.rewardAmount;
    if (t.result === "loss") nb += t.riskAmount;
    setTrades((prev) => prev.filter((x) => x.id !== id));
    if (nb !== balance) await persistBalance(nb);
  }

  /* ===================== مسح الكل ===================== */
  async function clearAll() {
    if (!confirm("هل أنت متأكد من مسح جميع الصفقات؟ سيتم إعادة ضبط رأس المال أيضاً.")) return;
    const { error } = await supabase.from("trades").delete().eq("user_id", userId);
    if (error) {
      alert("تعذّر مسح الصفقات: " + error.message);
      return;
    }
    setTrades([]);
    await persistBalance(INITIAL_BALANCE);
  }

  /* ===================== تصدير CSV ===================== */
  function exportCsv() {
    if (trades.length === 0) {
      alert("لا توجد بيانات للتصدير");
      return;
    }
    const headers = ["#", "الأصل", "التاريخ", "الاتجاه", "لوت", "دخول", "SL", "TP", "R:R", "مخاطرة $", "مخاطرة %", "الإعداد", "سبب النتيجة", "النتيجة"];
    const rows = trades.map((t, i) => [
      i + 1, t.asset, t.date, t.direction === "buy" ? "شراء" : "بيع", t.lot, t.entry, t.sl, t.tp,
      `1:${t.rr.toFixed(2)}`, t.riskAmount.toFixed(2), t.riskPercent.toFixed(2) + "%",
      t.setup || "", t.reason || "", t.result,
    ]);
    const csv = headers.join(",") + "\n" + rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "backtest_trades.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ===================== متابعة الأسعار الحية ===================== */
  async function closeLiveTrade(t, result, reasonText) {
    let nb = balance;
    if (result === "win") nb += t.rewardAmount;
    if (result === "loss") nb -= t.riskAmount;

    await supabase.from("trades").update({ result, reason: reasonText }).eq("id", t.id).eq("user_id", userId);
    setTrades((prev) => prev.map((x) => (x.id === t.id ? { ...x, result, reason: reasonText } : x)));
    if (nb !== balance) await persistBalance(nb);
  }

  const pollLiveTrades = useCallback(async () => {
    const liveTrades = trades.filter((t) => t.isLive && t.result === "pending");
    if (liveTrades.length === 0) {
      setLiveStatus({ on: false, text: "لا توجد صفقات مباشرة مفتوحة", lastUpdate: "" });
      return;
    }
    setLiveStatus((s) => ({ ...s, text: "جاري التحديث..." }));

    let successCount = 0;
    let errorCount = 0;
    const metaUpdates = {};

    for (const t of liveTrades) {
      // صفقات قديمة/غير صالحة (بدون priceSource أو sourceSymbol حقيقي - مثلاً
      // اتفتحت قبل ما نضيف مصدر مجاني لهالأصل، أو أصل "أخرى/يدوي"): منوقف
      // عنها فوراً بدون أي طلب شبكة، لأنها هي سبب طوفان "symbol=null" و429
      // يلي كان عم يصير.
      if (!t.priceSource || !t.sourceSymbol) {
        errorCount++;
        metaUpdates[t.id] = { currentPrice: null, lastError: "هذا الأصل غير مدعوم للمتابعة الحية (صفقة قديمة/غير صالحة) - أغلقيها يدوياً" };
        continue;
      }
      try {
        const price =
          t.priceSource === "goldapi"
            ? await fetchPriceGoldApi(t.sourceSymbol)
            : t.priceSource === "yahoo"
            ? await fetchPriceYahoo(t.sourceSymbol)
            : await fetchPriceFinnhub(t.sourceSymbol, apiKey);
        if (price && price > 0) {
          metaUpdates[t.id] = { currentPrice: price, lastError: null };
          successCount++;
          if (t.direction === "buy") {
            if (price <= t.sl) await closeLiveTrade(t, "loss", "ضرب وقف الخسارة فعلياً بالسوق");
            else if (price >= t.tp) await closeLiveTrade(t, "win", "ضرب الهدف فعلياً بالسوق");
          } else {
            if (price >= t.sl) await closeLiveTrade(t, "loss", "ضرب وقف الخسارة فعلياً بالسوق");
            else if (price <= t.tp) await closeLiveTrade(t, "win", "ضرب الهدف فعلياً بالسوق");
          }
        }
      } catch (e) {
        errorCount++;
        metaUpdates[t.id] = { currentPrice: null, lastError: e.message || "خطأ غير معروف" };
        // لو السبب تحديداً 429 (طلبات كتير)، منستنى أطول شوي قبل الصفقة يلي بعدها
        // عشان ما نضل نطبّل على Finnhub ونطول الحظر أكتر.
        if (String(e.message || "").includes("429")) await sleep(2000);
      }
      await sleep(120);
    }

    setLiveMeta((prev) => ({ ...prev, ...metaUpdates }));

    if (successCount > 0) {
      setLiveStatus({
        on: true,
        text: errorCount > 0 ? `متصل — يتابع ${successCount} صفقة (فشل تحديث ${errorCount})` : `متصل — يتابع ${successCount} صفقة`,
        lastUpdate: "آخر تحديث: " + new Date().toLocaleTimeString("ar-EG"),
      });
    } else {
      setLiveStatus({ on: false, text: "تعذّر الاتصال بكل المصادر - تحققي من الإنترنت/المفتاح", lastUpdate: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, apiKey, balance]);

  function startLivePolling() {
    if (livePollTimerRef.current) clearInterval(livePollTimerRef.current);
    pollLiveTrades();
    livePollTimerRef.current = setInterval(pollLiveTrades, 1500);
  }

  useEffect(() => {
    if (trades.some((t) => t.isLive && t.result === "pending")) startLivePolling();
    return () => {
      if (livePollTimerRef.current) clearInterval(livePollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ===================== إحصائيات ===================== */
  const total = trades.length;
  const wins = trades.filter((t) => t.result === "win").length;
  const losses = trades.filter((t) => t.result === "loss").length;
  const decided = wins + losses;
  const winRate = decided > 0 ? ((wins / decided) * 100).toFixed(1) + "%" : "—";
  const net = trades.reduce((acc, t) => {
    if (t.result === "win") return acc + t.rewardAmount;
    if (t.result === "loss") return acc - t.riskAmount;
    return acc;
  }, 0);

  const filteredTrades = trades.filter((t) => {
    if (currentFilter === "win" && t.result !== "win") return false;
    if (currentFilter === "loss" && t.result !== "loss") return false;
    if (currentFilter === "live" && !(t.isLive && t.result === "pending")) return false;
    const q = searchQuery.trim().toLowerCase();
    if (q && !(t.asset.toLowerCase().includes(q) || (t.setup || "").toLowerCase().includes(q))) return false;
    return true;
  });

  function resultPillClass(t) {
    if (t.isLive && t.result === "pending") return "pill pill-live";
    if (t.result === "win") return "pill pill-win";
    if (t.result === "loss") return "pill pill-loss";
    if (t.result === "breakeven") return "pill";
    return "pill";
  }
  function resultPillText(t) {
    if (t.isLive && t.result === "pending") return "🔴 مباشر - متابعة";
    if (t.result === "win") return "✓ رابحة";
    if (t.result === "loss") return "✗ خاسرة";
    if (t.result === "breakeven") return "تعادل";
    return "قيد التنفيذ";
  }

  /* ===================== خروج ===================== */
  function handleLogout() {
    if (onExit) { onExit(); return; }
    window.location.href = "/dashboard";
  }

  /* ===================== مودال الرصيد ===================== */
  function openBalanceModal() {
    setNewBalanceInput(String(balance));
    setBalanceModalOpen(true);
  }
  async function saveBalanceModal() {
    const val = parseFloat(newBalanceInput);
    if (isNaN(val) || val < 0) {
      alert("الرجاء إدخال رقم صحيح");
      return;
    }
    await persistBalance(val);
    setBalanceModalOpen(false);
  }

  /* ===================== مودال الإعدادات ===================== */
  function openSettingsModal() {
    setApiKeyInput(apiKey);
    setSettingsModalOpen(true);
  }
  function saveSettingsModal() {
    const val = apiKeyInput.trim();
    setApiKey(val);
    localStorage.setItem(APIKEY_STORAGE_KEY, val);
    setSettingsModalOpen(false);
    startLivePolling();
  }

  const riskHigh = preview.riskPercent > 2;

  return (
    <div style={{ direction: "rtl" }}>
      <style>{`
        :root{
          --bg:#141414; --panel:linear-gradient(145deg, #111108, #141414); --panel2:#15151a;
          --border:#D4AF3722; --border-strong:#D4AF3755; --gold:#D4AF37; --gold-dark:#9C7A22;
          --green:#00C853; --red:#FF4D4F; --text:#F5F5F5; --muted:#666666;
        }
        .qta-root{ background:radial-gradient(ellipse at top, #1a1608 0%, #141414 60%); color:var(--text);
          font-family:'Segoe UI', Tahoma, Arial, sans-serif; direction:rtl; padding:1.5rem; min-height:100vh; }
        .qta-container{max-width:1400px;margin:0 auto;}
        .qta-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;padding-bottom:1.25rem;border-bottom:1px solid var(--border);}
        .qta-header-left{display:flex;align-items:center;gap:1rem;flex-wrap:wrap;}
        .qta-header-title{display:flex;align-items:center;gap:0.8rem;}
        .qta-header-logo{width:46px;height:46px;border-radius:50%;border:2px solid var(--gold);box-shadow:0 0 20px #D4AF3744;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#000;font-size:1.1rem;}
        .qta-brand{color:var(--gold);font-size:11px;letter-spacing:3px;margin:0 0 4px;}
        .qta-header-title h1{font-size:1.4rem;margin:0;font-weight:800;}
        .qta-header-title p{margin:0.25rem 0 0;color:var(--muted);font-size:0.85rem;}
        .qta-badge{display:flex;align-items:center;gap:0.4rem;padding:0.45rem 1rem;border-radius:20px;font-size:0.9rem;font-weight:bold;cursor:default;border:1px solid transparent;}
        .qta-badge-user{background:#D4AF3714;color:var(--gold);border-color:var(--border);}
        .qta-badge-balance{background:#0f3d2c;color:var(--green);cursor:pointer;border-color:#00C85333;}
        .qta-badge-balance:hover{filter:brightness(1.2);}
        .qta-btn-logout{background:transparent;border:1px solid var(--border);color:var(--muted);padding:0.5rem 1rem;border-radius:8px;cursor:pointer;font-size:0.85rem;transition:all .15s;}
        .qta-btn-logout:hover{border-color:var(--red);color:var(--red);}
        .qta-btn-settings{background:transparent;border:1px solid var(--border);color:var(--muted);padding:0.5rem 0.7rem;border-radius:8px;cursor:pointer;font-size:0.85rem;transition:all .15s;}
        .qta-btn-settings:hover{border-color:var(--gold);color:var(--gold);}
        .qta-stats-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:0.75rem;margin-bottom:1.5rem;}
        .qta-stat-card{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:1.1rem 1rem;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.3);}
        .qta-stat-label{color:var(--muted);font-size:0.78rem;margin-bottom:0.5rem;}
        .qta-stat-value{font-size:1.4rem;font-weight:800;}
        .qta-live-banner{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:0.6rem 1rem;margin-bottom:1rem;font-size:0.82rem;color:var(--muted);}
        .qta-live-dot{width:8px;height:8px;border-radius:50%;background:var(--muted);display:inline-block;margin-left:6px;}
        .qta-live-dot.on{background:var(--green);box-shadow:0 0 6px var(--green);}
        .qta-live-dot.off{background:var(--red);}
        .qta-form-box{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:1.5rem;margin-bottom:1.5rem;box-shadow:0 4px 20px rgba(0,0,0,0.3);}
        .qta-form-title{font-size:1rem;margin-bottom:1rem;color:#ddd;display:flex;justify-content:space-between;align-items:center;font-weight:700;}
        .qta-mode-toggle{display:flex;gap:0.4rem;}
        .qta-mode-btn{background:#141414;border:1px solid var(--border);color:var(--muted);padding:0.4rem 0.9rem;border-radius:8px;cursor:pointer;font-size:0.8rem;transition:all .15s;}
        .qta-mode-btn.active{background:linear-gradient(135deg, var(--gold), var(--gold-dark));color:#000;font-weight:bold;border-color:var(--gold);}
        .qta-form-row{display:grid;grid-template-columns:repeat(6,1fr);gap:0.75rem;margin-bottom:0.75rem;}
        .qta-field label{display:block;color:var(--muted);font-size:0.78rem;margin-bottom:0.3rem;}
        .qta-field input, .qta-field select{width:100%;background:#141414;border:1px solid var(--border);color:var(--text);padding:0.55rem 0.6rem;border-radius:8px;font-size:0.9rem;}
        .qta-field input:focus, .qta-field select:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px #D4AF371a;}
        .qta-btn-add{background:linear-gradient(135deg, var(--gold), var(--gold-dark));color:#000;border:none;border-radius:8px;font-weight:bold;font-size:0.95rem;cursor:pointer;height:38px;margin-top:1.4rem;box-shadow:0 4px 12px #D4AF3744;width:100%;}
        .qta-btn-add:hover{filter:brightness(1.1);}
        .qta-btn-add.live{background:var(--green);box-shadow:0 4px 12px #00C85344;}
        .qta-preview-box{margin-top:0.5rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;border:1px solid var(--green);background:#0f1f17;border-radius:12px;padding:1rem 1.5rem;}
        .qta-preview-box.risk-high{border-color:var(--red);background:#1f0f0f;}
        .qta-preview-left{display:flex;gap:1.8rem;flex-wrap:wrap;}
        .qta-preview-item{text-align:center;}
        .qta-preview-item .l{color:var(--muted);font-size:0.75rem;display:block;margin-bottom:0.2rem;}
        .qta-preview-item .v{font-weight:bold;font-size:0.95rem;}
        .qta-preview-right{display:flex;align-items:center;gap:0.6rem;}
        .qta-preview-right .v{font-size:1.3rem;font-weight:bold;}
        .qta-preview-right .tag{font-size:0.85rem;color:var(--muted);}
        .qta-check-circle{width:26px;height:26px;border-radius:50%;background:var(--green);color:#000;display:flex;align-items:center;justify-content:center;font-weight:bold;}
        .risk-high .qta-check-circle{background:var(--red);color:#fff;}
        .qta-toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.75rem;}
        .qta-search-input{flex:1;min-width:220px;background:var(--panel);border:1px solid var(--border);color:var(--text);padding:0.6rem 1rem;border-radius:8px;}
        .qta-search-input:focus{outline:none;border-color:var(--gold);}
        .qta-filter-group{display:flex;gap:0.4rem;flex-wrap:wrap;}
        .qta-filter-btn{background:var(--panel);border:1px solid var(--border);color:var(--muted);padding:0.5rem 1rem;border-radius:8px;cursor:pointer;font-size:0.85rem;transition:all .15s;}
        .qta-filter-btn.active{background:linear-gradient(135deg, var(--gold), var(--gold-dark));color:#000;border-color:var(--gold);font-weight:bold;}
        .qta-table-wrap{background:var(--panel);border:1px solid var(--border);border-radius:16px;overflow-x:auto;margin-bottom:1.5rem;box-shadow:0 4px 20px rgba(0,0,0,0.3);}
        .qta-table{width:100%;border-collapse:collapse;min-width:1100px;}
        .qta-table th, .qta-table td{padding:0.85rem 0.6rem;text-align:center;font-size:0.85rem;white-space:nowrap;}
        .qta-table th{color:var(--gold);border-bottom:1px solid var(--border);font-weight:600;font-size:0.78rem;letter-spacing:0.5px;}
        .qta-table tbody tr{border-bottom:1px solid #1a1a0f;}
        .qta-table tbody tr:hover{background:#D4AF370d;}
        .qta-table tbody tr.live-row{background:#101a16;}
        .qta-empty-row td{padding:3rem 0;color:var(--muted);}
        .pill{padding:0.25rem 0.6rem;border-radius:6px;font-size:0.78rem;font-weight:bold;background:#222;color:#999;}
        .pill-win{background:#0f3d2c;color:var(--green);}
        .pill-loss{background:#3d0f0f;color:var(--red);}
        .pill-live{background:#1d3a2f;color:var(--green);animation:qtaPulse 1.5s infinite;}
        @keyframes qtaPulse{0%{opacity:1;}50%{opacity:0.5;}100%{opacity:1;}}
        .pill-buy{color:var(--green);}
        .pill-sell{color:var(--red);}
        .qta-del-btn{background:transparent;border:none;color:var(--red);cursor:pointer;font-size:1rem;}
        .qta-bottom-actions{display:flex;gap:0.75rem;}
        .qta-btn-secondary{background:var(--panel);border:1px solid var(--border);color:var(--text);padding:0.6rem 1.2rem;border-radius:8px;cursor:pointer;font-size:0.85rem;transition:all .15s;}
        .qta-btn-secondary:hover{border-color:var(--gold);color:var(--gold);}
        .qta-btn-danger:hover{border-color:var(--red);color:var(--red);}
        .qta-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.75);display:none;align-items:center;justify-content:center;z-index:50;}
        .qta-modal-overlay.open{display:flex;}
        .qta-modal-box{background:linear-gradient(145deg, #151007, #141414);border:1px solid var(--border-strong);border-radius:16px;padding:1.5rem;width:340px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.6);}
        .qta-modal-box h3{margin-top:0;color:var(--gold);}
        .qta-modal-box input{width:100%;background:#141414;border:1px solid var(--border);color:var(--text);padding:0.6rem;border-radius:8px;margin:0.5rem 0 1rem;font-size:0.95rem;}
        .qta-modal-box input:focus{outline:none;border-color:var(--gold);}
        .qta-modal-actions{display:flex;gap:0.6rem;justify-content:flex-end;}
        .qta-modal-box small{color:var(--muted);display:block;margin-top:-0.5rem;margin-bottom:0.8rem;line-height:1.6;}
        .qta-modal-box a{color:var(--gold);}
        @media (max-width:1100px){ .qta-stats-grid{grid-template-columns:repeat(3,1fr);} .qta-form-row{grid-template-columns:repeat(3,1fr);} }
        @media (max-width:600px){ .qta-stats-grid{grid-template-columns:repeat(2,1fr);} .qta-form-row{grid-template-columns:repeat(2,1fr);} }
      `}</style>

      <div className="qta-root">
        <div className="qta-container">
          {/* Header */}
          <div className="qta-header">
            <div className="qta-header-left">
              <button className="qta-btn-logout" onClick={handleLogout}>خروج</button>
              <div className="qta-badge qta-badge-user">👤 <span>{username}</span></div>
              <div className="qta-badge qta-badge-balance" onClick={openBalanceModal} title="اضغط لتعديل الرصيد">
                💰 ${fmtBalance(balance)} ✎
              </div>
              <button className="qta-btn-settings" onClick={openSettingsModal} title="إعدادات الاتصال بالسوق">⚙ السوق الحي</button>
            </div>
            <div className="qta-header-title">
              <div className="qta-header-logo">📊</div>
              <div style={{ textAlign: "right" }}>
                <p className="qta-brand">QAIS TRADING ACADEMY</p>
                <h1>أداة الباك تيست</h1>
                <p>سجّل صفقاتك وحلّل أداءك</p>
              </div>
            </div>
          </div>

          <div className="qta-live-banner">
            <span>
              📡 حالة الاتصال بالسوق الحي: {liveStatus.text}{" "}
              <span className={`qta-live-dot ${liveStatus.on ? "on" : "off"}`}></span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span>{liveStatus.lastUpdate}</span>
              <button className="qta-btn-secondary" style={{ padding: "0.3rem 0.7rem", fontSize: "0.78rem" }} onClick={pollLiveTrades}>
                🔄 تحديث الآن
              </button>
            </span>
          </div>

          {/* Stats */}
          <div className="qta-stats-grid">
            <div className="qta-stat-card"><div className="qta-stat-label">إجمالي الصفقات</div><div className="qta-stat-value">{total}</div></div>
            <div className="qta-stat-card"><div className="qta-stat-label">نسبة النجاح</div><div className="qta-stat-value">{winRate}</div></div>
            <div className="qta-stat-card">
              <div className="qta-stat-label">صافي الربح/الخسارة</div>
              <div className="qta-stat-value" style={{ color: net >= 0 ? "var(--green)" : "var(--red)" }}>
                {(net >= 0 ? "$" : "-$") + fmt(Math.abs(net))}
              </div>
            </div>
            <div className="qta-stat-card"><div className="qta-stat-label">رأس المال الحالي</div><div className="qta-stat-value" style={{ color: "var(--gold)" }}>${fmt(balance)}</div></div>
            <div className="qta-stat-card"><div className="qta-stat-label">رابحة</div><div className="qta-stat-value" style={{ color: "var(--green)" }}>{wins}</div></div>
            <div className="qta-stat-card"><div className="qta-stat-label">خاسرة</div><div className="qta-stat-value" style={{ color: "var(--red)" }}>{losses}</div></div>
          </div>

          {/* Form */}
          <div className="qta-form-box">
            <div className="qta-form-title">
              <span>إضافة صفقة جديدة</span>
              <div className="qta-mode-toggle">
                <button className={`qta-mode-btn ${currentMode === "manual" ? "active" : ""}`} onClick={() => setMode("manual")}>📝 يدوية (باك تيست)</button>
                <button className={`qta-mode-btn ${currentMode === "live" ? "active" : ""}`} onClick={() => setMode("live")}>🔴 مباشر (متابعة حقيقية)</button>
              </div>
            </div>
            <div className="qta-form-row">
              <div className="qta-field">
                <label>الأصل</label>
                <select value={asset} onChange={(e) => handleAssetChange(e.target.value)}>
                  {ASSETS.map((g) => (
                    <optgroup key={g.group} label={g.group}>
                      {g.items.map((it) => (
                        <option key={it.v} value={it.v}>{it.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="qta-field">
                <label>التاريخ</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="qta-field">
                <label>الاتجاه</label>
                <select value={direction} onChange={(e) => setDirection(e.target.value)}>
                  <option value="buy">▲ شراء</option>
                  <option value="sell">▼ بيع</option>
                </select>
              </div>
              <div className="qta-field">
                <label>اللوت / الحجم</label>
                <input type="number" step="0.01" value={lot} onChange={(e) => setLot(e.target.value)} />
              </div>
              {currentMode === "manual" && (
                <div className="qta-field">
                  <label>النتيجة</label>
                  <select value={result} onChange={(e) => setResult(e.target.value)}>
                    <option value="pending">قيد التنفيذ</option>
                    <option value="win">✓ رابحة</option>
                    <option value="loss">✗ خاسرة</option>
                    <option value="breakeven">تعادل</option>
                  </select>
                </div>
              )}
              <div className="qta-field">
                <label>الإعداد</label>
                <input type="text" value={setup} onChange={(e) => setSetup(e.target.value)} placeholder="مثال: اختراق + ريتست" />
              </div>
            </div>
            <div className="qta-form-row">
              <div className="qta-field">
                <label>{currentMode === "live" ? "سعر الدخول الحالي (تلقائي)" : "سعر الدخول"}</label>
                <input type="number" step="any" value={entry} onChange={(e) => { userEditedEntryRef.current = true; setEntry(e.target.value); }} />
              </div>
              <div className="qta-field">
                <label>وقف الخسارة (SL)</label>
                <input type="number" step="any" value={sl} onChange={(e) => setSl(e.target.value)} />
              </div>
              <div className="qta-field">
                <label>الهدف (TP)</label>
                <input type="number" step="any" value={tp} onChange={(e) => setTp(e.target.value)} />
              </div>
              {currentMode === "manual" && (
                <div className="qta-field" style={{ gridColumn: "span 2" }}>
                  <label>سبب النتيجة</label>
                  <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: ضرب الهدف بالكامل" />
                </div>
              )}
              <div className="qta-field" style={{ display: "flex", alignItems: "flex-end" }}>
                <button className={`qta-btn-add ${currentMode === "live" ? "live" : ""}`} onClick={handleAdd}>
                  {currentMode === "live" ? "🔴 فتح صفقة مباشرة" : "+ أضف"}
                </button>
              </div>
            </div>

            <div className={`qta-preview-box ${riskHigh ? "risk-high" : ""}`}>
              <div className="qta-preview-left">
                <div className="qta-preview-item"><span className="l">R:R</span><span className="v">{preview.riskAmount > 0 ? `1:${preview.rr.toFixed(2)}` : "—"}</span></div>
                <div className="qta-preview-item"><span className="l">ربح متوقع</span><span className="v" style={{ color: "var(--green)" }}>${fmt(preview.rewardAmount)}+</span></div>
                <div className="qta-preview-item"><span className="l">خسارة متوقعة</span><span className="v" style={{ color: "var(--red)" }}>${fmt(preview.riskAmount)}-</span></div>
              </div>
              <div className="qta-preview-right">
                <span className="tag">{riskHigh ? "مخاطرة مرتفعة" : "مخاطرة منخفضة"}</span>
                <span className="v">(${fmt(preview.riskAmount)}) {preview.riskPercent.toFixed(2)}%</span>
                <div className="qta-check-circle">✓</div>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="qta-toolbar">
            <input className="qta-search-input" placeholder="🔍 ابحث بالأصل أو الإعداد..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <div className="qta-filter-group">
              {[
                { k: "all", label: "الكل" },
                { k: "live", label: "مباشر 🔴" },
                { k: "win", label: "الرابحة" },
                { k: "loss", label: "الخاسرة" },
              ].map((f) => (
                <button key={f.k} className={`qta-filter-btn ${currentFilter === f.k ? "active" : ""}`} onClick={() => setCurrentFilter(f.k)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="qta-table-wrap">
            <table className="qta-table">
              <thead>
                <tr>
                  <th>#</th><th>الأصل</th><th>التاريخ</th><th>الاتجاه</th><th>لوت</th><th>دخول</th>
                  <th>السعر الحالي</th><th>SL</th><th>TP</th><th>R:R</th><th>مخاطرة $</th><th>مخاطرة %</th>
                  <th>الإعداد</th><th>سبب النتيجة</th><th>النتيجة</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.length === 0 ? (
                  <tr className="qta-empty-row"><td colSpan={16}>{trades.length === 0 ? "لا توجد صفقات — أضف أول صفقة لتبدأ تحليلك" : "لا توجد صفقات مطابقة"}</td></tr>
                ) : (
                  filteredTrades.map((t) => {
                    const idx = trades.indexOf(t) + 1;
                    const meta = liveMeta[t.id];
                    const isPendingLive = t.isLive && t.result === "pending";
                    return (
                      <tr key={t.id} className={isPendingLive ? "live-row" : ""}>
                        <td>{idx}</td>
                        <td>{t.asset}</td>
                        <td>{t.date}</td>
                        <td className={t.direction === "buy" ? "pill-buy" : "pill-sell"}>{t.direction === "buy" ? "▲ شراء" : "▼ بيع"}</td>
                        <td>{t.lot}</td>
                        <td>{fmt(t.entry)}</td>
                        <td title={meta?.lastError || ""}>
                          {isPendingLive ? (meta?.currentPrice ? fmt(meta.currentPrice) : meta?.lastError ? "⚠️ خطأ" : "...جاري الجلب") : "—"}
                        </td>
                        <td>{fmt(t.sl)}</td>
                        <td>{fmt(t.tp)}</td>
                        <td>1:{t.rr.toFixed(2)}</td>
                        <td>${fmt(t.riskAmount)}</td>
                        <td>{t.riskPercent.toFixed(2)}%</td>
                        <td>{t.setup || "—"}</td>
                        <td>{t.reason || "—"}</td>
                        <td><span className={resultPillClass(t)}>{resultPillText(t)}</span></td>
                        <td><button className="qta-del-btn" onClick={() => deleteTrade(t.id)}>🗑</button></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="qta-bottom-actions">
            <button className="qta-btn-secondary qta-btn-danger" onClick={clearAll}>🗑 مسح الكل</button>
            <button className="qta-btn-secondary" onClick={exportCsv}>⬇ تصدير CSV</button>
          </div>
        </div>

        {/* Balance Modal */}
        <div className={`qta-modal-overlay ${balanceModalOpen ? "open" : ""}`}>
          <div className="qta-modal-box">
            <h3>تعديل رأس المال</h3>
            <small>هذا يغيّر رأس المال الحالي يدوياً. لا يحذف الصفقات المسجلة.</small>
            <input type="number" value={newBalanceInput} onChange={(e) => setNewBalanceInput(e.target.value)} placeholder="مثال: 5000" />
            <div className="qta-modal-actions">
              <button className="qta-btn-secondary" onClick={() => setBalanceModalOpen(false)}>إلغاء</button>
              <button className="qta-btn-add" style={{ marginTop: 0, width: "auto", padding: "0 1.2rem" }} onClick={saveBalanceModal}>حفظ</button>
            </div>
          </div>
        </div>

        {/* Settings Modal */}
        <div className={`qta-modal-overlay ${settingsModalOpen ? "open" : ""}`}>
          <div className="qta-modal-box">
            <h3>إعدادات السوق الحي</h3>
            <small>
              <b>المعادن</b> تشتغل مباشرة تلقائياً وبدون أي مفتاح. المفتاح هون مطلوب فقط لمتابعة{" "}
              <b>الكريبتو والأسهم الأمريكية</b> مباشرة، عبر Finnhub.io.{" "}
              احصلي على مفتاح مجاني من <a href="https://finnhub.io/register" target="_blank" rel="noreferrer">finnhub.io</a>.
            </small>
            <input type="text" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder="الصقي Finnhub API Key هون" />
            <div className="qta-modal-actions">
              <button className="qta-btn-secondary" onClick={() => setSettingsModalOpen(false)}>إلغاء</button>
              <button className="qta-btn-add" style={{ marginTop: 0, width: "auto", padding: "0 1.2rem" }} onClick={saveSettingsModal}>حفظ</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
