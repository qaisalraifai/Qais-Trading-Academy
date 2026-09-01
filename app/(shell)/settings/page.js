import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { getVerifiedUserId } from "@/lib/auth-context";
import { getProfileBasics } from "@/lib/shell-profile";
import SettingsView from "../dashboard/components/SettingsView";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "الإعدادات". المكوّن (SettingsView) لم يتغيّر إطلاقاً.
export default async function SettingsPage() {
  const supabase = createClient();
  /* الهوية من ترويسة الـmiddleware المتحقَّقة — بلا رحلة شبكية
     تانية لنفس الفحص. بترجع لـauth.getUser() لو الترويسة غابت. */
  const userId = await getVerifiedUserId();
  if (!userId) redirect("/login");

  /* بيانات البروفايل لمنطق هالصفحة نفسها — الغلاف صار باللياوت.
     نسخة خفيفة بلا بوابة الدفعة (اللياوت بينفّذها مرة وحدة). */
  const shellProfile = await getProfileBasics(supabase, userId);


  return (
    <SettingsView username={shellProfile.username} gender={shellProfile.gender} />
  );
}
