import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { getProfileBasics } from "@/lib/shell-profile";
import LiveView from "../dashboard/components/LiveView";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "البث المباشر". المكوّن (LiveView) لم يتغيّر إطلاقاً.
export default async function LiveSessionsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  /* بيانات البروفايل لمنطق هالصفحة نفسها — الغلاف صار باللياوت.
     نسخة خفيفة بلا بوابة الدفعة (اللياوت بينفّذها مرة وحدة). */
  const shellProfile = await getProfileBasics(supabase, user);


  return (
    <LiveView isAdmin={shellProfile.isAdmin} username={shellProfile.username} />
  );
}
