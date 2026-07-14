import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import AffiliateClient from "./AffiliateClient";
import PageShell from "@/app/components/layout/PageShell";
import { getShellProfile } from "@/lib/shell-profile";

export default async function AffiliatePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const shellProfile = await getShellProfile(supabase, user);

  return (
    <PageShell {...shellProfile}>
      <AffiliateClient />
    </PageShell>
  );
}
