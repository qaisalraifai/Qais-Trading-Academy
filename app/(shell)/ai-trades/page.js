import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import CombinedAITradesClient from "./CombinedClient";

export const dynamic = "force-dynamic";

export default async function AITradesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");


  return (
    <CombinedAITradesClient />
  );
}
