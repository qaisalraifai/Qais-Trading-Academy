import Whop from "@whop/sdk";

// عميل Whop مشترك للمشروع كامل — بديل ملف الـ Paddle client اللي كان
// يتبنى inline بكل route كان محتاجه (app/api/webhook, app/api/account, ...).
// WHOP_SANDBOX=true بالتطوير بيوجّه الطلبات لبيئة sandbox.whop.com بدل الإنتاج.
let _whop = null;

export function getWhop() {
  if (!_whop) {
    const apiKey = process.env.WHOP_API_KEY;
    if (!apiKey) {
      throw new Error("متغير WHOP_API_KEY غير مضبوط بإعدادات المشروع.");
    }
    const isSandbox = process.env.WHOP_SANDBOX === "true";
    _whop = new Whop({
      apiKey,
      // webhookKey لازم يكون base64 لسر الـ webhook حتى unwrap() يقدر يتحقق من التوقيع
      webhookKey: Buffer.from(process.env.WHOP_WEBHOOK_SECRET || "").toString("base64"),
      ...(isSandbox && { baseURL: "https://sandbox-api.whop.com/api/v1" }),
    });
  }
  return _whop;
}
