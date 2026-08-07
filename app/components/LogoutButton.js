"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <button onClick={handleLogout} style={styles.button}>
      تسجيل الخروج
    </button>
  );
}

const styles = {
  button: {
    padding: "0.5rem 1rem",
    borderRadius: "3px",
    border: "1px solid #26314A",
    backgroundColor: "transparent",
    color: "#93A0B8",
    cursor: "pointer",
  },
};
