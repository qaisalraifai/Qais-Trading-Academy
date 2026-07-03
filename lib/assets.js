
/* قائمة الأصول الموحّدة — نفس ترتيب وتسمية أداة الباك تيست
   حقل td = رمز الأصل عند Twelve Data لجلب الشموع التاريخية/الحية
   إذا td غير موجود، الأصل يظهر بالقائمة لكن معطّل بأداة الريبلاي (ما في مصدر بيانات شموع مجاني له بعد) */

export const ASSETS = [
  { group: "المعادن", items: [
    { v:"XAUUSD", label:"(ذهب) XAUUSD", td:"XAU/USD" },
    { v:"XAGUSD", label:"(فضة) XAGUSD", td:"XAG/USD" },
    { v:"XPTUSD", label:"(بلاتين) XPTUSD", td:"XPT/USD" },
    { v:"XPDUSD", label:"(بلاديوم) XPDUSD", td:"XPD/USD" },
    { v:"COPPER", label:"(نحاس) Copper", td:null },
  ]},
  { group: "فوركس", items: [
    { v:"EURUSD", label:"EUR/USD", td:"EUR/USD" },
    { v:"GBPUSD", label:"GBP/USD", td:"GBP/USD" },
    { v:"USDJPY", label:"USD/JPY", td:"USD/JPY" },
    { v:"USDCHF", label:"USD/CHF", td:"USD/CHF" },
    { v:"AUDUSD", label:"AUD/USD", td:"AUD/USD" },
    { v:"USDCAD", label:"USD/CAD", td:"USD/CAD" },
    { v:"NZDUSD", label:"NZD/USD", td:"NZD/USD" },
    { v:"EURJPY", label:"EUR/JPY", td:"EUR/JPY" },
    { v:"GBPJPY", label:"GBP/JPY", td:"GBP/JPY" },
    { v:"EURGBP", label:"EUR/GBP", td:"EUR/GBP" },
  ]},
  { group: "كريبتو", items: [
    { v:"BTCUSD", label:"Bitcoin (BTC/USD)", td:"BTC/USD" },
    { v:"ETHUSD", label:"Ethereum (ETH/USD)", td:"ETH/USD" },
    { v:"SOLUSD", label:"Solana (SOL/USD)", td:"SOL/USD" },
    { v:"XRPUSD", label:"Ripple (XRP/USD)", td:"XRP/USD" },
    { v:"BNBUSD", label:"BNB/USD", td:"BNB/USD" },
    { v:"DOGEUSD", label:"Dogecoin (DOGE/USD)", td:"DOGE/USD" },
  ]},
  { group: "مؤشرات وأسهم", items: [
    { v:"US30", label:"US30 (داو جونز)", td:"DJI" },
    { v:"NAS100", label:"NAS100 (ناسداك)", td:"IXIC" },
    { v:"SPX500", label:"SPX500 (S&P 500)", td:"SPX" },
    { v:"AAPL", label:"Apple (AAPL)", td:"AAPL" },
    { v:"TSLA", label:"Tesla (TSLA)", td:"TSLA" },
    { v:"MSFT", label:"Microsoft (MSFT)", td:"MSFT" },
    { v:"AMZN", label:"Amazon (AMZN)", td:"AMZN" },
  ]},
];

export function getAssetByValue(v){
  for(const g of ASSETS){
    const found = g.items.find(i=>i.v===v);
    if(found) return found;
  }
  return null;
}

/* تحويل فريم أداة الباك تيست/الريبلاي لصيغة Twelve Data */
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
