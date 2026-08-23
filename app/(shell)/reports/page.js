import { createClient } from "@/lib/supabase-server";
import { getVerifiedUserId } from "@/lib/auth-context";
import { redirect } from "next/navigation";
import ReportsView from "../dashboard/components/ReportsView";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "التقارير". المكوّن (ReportsView) لم يتغيّر إطلاقاً.
export default async function ReportsPage() {
  const supabase = createClient();
  /* الهوية من ترويسة الـmiddleware المتحقَّقة — بلا رحلة شبكية
     تانية لنفس الفحص. بترجع لـauth.getUser() لو الترويسة غابت. */
  const userId = await getVerifiedUserId();
  if (!userId) redirect("/login");


  return (
    <ReportsView userId={userId} />
  );
}
