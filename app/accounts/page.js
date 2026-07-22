import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import AccountsAdminView from "../dashboard/components/AccountsAdminView";
import PageShell from "@/app/components/layout/PageShell";
import { getShellProfile } from "@/lib/shell-profile";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "إدارة الحسابات" — أدمن فقط. المكوّن (AccountsAdminView)
// لم يتغيّر إطلاقاً، فقط أضفنا حماية مستوى الصفحة (نفس شرط isAdmin المستخدم
// سابقاً بالداشبورد) عشان ما يوصلها إلا الأدمن حتى لو دخل الرابط مباشرة.
export default async function AccountsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const shellProfile = await getShellProfile(supabase, user);
  if (!shellProfile.isAdmin) redirect("/dashboard");

  return (
    <PageShell {...shellProfile}>
      <AccountsAdminView username={shellProfile.username} />
    </PageShell>
  );
}
