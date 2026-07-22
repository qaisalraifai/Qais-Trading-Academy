import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import LiveView from "../dashboard/components/LiveView";
import PageShell from "@/app/components/layout/PageShell";
import { getShellProfile } from "@/lib/shell-profile";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "البث المباشر". المكوّن (LiveView) لم يتغيّر إطلاقاً.
export default async function LiveSessionsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const shellProfile = await getShellProfile(supabase, user);

  return (
    <PageShell {...shellProfile}>
      <LiveView isAdmin={shellProfile.isAdmin} username={shellProfile.username} />
    </PageShell>
  );
}
