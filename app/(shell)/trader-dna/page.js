import { createClient } from "@/lib/supabase-server";
import { getVerifiedUserId } from "@/lib/auth-context";
import { redirect } from "next/navigation";
import TraderDnaView from "../dashboard/components/TraderDnaView";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "بصمتك كمتداول". المكوّن (TraderDnaView) لم يتغيّر إطلاقاً.
export default async function TraderDnaPage() {
  const supabase = createClient();
  /* الهوية من ترويسة الـmiddleware المتحقَّقة — بلا رحلة شبكية
     تانية لنفس الفحص. بترجع لـauth.getUser() لو الترويسة غابت. */
  const userId = await getVerifiedUserId();
  if (!userId) redirect("/login");


  return (
    <TraderDnaView userId={userId} />
  );
}
