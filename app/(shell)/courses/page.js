import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { getProfileBasics } from "@/lib/shell-profile";
import CoursesClient from "./CoursesClient";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "المحاضرات / الكورسات". نفس منطق الجلب بالضبط،
// منقول من تبويب الداشبورد القديم لملف CoursesClient.js.
export default async function CoursesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  /* بيانات البروفايل لمنطق هالصفحة نفسها — الغلاف صار باللياوت.
     نسخة خفيفة بلا بوابة الدفعة (اللياوت بينفّذها مرة وحدة). */
  const shellProfile = await getProfileBasics(supabase, user);


  const { data: profile } = await supabase
    .from("profiles")
    .select("current_streak")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <CoursesClient username={shellProfile.username} currentStreak={profile?.current_streak || 0} />
  );
}
