import { redirect } from "next/navigation";

// صفحة /ai-trades/history صارت مدمجة داخل /ai-trades (تبويب "السجل والإحصائيات").
// هاي الصفحة تبقى موجودة بس لأي رابط قديم محفوظ، وبتحوّل تلقائياً للصفحة الموحّدة.
export default function AITradeHistoryPage() {
  redirect("/ai-trades?tab=history");
}
