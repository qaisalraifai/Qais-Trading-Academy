import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import QaisEngineView from "../dashboard/components/QaisEngineView";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "Market Intelligence" — شارت كبير + لوحة تحليل QAIS SK Engine
// كاملة (Confidence / Bias / Trend / Market Structure / Risk / Volume + السيناريوهات
// وخطة الصفقة). المكوّن (QaisEngineView) وكل حساباته لم تتغيّر إطلاقاً.
export default async function MarketIntelligencePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");


  return (
    <QaisEngineView />
  );
}
