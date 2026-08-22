import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import TradeDetailsClient from "./TradeDetailsClient";

export const dynamic = "force-dynamic";

export default async function TradeDetailsPage({ params }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");


  return (
    <TradeDetailsClient tradeId={params.id} />
  );
}
