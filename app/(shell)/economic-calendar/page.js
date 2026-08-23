import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { getVerifiedUserId } from "@/lib/auth-context";
import { getProfileBasics } from "@/lib/shell-profile";
import EconomicCalendarClient from "./EconomicCalendarClient";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "التقويم الاقتصادي". نفس منطق الجلب والتحليل بالضبط،
// منقول من تبويب الداشبورد القديم لملف EconomicCalendarClient.js.
export default async function EconomicCalendarPage() {
  const supabase = await createClient();
  /* الهوية من ترويسة الـmiddleware المتحقَّقة — بلا رحلة شبكية
     تانية لنفس الفحص. بترجع لـauth.getUser() لو الترويسة غابت. */
  const userId = await getVerifiedUserId();
  if (!userId) redirect("/login");

  /* بيانات البروفايل لمنطق هالصفحة نفسها — الغلاف صار باللياوت.
     نسخة خفيفة بلا بوابة الدفعة (اللياوت بينفّذها مرة وحدة). */
  const shellProfile = await getProfileBasics(supabase, userId);


  return (
    <EconomicCalendarClient isAdmin={shellProfile.isAdmin} />
  );
}
