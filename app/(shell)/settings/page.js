import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { getProfileBasics } from "@/lib/shell-profile";
import SettingsView from "../dashboard/components/SettingsView";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "الإعدادات". المكوّن (SettingsView) لم يتغيّر إطلاقاً.
export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  /* بيانات البروفايل لمنطق هالصفحة نفسها — الغلاف صار باللياوت.
     نسخة خفيفة بلا بوابة الدفعة (اللياوت بينفّذها مرة وحدة). */
  const shellProfile = await getProfileBasics(supabase, user);


  return (
    <SettingsView username={shellProfile.username} />
  );
}
