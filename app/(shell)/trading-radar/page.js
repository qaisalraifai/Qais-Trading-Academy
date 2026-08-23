import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { getVerifiedUserId } from "@/lib/auth-context";
import RadarView from "../dashboard/components/RadarView";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "Trading Radar" — بديل التبويب القديم بالداشبورد.
// المكوّن نفسه (RadarView / MarketIntelligenceView) وكل منطقه لم يتغيّر إطلاقاً،
// فقط أصبح صفحة كاملة بمساحتها الخاصة بدل ما يكون Card داخل الداشبورد.
export default async function TradingRadarPage() {
  const supabase = await createClient();
  /* الهوية من ترويسة الـmiddleware المتحقَّقة — بلا رحلة شبكية
     تانية لنفس الفحص. بترجع لـauth.getUser() لو الترويسة غابت. */
  const userId = await getVerifiedUserId();
  if (!userId) redirect("/login");


  return (
    <RadarView />
  );
}
