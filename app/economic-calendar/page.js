import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import EconomicCalendarClient from "./EconomicCalendarClient";
import PageShell from "@/app/components/layout/PageShell";
import { getShellProfile } from "@/lib/shell-profile";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "التقويم الاقتصادي". نفس منطق الجلب والتحليل بالضبط،
// منقول من تبويب الداشبورد القديم لملف EconomicCalendarClient.js.
export default async function EconomicCalendarPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const shellProfile = await getShellProfile(supabase, user);

  return (
    <PageShell {...shellProfile}>
      <EconomicCalendarClient isAdmin={shellProfile.isAdmin} />
    </PageShell>
  );
}
