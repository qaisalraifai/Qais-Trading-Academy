export default function EmailConfirmedPage() {
  return (
    <div style={s.page}>
      <div style={s.card}>
        <img src="/logo.jpg" alt="QTA" style={s.logo} />
        <h1 style={s.title}>تم التأكيد ✓</h1>
        <p style={s.text}>رجّع لصفحة التسجيل على جهازك الأول، رح تكمّل لحالها.</p>
      </div>
    </div>
  );
}

const gold = "#C9A860";
const s = {
  page: {
    backgroundColor: "#080B14",
    minHeight: "100vh",
    direction: "rtl",
    fontFamily: "'Inter', sans-serif",
    color: "#EDF1F8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
  },
  card: {
    backgroundColor: "#0C1220",
    border: "1px solid #1E2941",
    borderRadius: "3px",
    padding: "3rem 2.5rem",
    maxWidth: "380px",
    textAlign: "center",
  },
  logo: {
    width: "80px",
    height: "80px",
    objectFit: "cover",
    borderRadius: "50%",
    border: `2px solid ${gold}`,
    boxShadow: `0 0 30px ${gold}44`,
    margin: "0 auto 1.5rem",
    display: "block",
  },
  title: { fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.75rem", color: gold },
  text: { color: "#5D6880", fontSize: "0.9rem", lineHeight: 1.8 },
};
