import { createClient } from "@/lib/supabase-server";
import { getVerifiedUserId } from "@/lib/auth-context";
import { redirect } from "next/navigation";
import CombinedAITradesClient from "./CombinedClient";

export const dynamic = "force-dynamic";

export default async function AITradesPage() {
  const supabase = createClient();
  /* الهوية من ترويسة الـmiddleware المتحقَّقة — بلا رحلة شبكية
     تانية لنفس الفحص. بترجع لـauth.getUser() لو الترويسة غابت. */
  const userId = await getVerifiedUserId();
  if (!userId) redirect("/login");


  return (
    <CombinedAITradesClient />
  );
}
