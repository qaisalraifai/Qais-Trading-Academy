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
   replay-candles/route.js (fetchYahooCandlesWithFallback). */
export const ASSETS = [
  { group: "المعادن", items: [
    { v:"XAUUSD", label:"(ذهب) XAUUSD", yahoo:"GC=F", yahooSpot:"XAU=", mult:100  },
    { v:"XAGUSD", label:"(فضة) XAGUSD", yahoo:"SI=F", yahooSpot:"XAG=", mult:5000  },
    { v:"XPTUSD", label:"(بلاتين) XPTUSD", yahoo:"PL=F", yahooSpot:"XPT=", mult:100  },
    { v:"XPDUSD", label:"(بلاديوم) XPDUSD", yahoo:"PA=F", yahooSpot:"XPD=", mult:100  },
    { v:"COPPER", label:"(نحاس) Copper", yahoo:"HG=F", mult:1  },
  ]},
  { group: "فوركس", items: [
    { v:"EURUSD", label:"EUR/USD", yahoo:"EURUSD=X", mult:100000  },
    { v:"GBPUSD", label:"GBP/USD", yahoo:"GBPUSD=X", mult:100000  },
    { v:"USDJPY", label:"USD/JPY", yahoo:"USDJPY=X", mult:1000  },
    { v:"USDCHF", label:"USD/CHF", yahoo:"USDCHF=X", mult:100000  },
    { v:"AUDUSD", label:"AUD/USD", yahoo:"AUDUSD=X", mult:100000  },
    { v:"USDCAD", label:"USD/CAD", yahoo:"USDCAD=X", mult:100000  },
    { v:"NZDUSD", label:"NZD/USD", yahoo:"NZDUSD=X", mult:100000  },
    { v:"EURJPY", label:"EUR/JPY", yahoo:"EURJPY=X", mult:1000  },
    { v:"GBPJPY", label:"GBP/JPY", yahoo:"GBPJPY=X", mult:1000  },
    { v:"EURGBP", label:"EUR/GBP", yahoo:"EURGBP=X", mult:100000  },
  ]},
  { group: "كريبتو", items: [
    { v:"BTCUSD", label:"Bitcoin (BTC/USD)", yahoo:"BTC-USD", mult:1  },
    { v:"ETHUSD", label:"Ethereum (ETH/USD)", yahoo:"ETH-USD", mult:1  },
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
    { v:"US30", label:"US30 (داو جونز)", yahoo:"YM=F", mult:1  },
    { v:"NAS100", label:"NAS100 (ناسداك)", yahoo:"NQ=F", mult:1  },
    { v:"SPX500", label:"SPX500 (S&P 500)", yahoo:"ES=F", mult:1  },
    { v:"AAPL", label:"Apple (AAPL)", yahoo:"AAPL", mult:1  },
    { v:"TSLA", label:"Tesla (TSLA)", yahoo:"TSLA", mult:1  },
    { v:"MSFT", label:"Microsoft (MSFT)", yahoo:"MSFT", mult:1  },
    { v:"AMZN", label:"Amazon (AMZN)", yahoo:"AMZN", mult:1  },
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
