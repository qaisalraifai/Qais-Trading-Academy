import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import ReplayClient from "./ReplayClient";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "Replay التدريب" — شارت + أدوات التحكم بالريبلاي + اليومية
// (Journal) + AI Coach + الإحصائيات. المكوّن (ReplayClient) لم يتغيّر إطلاقاً.
export default async function ReplayPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");


  return (
    <ReplayClient userId={user.id} />
  );
}
