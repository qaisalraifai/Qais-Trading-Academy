import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { getVerifiedUserId } from "@/lib/auth-context";
import ReplayClient from "./ReplayClient";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "Replay التدريب" — شارت + أدوات التحكم بالريبلاي + اليومية
// (Journal) + AI Coach + الإحصائيات. المكوّن (ReplayClient) لم يتغيّر إطلاقاً.
export default async function ReplayPage() {
  const supabase = await createClient();
  /* الهوية من ترويسة الـmiddleware المتحقَّقة — بلا رحلة شبكية
     تانية لنفس الفحص. بترجع لـauth.getUser() لو الترويسة غابت. */
  const userId = await getVerifiedUserId();
  if (!userId) redirect("/login");


  return (
    <ReplayClient userId={userId} />
  );
}
