export default function EmailConfirmedPage() {
  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.check}>✓</div>
        <h1 style={s.title}>تم تأكيد إيميلك بنجاح</h1>
        <p style={s.text}>
          ممتاز! حسابك صار مفعّل. إذا كنت فتحت هالرابط من جهاز غير يلي
          سجّلت فيه (متل التلفون)، ما عليك شي هون — رجّع لنفس الجهاز/المتصفح
          يلي أنشأت فيه الحساب، وهو رح يكمّل تلقائياً لصفحة الدفع خلال ثوان.
        </p>
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
    maxWidth: "460px",
    textAlign: "center",
  },
  check: {
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    border: `2px solid ${gold}`,
    color: gold,
    fontSize: "1.8rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 1.5rem",
  },
  title: { fontSize: "1.4rem", fontWeight: 800, marginBottom: "1rem" },
  text: { color: "#9a9285", fontSize: "0.95rem", lineHeight: 1.9 },
};
