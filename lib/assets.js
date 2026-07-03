
/* قائمة الأصول الموحّدة — نفس ترتيب وتسمية أداة الباك تيست
   حقل yahoo = رمز الأصل عند Yahoo Finance لجلب الشموع التاريخية (مصدر مجاني بالكامل، بدون مفتاح API، بيغطي المعادن والفوركس والكريبتو والمؤشرات والأسهم)
   إذا yahoo غير موجود، الأصل يظهر بالقائمة لكن معطّل بأداة الريبلاي */

export const ASSETS = [
  { group: "المعادن", items: [
    { v:"XAUUSD", label:"(ذهب) XAUUSD", yahoo:"XAUUSD=X" },
    { v:"XAGUSD", label:"(فضة) XAGUSD", yahoo:"XAGUSD=X" },
    { v:"XPTUSD", label:"(بلاتين) XPTUSD", yahoo:"XPTUSD=X" },
    { v:"XPDUSD", label:"(بلاديوم) XPDUSD", yahoo:"XPDUSD=X" },
    { v:"COPPER", label:"(نحاس) Copper", yahoo:"HG=F" },
  ]},
  { group: "فوركس", items: [
    { v:"EURUSD", label:"EUR/USD", yahoo:"EURUSD=X" },
    { v:"GBPUSD", label:"GBP/USD", yahoo:"GBPUSD=X" },
    { v:"USDJPY", label:"USD/JPY", yahoo:"USDJPY=X" },
    { v:"USDCHF", label:"USD/CHF", yahoo:"USDCHF=X" },
    { v:"AUDUSD", label:"AUD/USD", yahoo:"AUDUSD=X" },
    { v:"USDCAD", label:"USD/CAD", yahoo:"USDCAD=X" },
    { v:"NZDUSD", label:"NZD/USD", yahoo:"NZDUSD=X" },
    { v:"EURJPY", label:"EUR/JPY", yahoo:"EURJPY=X" },
    { v:"GBPJPY", label:"GBP/JPY", yahoo:"GBPJPY=X" },
    { v:"EURGBP", label:"EUR/GBP", yahoo:"EURGBP=X" },
  ]},
  { group: "كريبتو", items: [
    { v:"BTCUSD", label:"Bitcoin (BTC/USD)", yahoo:"BTC-USD" },
    { v:"ETHUSD", label:"Ethereum (ETH/USD)", yahoo:"ETH-USD" },
    { v:"SOLUSD", label:"Solana (SOL/USD)", yahoo:"SOL-USD" },
    { v:"XRPUSD", label:"Ripple (XRP/USD)", yahoo:"XRP-USD" },
    { v:"BNBUSD", label:"BNB/USD", yahoo:"BNB-USD" },
    { v:"DOGEUSD", label:"Dogecoin (DOGE/USD)", yahoo:"DOGE-USD" },
  ]},
  { group: "مؤشرات وأسهم", items: [
    { v:"US30", label:"US30 (داو جونز)", yahoo:"^DJI" },
    { v:"NAS100", label:"NAS100 (ناسداك)", yahoo:"^NDX" },
    { v:"SPX500", label:"SPX500 (S&P 500)", yahoo:"^GSPC" },
    { v:"AAPL", label:"Apple (AAPL)", yahoo:"AAPL" },
    { v:"TSLA", label:"Tesla (TSLA)", yahoo:"TSLA" },
    { v:"MSFT", label:"Microsoft (MSFT)", yahoo:"MSFT" },
    { v:"AMZN", label:"Amazon (AMZN)", yahoo:"AMZN" },
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
