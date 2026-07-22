import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import TraderDnaView from "../dashboard/components/TraderDnaView";
import PageShell from "@/app/components/layout/PageShell";
import { getShellProfile } from "@/lib/shell-profile";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "بصمتك كمتداول". المكوّن (TraderDnaView) لم يتغيّر إطلاقاً.
export default async function TraderDnaPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const shellProfile = await getShellProfile(supabase, user);

  return (
    <PageShell {...shellProfile}>
      <TraderDnaView userId={user.id} />
    </PageShell>
  );
}
