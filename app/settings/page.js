import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import SettingsView from "../dashboard/components/SettingsView";
import PageShell from "@/app/components/layout/PageShell";
import { getShellProfile } from "@/lib/shell-profile";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "الإعدادات". المكوّن (SettingsView) لم يتغيّر إطلاقاً.
export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const shellProfile = await getShellProfile(supabase, user);

  return (
    <PageShell {...shellProfile}>
      <SettingsView username={shellProfile.username} />
    </PageShell>
  );
}
