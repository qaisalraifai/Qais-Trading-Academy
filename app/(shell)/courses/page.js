import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { getVerifiedUserId } from "@/lib/auth-context";
import { getProfileBasics } from "@/lib/shell-profile";
import { getProfileRow } from "@/lib/profile-cache";
import CoursesClient from "./CoursesClient";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "المحاضرات / الكورسات". نفس منطق الجلب بالضبط،
// منقول من تبويب الداشبورد القديم لملف CoursesClient.js.
export default async function CoursesPage() {
  const supabase = createClient();
  /* الهوية من ترويسة الـmiddleware المتحقَّقة — بلا رحلة شبكية
     تانية لنفس الفحص. بترجع لـauth.getUser() لو الترويسة غابت. */
  const userId = await getVerifiedUserId();
  if (!userId) redirect("/login");

  /* بيانات البروفايل لمنطق هالصفحة نفسها — الغلاف صار باللياوت.
     نسخة خفيفة بلا بوابة الدفعة (اللياوت بينفّذها مرة وحدة). */
  const shellProfile = await getProfileBasics(supabase, userId);


  /* ⚠️ نفس صف اللياوت — موحَّد بـ`lib/profile-cache.js` لكل الطلب. */
  const profile = await getProfileRow(userId);

  return (
    <CoursesClient username={shellProfile.username} currentStreak={profile?.current_streak || 0} />
  );
}
