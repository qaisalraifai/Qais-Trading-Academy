import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import AffiliateClient from "./AffiliateClient";

export default async function AffiliatePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, role, subscription_end")
    .eq("id", user.id)
    .single();

  return (
    <AffiliateClient
      username={profile?.username || user.email}
      isAdmin={profile?.role === "admin"}
      subscriptionEnd={profile?.subscription_end || null}
    />
  );
}
