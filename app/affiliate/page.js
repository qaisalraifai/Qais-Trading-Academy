import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import AffiliateClient from "./AffiliateClient";

export default async function AffiliatePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <AffiliateClient />;
}
