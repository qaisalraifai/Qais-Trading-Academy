import Link from "next/link";

export default function HomePage() {
  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logoBlock}>
          <span style={styles.logoIcon}>📈</span>
          <span style={styles.logoText}>QTA</span>
        </div>
        <nav style={styles.navLinks}>
          <Link href="/login" style={styles.navLink}>تسجيل الدخول</Link>
          <Link href="/payment" style={styles.navCta}>اشترك الآن</Link>
        </nav>
      </header>

      {/* Hero */}
      <section style={styles.hero}>
        <p style={styles.heroTag}>أكاديمية تداول متكاملة</p>
        <h1 style={styles.heroTitle}>Qais Trading Academy</h1>
        <p style={styles.heroSubtitle}>
          رحلة تعليمية شاملة في عالم التداول — من الأساسيات حتى الاحترافية،
          بمحاضرات لايف ومسجلة، وتدريب عملي مستمر على حساب ديمو لمدة 6 أشهر.
        </p>
        <Link href="/payment" style={styles.heroBtn}>
          ابدأ رحلتك الآن ←
        </Link>
      </section>

      {/* Curriculum */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>المنهج التعليمي</h2>
        <p style={styles.sectionSubtitle}>كل ما تحتاجه لتصبح متداول محترف</p>

        <div style={styles.grid}>
          {[
            { icon: "📊", title: "أساسيات التداول", desc: "بناء أساس متين يشمل فهم الأسواق، أنواع الأدوات المالية، وإدارة رأس المال." },
            { icon: "📰", title: "التحليل الأساسي", desc: "قراءة الأخبار الاقتصادية والمؤشرات وتأثيرها على حركة السوق." },
            { icon: "🎯", title: "ICT", desc: "مفاهيم Inner Circle Trader لفهم سلوك السيولة والمؤسسات الكبرى." },
            { icon: "🧠", title: "SMC / SK", desc: "تحليل Smart Money Concepts لتتبع تحركات اللاعبين الكبار بدقة." },
            { icon: "🕒", title: "تدريب 6 أشهر ديمو", desc: "تطبيق عملي مستمر على حساب تجريبي لصقل المهارة قبل التداول الحقيقي." },
            { icon: "🔁", title: "Backtest مستمر", desc: "اختبار الاستراتيجيات على بيانات تاريخية لقياس الأداء وتطويره." },
          ].map((item, i) => (
            <div key={i} style={styles.card}>
              <div style={styles.cardIcon}>{item.icon}</div>
              <h3 style={styles.cardTitle}>{item.title}</h3>
              <p style={styles.cardDesc}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Lectures */}
      <section style={{ ...styles.section, backgroundColor: "#0d0d0d" }}>
        <h2 style={styles.sectionTitle}>محاضرات لايف ومسجلة</h2>
        <p style={styles.sectionSubtitle}>
          محتوى منظم بشكل تسلسلي، يصلك مباشرة عبر مجتمع Discord الخاص بالأكاديمية —
          محاضرات حية تفاعلية بالإضافة لمكتبة كاملة من المحاضرات المسجلة.
        </p>
        <div style={styles.featureRow}>
          <div style={styles.featureItem}>
            <span style={styles.featureCheck}>◆</span> محاضرات لايف أسبوعية
          </div>
          <div style={styles.featureItem}>
            <span style={styles.featureCheck}>◆</span> مكتبة محاضرات مسجلة منظمة
          </div>
          <div style={styles.featureItem}>
            <span style={styles.featureCheck}>◆</span> اختبارات لقياس التقدم
          </div>
          <div style={styles.featureItem}>
            <span style={styles.featureCheck}>◆</span> دعم مباشر من المدرب
          </div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section style={styles.pricingSection}>
        <h2 style={styles.sectionTitle}>جاهز تبدأ؟</h2>
        <p style={styles.sectionSubtitle}>انضم الآن وابدأ رحلتك في عالم التداول الاحترافي</p>
        <Link href="/payment" style={styles.heroBtn}>
          عرض خطط الاشتراك ←
        </Link>
      </section>

      <footer style={styles.footer}>
        © {new Date().getFullYear()} Qais Trading Academy. جميع الحقوق محفوظة.
      </footer>
    </div>
  );
}

const gold = "#D4AF37";

const styles = {
  page: {
    backgroundColor: "#0a0a0a",
    color: "#fff",
    direction: "rtl",
    fontFamily: "'Georgia', serif",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1.5rem 3rem",
    borderBottom: "1px solid #1a1a1a",
  },
  logoBlock: { display: "flex", alignItems: "center", gap: "0.5rem" },
  logoIcon: { fontSize: "1.5rem" },
  logoText: { fontSize: "1.3rem", fontWeight: "bold", color: gold, letterSpacing: "3px" },
  navLinks: { display: "flex", alignItems: "center", gap: "1.5rem" },
  navLink: { color: "#aaa", textDecoration: "none", fontSize: "0.95rem" },
  navCta: {
    backgroundColor: gold,
    color: "#000",
    padding: "0.6rem 1.4rem",
    borderRadius: "2px",
    textDecoration: "none",
    fontWeight: "bold",
    fontSize: "0.9rem",
  },
  hero: {
    textAlign: "center",
    padding: "5rem 2rem 4rem",
    maxWidth: "800px",
    margin: "0 auto",
  },
  heroTag: { color: gold, letterSpacing: "3px", fontSize: "0.85rem", marginBottom: "1rem" },
  heroTitle: { fontSize: "3rem", fontWeight: "bold", marginBottom: "1.5rem" },
  heroSubtitle: { color: "#999", fontSize: "1.1rem", lineHeight: 1.8, marginBottom: "2.5rem" },
  heroBtn: {
    display: "inline-block",
    backgroundColor: gold,
    color: "#000",
    padding: "1rem 2.5rem",
    borderRadius: "2px",
    textDecoration: "none",
    fontWeight: "bold",
    fontSize: "1.05rem",
    letterSpacing: "1px",
  },
  section: {
    padding: "4rem 2rem",
    textAlign: "center",
    maxWidth: "1100px",
    margin: "0 auto",
  },
  sectionTitle: { fontSize: "2rem", fontWeight: "bold", marginBottom: "0.75rem" },
  sectionSubtitle: { color: "#888", fontSize: "1rem", marginBottom: "3rem", maxWidth: "600px", marginLeft: "auto", marginRight: "auto", lineHeight: 1.7 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "1.5rem",
    textAlign: "right",
  },
  card: {
    backgroundColor: "#111",
    border: "1px solid #222",
    borderRadius: "4px",
    padding: "2rem",
  },
  cardIcon: { fontSize: "2rem", marginBottom: "1rem" },
  cardTitle: { fontSize: "1.15rem", fontWeight: "bold", color: gold, marginBottom: "0.6rem" },
  cardDesc: { color: "#888", fontSize: "0.9rem", lineHeight: 1.6 },
  featureRow: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "1.5rem 2.5rem",
    marginTop: "1rem",
  },
  featureItem: { color: "#ccc", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.5rem" },
  featureCheck: { color: gold, fontSize: "0.7rem" },
  pricingSection: {
    padding: "4rem 2rem 5rem",
    textAlign: "center",
  },
  footer: {
    textAlign: "center",
    padding: "2rem",
    color: "#444",
    fontSize: "0.85rem",
    borderTop: "1px solid #1a1a1a",
  },
};
