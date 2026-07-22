import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import CoursesClient from "./CoursesClient";
import PageShell from "@/app/components/layout/PageShell";
import { getShellProfile } from "@/lib/shell-profile";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "المحاضرات / الكورسات". نفس منطق الجلب بالضبط،
// منقول من تبويب الداشبورد القديم لملف CoursesClient.js.
export default async function CoursesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const shellProfile = await getShellProfile(supabase, user);

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_streak")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <PageShell {...shellProfile}>
      <CoursesClient username={shellProfile.username} currentStreak={profile?.current_streak || 0} />
    </PageShell>
  );
}
