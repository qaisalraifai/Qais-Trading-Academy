import { XCircle } from "lucide-react";
import { createAdminClient } from "@/lib/supabase-server";
import PrintButton from "./CertificateClient";

// صفحة عامة (بدون تسجيل دخول) — تعرض الشهادة بتصميم جاهز للطباعة، وتصلح كرابط
// تحقق (Verification) لأي جهة تبي تتأكد إن الشهادة حقيقية عبر الكود الظاهر تحتها.
export default async function CertificatePage({ params }) {
  const admin = createAdminClient();

  const { data: cert } = await admin
    .from("batch_certificates")
    .select("id, certificate_code, issued_at, batch_id, user_id")
    .eq("certificate_code", params.code)
    .maybeSingle();

  if (!cert) {
    return (
      <div style={styles.page}>
        <div style={styles.notFound}>
          <p style={{ fontSize: 40 }}><XCircle size={14} aria-hidden /></p>
          <h1 style={{ color: "#fff", fontSize: 20 }}>هاد الكود مو موجود</h1>
          <p style={{ color: "#6E6690", fontSize: 14 }}>تأكد من رابط الشهادة وحاول مرة ثانية.</p>
        </div>
      </div>
    );
  }

  const { data: batch } = await admin
    .from("batches")
    .select("name, course_id")
    .eq("id", cert.batch_id)
    .maybeSingle();

  const { data: course } = batch
    ? await admin.from("courses").select("title, icon").eq("id", batch.course_id).maybeSingle()
    : { data: null };

  const { data: profile } = await admin
    .from("profiles")
    .select("username")
    .eq("id", cert.user_id)
    .maybeSingle();

  const issuedDate = new Date(cert.issued_at).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div style={styles.page}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .cert-card { box-shadow: none !important; }
        }
      `}</style>

      <div className="cert-card" style={styles.card}>
        <div style={styles.borderInner}>
          <p style={styles.brand}>QAIS TRADING ACADEMY</p>
          <p style={styles.subBrand}>شهادة إتمام</p>

          <div style={styles.icon}>{course?.icon || "🎓"}</div>

          <p style={styles.grantedTo}>تشهد الأكاديمية بأن</p>
          <h1 style={styles.studentName}>{profile?.username || "طالب"}</h1>

          <p style={styles.body}>
            قد أتمّ بنجاح جميع متطلبات دفعة{" "}
            <strong style={{ color: "#141024" }}>{batch?.name || "—"}</strong> ضمن دورة{" "}
            <strong style={{ color: "#141024" }}>{course?.title || "—"}</strong>
          </p>

          <p style={styles.date}>{issuedDate}</p>

          <div style={styles.footer}>
            <span>كود التحقق: {cert.certificate_code}</span>
          </div>
        </div>
      </div>

      <PrintButton />
      <p style={{ ...styles.date, color: "#6E6690", fontSize: 12, marginTop: "0.75rem" }} className="no-print">
        شارك رابط هاي الصفحة مع أي جهة تبي تتحقق من صحة الشهادة.
      </p>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0E0A1A",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1rem",
    fontFamily: "'Inter', sans-serif",
    direction: "rtl",
  },
  notFound: { textAlign: "center" },
  card: {
    width: "100%",
    maxWidth: 720,
    background: "linear-gradient(135deg, #FFFFFF, #FFFFFF)",
    borderRadius: 0,
    padding: 10,
    boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
  },
  borderInner: {
    border: "2px solid #8A7CB8",
    borderRadius: 0,
    padding: "3rem 2rem",
    textAlign: "center",
  },
  brand: { color: "#8A7CB8", letterSpacing: 4, fontSize: 12, fontWeight: 700, margin: 0 },
  subBrand: { color: "#2A2145", fontSize: 22, fontWeight: 800, margin: "0.5rem 0 1.5rem" },
  icon: { fontSize: 40, marginBottom: "1rem" },
  grantedTo: { color: "#4A4368", fontSize: 14, margin: 0 },
  studentName: { color: "#141024", fontSize: 32, fontWeight: 800, margin: "0.5rem 0 1.25rem" },
  body: { color: "#4A4368", fontSize: 15, lineHeight: 1.9, maxWidth: 520, margin: "0 auto" },
  date: { color: "#8A7CB8", fontSize: 13, fontWeight: 700, marginTop: "1.5rem" },
  footer: { marginTop: "2rem", paddingTop: "1rem", borderTop: "1px dashed #8A7CB8", color: "#6E6690", fontSize: 12 },
};
