"use client";
import { useState } from "react";
import Link from "next/link";

const gold = "#E8B86D";

/**
 * مكوّن مشترك لعرض صفحات قانونية (شروط، خصوصية، استرجاع) بلغتين
 * مع زر تبديل بسيط بينهم. titleAr/titleEn وسط الصفحة، contentAr/contentEn
 * كل واحد منهم عبارة عن مصفوفة أقسام { heading, body }.
 */
export default function LegalPage({ titleAr, titleEn, sectionsAr, sectionsEn, lastUpdated }) {
  const [lang, setLang] = useState("ar"); // ar | en
  const isAr = lang === "ar";
  const sections = isAr ? sectionsAr : sectionsEn;
  const title = isAr ? titleAr : titleEn;

  return (
    <div style={styles.container} dir={isAr ? "rtl" : "ltr"}>
      <div style={styles.topBar}>
        <Link href="/" style={styles.logoLink}>QTA</Link>
        <button style={styles.langBtn} onClick={() => setLang(isAr ? "en" : "ar")}>
          {isAr ? "English" : "العربية"}
        </button>
      </div>

      <div style={styles.header}>
        <h1 style={styles.title}>{title}</h1>
        <p style={styles.updated}>
          {isAr ? "آخر تحديث: " : "Last updated: "}
          {lastUpdated}
        </p>
      </div>

      <div style={styles.content}>
        {sections.map((s, i) => (
          <div key={i} style={styles.section}>
            <h2 style={styles.sectionTitle}>{s.heading}</h2>
            {s.body.map((p, j) => (
              <p key={j} style={styles.paragraph}>{p}</p>
            ))}
          </div>
        ))}
      </div>

      <div style={styles.contactBox}>
        <p style={styles.contactLabel}>{isAr ? "للتواصل معنا:" : "Contact us:"}</p>
        <a href="mailto:qaisalraifai@gmail.com" style={styles.contactEmail}>qaisalraifai@gmail.com</a>
      </div>

      <div style={styles.footerLinks}>
        <Link href="/terms" style={styles.footerLink}>{isAr ? "الشروط والأحكام" : "Terms of Service"}</Link>
        <span style={styles.dot}>•</span>
        <Link href="/privacy" style={styles.footerLink}>{isAr ? "سياسة الخصوصية" : "Privacy Policy"}</Link>
        <span style={styles.dot}>•</span>
        <Link href="/refund-policy" style={styles.footerLink}>{isAr ? "سياسة الاسترجاع" : "Refund Policy"}</Link>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#0D0E10",
    color: "#ddd",
    fontFamily: "'Georgia', serif",
    padding: "2rem 1.5rem 4rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  topBar: {
    width: "100%",
    maxWidth: "720px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "2.5rem",
  },
  logoLink: {
    color: gold,
    fontSize: "1.4rem",
    fontWeight: "bold",
    letterSpacing: "4px",
    textDecoration: "none",
  },
  langBtn: {
    backgroundColor: "transparent",
    border: `1px solid ${gold}`,
    color: gold,
    borderRadius: "4px",
    padding: "0.4rem 1rem",
    fontSize: "0.85rem",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  header: {
    width: "100%",
    maxWidth: "720px",
    textAlign: "center",
    marginBottom: "2.5rem",
  },
  title: { fontSize: "2rem", fontWeight: "bold", color: "#fff", marginBottom: "0.5rem" },
  updated: { color: "#666", fontSize: "0.85rem" },
  content: {
    width: "100%",
    maxWidth: "720px",
    backgroundColor: "#0f0f0f",
    border: "1px solid #2B2F36",
    borderRadius: "6px",
    padding: "2.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "1.75rem",
  },
  section: { display: "flex", flexDirection: "column", gap: "0.6rem" },
  sectionTitle: { color: gold, fontSize: "1.05rem", fontWeight: "bold" },
  paragraph: { color: "#aaa", fontSize: "0.95rem", lineHeight: 1.9, margin: 0 },
  contactBox: {
    width: "100%",
    maxWidth: "720px",
    marginTop: "1.5rem",
    textAlign: "center",
    padding: "1.25rem",
    border: "1px solid #2B2F36",
    borderRadius: "6px",
    backgroundColor: "#0f0f0f",
  },
  contactLabel: { color: "#666", fontSize: "0.85rem", margin: "0 0 0.4rem" },
  contactEmail: { color: gold, fontSize: "1rem", textDecoration: "none", fontWeight: "bold" },
  footerLinks: {
    marginTop: "2.5rem",
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  footerLink: { color: "#666", fontSize: "0.85rem", textDecoration: "none" },
  dot: { color: "#333" },
};
