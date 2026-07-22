import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import AITradesClient from "./AITradesClient";
import PageShell from "@/app/components/layout/PageShell";
import { getShellProfile } from "@/lib/shell-profile";

export const dynamic = "force-dynamic";

export default async function AITradesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const shellProfile = await getShellProfile(supabase, user);

  return (
    <PageShell {...shellProfile}>
      <AITradesClient />
    </PageShell>
  );
}
