import { createClient } from "@/lib/supabase-server";
import { getVerifiedUserId } from "@/lib/auth-context";
import { redirect } from "next/navigation";
import TradeDetailsClient from "./TradeDetailsClient";

export const dynamic = "force-dynamic";

export default async function TradeDetailsPage({ params }) {
  const supabase = await createClient();
  /* الهوية من ترويسة الـmiddleware المتحقَّقة — بلا رحلة شبكية
     تانية لنفس الفحص. بترجع لـauth.getUser() لو الترويسة غابت. */
  const userId = await getVerifiedUserId();
  if (!userId) redirect("/login");


  return (
    <TradeDetailsClient tradeId={params.id} />
  );
}
