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

const gold = "#C9A24B";
const s = {
  page: {
    backgroundColor: "#050505",
    minHeight: "100vh",
    direction: "rtl",
    fontFamily: "'Inter', sans-serif",
    color: "#E8E0D0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
  },
  card: {
    backgroundColor: "#0d0d0d",
    border: "1px solid #1a1a1a",
    borderRadius: "8px",
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
  text: { color: "#9a9285", fontSize: "0.9rem", lineHeight: 1.8 },
};
