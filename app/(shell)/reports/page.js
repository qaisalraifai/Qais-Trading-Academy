import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import ReportsView from "../dashboard/components/ReportsView";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "التقارير". المكوّن (ReportsView) لم يتغيّر إطلاقاً.
export default async function ReportsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");


  return (
    <ReportsView userId={user.id} />
  );
}
