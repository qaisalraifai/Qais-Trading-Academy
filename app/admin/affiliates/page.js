"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { s as baseStyles } from "../styles";
import AffiliatesPanel from "../components/AffiliatesPanel";

// صفحة مستقلة تلف نفس مكوّن AffiliatesPanel المستخدم بلوحة الأدمن الرئيسية —
// نفس المنطق بمكان واحد بس (بدل نسخة مكررة كانت بتحتاج تحديث بمكانين
// في كل مرة يتغيّر فيها شي بإدارة برنامج العمولة).
export default function AdminAffiliatesPage() {
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    checkAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "admin") { router.push("/dashboard"); return; }
  }

  return (
    <div style={baseStyles.page}>
      <div style={baseStyles.header}>
        <div>
          <p style={baseStyles.headerSub}>QAIS TRADING ACADEMY — ADMIN</p>
          <h1 style={baseStyles.headerTitle}>إدارة برنامج التسويق بالعمولة</h1>
        </div>
        <Link href="/admin" style={{ ...baseStyles.btn, textDecoration: "none" }}>← رجوع للوحة الأدمن</Link>
      </div>

      <div style={baseStyles.section}>
        <AffiliatesPanel />
      </div>
    </div>
  );
}
