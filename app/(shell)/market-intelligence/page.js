import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { getVerifiedUserId } from "@/lib/auth-context";
import QaisEngineView from "../dashboard/components/QaisEngineView";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "Market Intelligence" — شارت كبير + لوحة تحليل QAIS SK Engine
// كاملة (Confidence / Bias / Trend / Market Structure / Risk / Volume + السيناريوهات
// وخطة الصفقة). المكوّن (QaisEngineView) وكل حساباته لم تتغيّر إطلاقاً.
export default async function MarketIntelligencePage() {
  const supabase = await createClient();
  /* الهوية من ترويسة الـmiddleware المتحقَّقة — بلا رحلة شبكية
     تانية لنفس الفحص. بترجع لـauth.getUser() لو الترويسة غابت. */
  const userId = await getVerifiedUserId();
  if (!userId) redirect("/login");


  return (
    <QaisEngineView />
  );
}
