import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import TiersPageClient from "./TiersPageClient";

export default async function AffiliateTiersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");


  return (
    <TiersPageClient />
  );
}
