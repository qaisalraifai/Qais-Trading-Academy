import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { getVerifiedUserId } from "@/lib/auth-context";
import { getProfileBasics } from "@/lib/shell-profile";
import AccountsAdminView from "../dashboard/components/AccountsAdminView";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "إدارة الحسابات" — أدمن فقط. المكوّن (AccountsAdminView)
// لم يتغيّر إطلاقاً، فقط أضفنا حماية مستوى الصفحة (نفس شرط isAdmin المستخدم
// سابقاً بالداشبورد) عشان ما يوصلها إلا الأدمن حتى لو دخل الرابط مباشرة.
export default async function AccountsPage() {
  const supabase = createClient();
  /* الهوية من ترويسة الـmiddleware المتحقَّقة — بلا رحلة شبكية
     تانية لنفس الفحص. بترجع لـauth.getUser() لو الترويسة غابت. */
  const userId = await getVerifiedUserId();
  if (!userId) redirect("/login");

  /* بيانات البروفايل لمنطق هالصفحة نفسها — الغلاف صار باللياوت.
     نسخة خفيفة بلا بوابة الدفعة (اللياوت بينفّذها مرة وحدة). */
  const shellProfile = await getProfileBasics(supabase, userId);

  if (!shellProfile.isAdmin) redirect("/dashboard");

  return (
    <AccountsAdminView username={shellProfile.username} />
  );
}
