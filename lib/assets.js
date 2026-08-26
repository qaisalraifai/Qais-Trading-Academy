/* قائمة الأصول الموحّدة — نفس ترتيب وتسمية أداة الباك تيست
   حقل yahoo = رمز الأصل عند Yahoo Finance لجلب الشموع التاريخية (مصدر مجاني بالكامل، بدون مفتاح API، بيغطي المعادن والفوركس والكريبتو والمؤشرات والأسهم)
   إذا yahoo غير موجود، الأصل يظهر بالقائمة لكن معطّل بأداة الاستعراض */

/* ============================================================================
   ملاحظة مهمة (سبب اختلاف شموع الذهب/الفضة عن TradingView):
   كنا نستخدم رمز العقد الآجل (futures، مثلاً GC=F للذهب) كبديل عن السبوت،
   لأن يوهو ما عندها تيكر سبوت موثوق لكل المعادن بنفس سهولة الفوركس. العقد
   الآجل أداة مختلفة عن السبوت/الـCFD يلي بتعرضه TradingView وأغلب البروكرات
   (زي CFI): جلسة تداول مختلفة، تسوية/إغلاق يومي مختلف، وفرق سعري (basis).
   والأخطر: يوهو بترجع "عقد مستمر" بيلزق بيانات عدة عقود شهرية وراء بعض،
   فعند كل "تدوير" (rollover، كل شهرين تقريباً بالذهب) بتصير قفزة سعرية
   مصطنعة - وهاد بالضبط سبب "شمعة كاملة بتتغير فجأة"، مش باغ بمنطق بناء
   الشموع نفسه (شوفي التعليق بأول lib/yahoo-candles.js لتفاصيل الإصلاح
   السابق لمنطق التجميع - هاد سبب مختلف تماماً وأعمق).
   الحل: نجرب أول رمز سبوت (yahooSpot) أقرب لتسعير TradingView/البروكر،
   ولو يوهو رفضه أو رجّع بيانات ناقصة بنرجع تلقائياً (fallback) لرمز العقد
   الآجل (yahoo) بدون ما ينكسر شي. شوفي lib/yahoo-candles.js وapp/api/
   replay-candles/route.js (fetchYahooCandlesWithFallback).

   تحديث إضافي (طلب صريح): ألغينا نهائياً أي رجوع تلقائي صامت للعقد الآجل
   (yahoo). حقل yahoo هلق موجود بس لمرجعية تاريخية/سكربتات تانية (كرون
   Trading Radar مثلاً)، بس أداة الريبلاي نفسها ما بتستخدمه كملاذ أخير
   إطلاقاً بعد اليوم - الترتيب صار: Twelve Data سبوت (twelveData) → Yahoo
   سبوت (yahooSpot) → خطأ واضح للمستخدمة بدل بيانات عقد آجل بصمت. شوفي
   lib/twelvedata-candles.js وapp/api/replay-candles/route.js. */
/* حقل dukascopy = رمز الأداة عند Dukascopy (بحروف صغيرة، بدون فاصل) - هلق
   هو مصدر الشموع الافتراضي/الأساسي لأداة الريبلاي (شوفي app/api/
   replay-candles/route.js، "المستوى 0"): مجاني بالكامل، بدون مفتاح API
   أو حد طلبات، عمق تاريخي حقيقي أكبر بكثير من يوهو (لغاية سنة بداية تغطية
   الأداة نفسها عند Dukascopy، عادة سنين للخلف - عكس حد يوهو العملي
   ~58 يوم لفريم 15 دقيقة)، وبيشيل تلقائياً شموع عطلة الأسبوع "المسطّحة"
   لكل الأصول والفريمات. لو مو موجود لأصل معيّن، هاد الأصل بيرجع تلقائياً
   لـTwelve Data ثم يوهو (نفس السلوك القديم) بس بدون الاستفادة من العمق
   التاريخي الإضافي أو إزالة شموع العطلة التلقائية. */
/* ⚠️ قياس ٢٠٢٦-٠٨-١٧: رموز `yahooSpot` الأربعة للمعادن **كلها ميتة**.
   XAUUSD=X · XAGUSD=X · XPTUSD=X · XPDUSD=X → HTTP 404 «Not Found» كلهن.
   (بالمقابل GC=F · SI=F · NQ=F لسا حيّة.)

   يعني طبقة يوهو للمعادن معطّلة فعلياً: لو Dukascopy وTwelve Data الاتنين
   فشلوا، المعادن بترجّع خطأ. **وهاد بالضبط السلوك المطلوب** حسب القرار
   الصريح فوق — خطأ واضح أفضل من بيانات عقد آجل بصمت.

   ⚠️ ممنوع تحطّ `yahooSpot: null` «تنضيفاً» للرموز الميتة.
   الاستدعاءات كلها `it.yahooSpot || it.yahoo`، فتفريغ الحقل بيخلّي القيمة
   ترجع لرمز العقد الآجل — يعني بيرجّع الرجوع الصامت اللي انلغى بطلب صريح.
   الرمز الميت هو اللي بيمنعه حالياً. لو بدك تشيله، لازم يتبدّل بحارس
   صريح بمنطق الجلب، مش بتفريغ الحقل.

   ولو انبدّل برمز سبوت حي: يوهو للمعادن الآجلة متناقضة بنيوياً مع الفريمات
   (GC=F ١٦.٩٪ توافق · SI=F أسوأ · بينما NQ=F ٧٨٪) — فالمشكلة بالمعادن مش
   بالمؤشرات، وأي بديل لازم ينقاس قبل ما ينوثق. */
export const ASSETS = [
  { group: "المعادن", items: [
    { v:"XAUUSD", label:"(ذهب) XAUUSD", yahoo:"GC=F", yahooSpot:"XAUUSD=X", twelveData:"XAU/USD", dukascopy:"xauusd", mult:100  },
    { v:"XAGUSD", label:"(فضة) XAGUSD", yahoo:"SI=F", yahooSpot:"XAGUSD=X", twelveData:"XAG/USD", dukascopy:"xagusd", mult:5000  },
    { v:"XPTUSD", label:"(بلاتين) XPTUSD", yahoo:"PL=F", yahooSpot:"XPTUSD=X", twelveData:"XPT/USD", dukascopy:"xptcmdusd", mult:100  },
    { v:"XPDUSD", label:"(بلاديوم) XPDUSD", yahoo:"PA=F", yahooSpot:"XPDUSD=X", twelveData:"XPD/USD", dukascopy:"xpdcmdusd", mult:100  },
    { v:"COPPER", label:"(نحاس) Copper", yahoo:"HG=F", dukascopy:"coppercmdusd", mult:1  },
  ]},
  { group: "فوركس", items: [
    { v:"EURUSD", label:"EUR/USD", yahoo:"EURUSD=X", dukascopy:"eurusd", mult:100000  },
    { v:"GBPUSD", label:"GBP/USD", yahoo:"GBPUSD=X", dukascopy:"gbpusd", mult:100000  },
    { v:"USDJPY", label:"USD/JPY", yahoo:"USDJPY=X", dukascopy:"usdjpy", mult:1000  },
    { v:"USDCHF", label:"USD/CHF", yahoo:"USDCHF=X", dukascopy:"usdchf", mult:100000  },
    { v:"AUDUSD", label:"AUD/USD", yahoo:"AUDUSD=X", dukascopy:"audusd", mult:100000  },
    { v:"USDCAD", label:"USD/CAD", yahoo:"USDCAD=X", dukascopy:"usdcad", mult:100000  },
    { v:"NZDUSD", label:"NZD/USD", yahoo:"NZDUSD=X", dukascopy:"nzdusd", mult:100000  },
    { v:"EURJPY", label:"EUR/JPY", yahoo:"EURJPY=X", dukascopy:"eurjpy", mult:1000  },
    { v:"GBPJPY", label:"GBP/JPY", yahoo:"GBPJPY=X", dukascopy:"gbpjpy", mult:1000  },
    { v:"EURGBP", label:"EUR/GBP", yahoo:"EURGBP=X", dukascopy:"eurgbp", mult:100000  },
  ]},
  { group: "كريبتو", items: [
    { v:"BTCUSD", label:"Bitcoin (BTC/USD)", yahoo:"BTC-USD", dukascopy:"btcusd", mult:1  },
    { v:"ETHUSD", label:"Ethereum (ETH/USD)", yahoo:"ETH-USD", dukascopy:"ethusd", mult:1  },
    { v:"SOLUSD", label:"Solana (SOL/USD)", yahoo:"SOL-USD", mult:1  },
    { v:"XRPUSD", label:"Ripple (XRP/USD)", yahoo:"XRP-USD", mult:1  },
    { v:"BNBUSD", label:"BNB/USD", yahoo:"BNB-USD", mult:1  },
    { v:"DOGEUSD", label:"Dogecoin (DOGE/USD)", yahoo:"DOGE-USD", mult:1  },
  ]},
  { group: "مؤشرات وأسهم", items: [
    /* مهم: نستخدم رمز العقد الآجل (futures) مش المؤشر النقدي (^DJI/^NDX/^GSPC).
       المؤشر النقدي بيتحدث بس وقت جلسة بورصة نيويورك الرسمية (9:30ص-4م تقريباً)
       وبيرجع فراغ تام خارجها، فلما نجمع شموعه متتالية بدون فجوة زمنية بتطلع
       قفزات سعرية وهمية ضخمة بين كل يوم وتاني، وشكل الحركة بيصير مالوش أي
       علاقة بالشارت الحقيقي عند البروكر. العقد الآجل بالمقابل بيتحرك شبه 24
       ساعة (يعكس حركة ما قبل/بعد السوق كمان)، وهيك أقرب بكثير لسلوك أدوات
       الـ CFD (NAS100/US30/SPX500) يلي البروكرات فعلياً بتتداولها. */
    { v:"US30", label:"US30 (داو جونز)", yahoo:"YM=F", dukascopy:"usa30idxusd", mult:1  },
    { v:"NAS100", label:"NAS100 (ناسداك)", yahoo:"NQ=F", dukascopy:"usatechidxusd", mult:1  },
    { v:"SPX500", label:"SPX500 (S&P 500)", yahoo:"ES=F", dukascopy:"usa500idxusd", mult:1  },
    { v:"AAPL", label:"Apple (AAPL)", yahoo:"AAPL", dukascopy:"aaplususd", mult:1  },
    { v:"TSLA", label:"Tesla (TSLA)", yahoo:"TSLA", dukascopy:"tslaususd", mult:1  },
    { v:"MSFT", label:"Microsoft (MSFT)", yahoo:"MSFT", dukascopy:"msftususd", mult:1  },
    { v:"AMZN", label:"Amazon (AMZN)", yahoo:"AMZN", dukascopy:"amznususd", mult:1  },
  ]},
];

export function getAssetByValue(v){
  for(const g of ASSETS){
    const found = g.items.find(i=>i.v===v);
    if(found) return found;
  }
  return null;
}

/* تحويل فريم أداة الباك تيست/الاستعراض لصيغة Twelve Data */
export const INTERVAL_MAP = {
  "1m": "1min",
  "5m": "5min",
  "15m": "15min",
  "1h": "1h",
  "4h": "4h",
  "1d": "1day",
};

/* مدة الفريم بالميلي ثانية - تستخدم لحساب عداد وقت الشمعة الحية */
export const INTERVAL_MS = {
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
};
