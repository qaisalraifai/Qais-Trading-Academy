import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import ReportsView from "../dashboard/components/ReportsView";
import PageShell from "@/app/components/layout/PageShell";
import { getShellProfile } from "@/lib/shell-profile";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "التقارير". المكوّن (ReportsView) لم يتغيّر إطلاقاً.
export default async function ReportsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const shellProfile = await getShellProfile(supabase, user);

  return (
    <PageShell {...shellProfile}>
      <ReportsView userId={user.id} />
    </PageShell>
  );
}
