import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import RadarView from "../dashboard/components/RadarView";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "Trading Radar" — بديل التبويب القديم بالداشبورد.
// المكوّن نفسه (RadarView / MarketIntelligenceView) وكل منطقه لم يتغيّر إطلاقاً،
// فقط أصبح صفحة كاملة بمساحتها الخاصة بدل ما يكون Card داخل الداشبورد.
export default async function TradingRadarPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");


  return (
    <RadarView />
  );
}
