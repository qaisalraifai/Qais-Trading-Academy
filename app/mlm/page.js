"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import MlmClient from "./MlmClient";
import PageShell from "@/app/components/layout/PageShell";

export default function MlmPage() {
  const router = useRouter();
  const supabase = createClient();
  const [shellProfile, setShellProfile] = useState({ username: "", isAdmin: false, daysLeft: null });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: prof } = await supabase
        .from("profiles")
        .select("username, role, subscription_end")
        .eq("id", user.id)
        .maybeSingle();
      let daysLeft = null;
      if (prof?.subscription_end) {
        const diffMs = new Date(prof.subscription_end).getTime() - Date.now();
        daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }
      setShellProfile({ username: prof?.username || user.email, isAdmin: prof?.role === "admin", daysLeft });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageShell {...shellProfile}>
      <MlmClient />
    </PageShell>
  );
}
