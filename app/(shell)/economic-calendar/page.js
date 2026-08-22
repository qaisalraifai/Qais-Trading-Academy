import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { getProfileBasics } from "@/lib/shell-profile";
import EconomicCalendarClient from "./EconomicCalendarClient";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "التقويم الاقتصادي". نفس منطق الجلب والتحليل بالضبط،
// منقول من تبويب الداشبورد القديم لملف EconomicCalendarClient.js.
export default async function EconomicCalendarPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  /* بيانات البروفايل لمنطق هالصفحة نفسها — الغلاف صار باللياوت.
     نسخة خفيفة بلا بوابة الدفعة (اللياوت بينفّذها مرة وحدة). */
  const shellProfile = await getProfileBasics(supabase, user);


  return (
    <EconomicCalendarClient isAdmin={shellProfile.isAdmin} />
  );
}
