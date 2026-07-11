// تصميم فخم: زجاجي خفيف + حدود ذهبية متدرجة + Glow عند الـ Hover
// كل الألوان/الأبعاد مركزية هون حتى الواجهة تضل متناسقة بكل مكان

export const gold = "#C9A24B";
export const goldLight = "#E4C97A";
export const ink = "#050505";
export const panel = "#0b0b0a";

export const statusColors = {
  active: "#4CAF50",
  expiring: "#FF9800",
  expired: "#8b8b8b",
  vip: "#B26FE0",
  trial: "#4FA8E0",
  suspended: "#555555",
};

export const planColors = {
  owner: { bg: "#3a2a0044", fg: "#F3C339", border: "#F3C33955" },
  admin: { bg: "#2a1a3a44", fg: "#B26FE0", border: "#B26FE055" },
  vip: { bg: "#1a2a3a44", fg: "#4FA8E0", border: "#4FA8E055" },
  elite: { bg: "#3a2a0044", fg: gold, border: gold + "55" },
  member: { bg: "#1c1c1c", fg: "#9a9a9a", border: "#2a2a2a" },
  trial: { bg: "#12242f", fg: "#4FA8E0", border: "#1c3d4f" },
};

export const noiseBg = `radial-gradient(ellipse at top, #14100600 0%, ${ink} 70%),
  url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E")`;

export const glass = {
  background: "linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
  backdropFilter: "blur(14px)",
  border: "1px solid rgba(201,162,75,0.16)",
  borderRadius: 18,
};

export const goldBorder = {
  border: "1px solid transparent",
  backgroundImage: `linear-gradient(${panel}, ${panel}), linear-gradient(135deg, ${gold}, transparent 60%, ${gold}55)`,
  backgroundOrigin: "border-box",
  backgroundClip: "padding-box, border-box",
};

export const transition = "all 250ms cubic-bezier(.2,.8,.2,1)";

export const fontStack = "'Inter', sans-serif";
export const monoStack = "'JetBrains Mono', monospace";

export const s = {
  page: {
    backgroundColor: ink,
    backgroundImage: noiseBg,
    color: "#E8E0D0",
    direction: "rtl",
    fontFamily: fontStack,
    minHeight: "100vh",
    padding: "0 0 4rem",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "2rem 3rem",
    borderBottom: "1px solid #141414",
    flexWrap: "wrap",
    gap: "1rem",
  },
  headerSub: {
    fontFamily: monoStack,
    color: gold,
    fontSize: "0.75rem",
    letterSpacing: "2px",
    marginBottom: "0.25rem",
  },
  headerTitle: { fontSize: "1.4rem", fontWeight: 800 },
  section: { margin: "2rem 3rem" },
  sectionTitle: {
    fontSize: "0.85rem",
    color: "#666",
    marginBottom: "0.9rem",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontWeight: 600,
    letterSpacing: "0.5px",
  },
  divider: { height: 1, background: "linear-gradient(90deg, transparent, #1c1c1c 15%, #1c1c1c 85%, transparent)", margin: "2.5rem 3rem" },
  btn: {
    background: "none",
    border: "1px solid #222",
    color: "#999",
    padding: "0.55rem 1.1rem",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: "0.85rem",
    transition,
    fontFamily: fontStack,
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
  },
  btnGold: {
    background: `linear-gradient(135deg, ${gold}, #a07a2e)`,
    color: "#000",
    border: "none",
    fontWeight: 700,
  },
  btnDanger: { borderColor: "#4a2a2a", color: "#ef5350" },
};

export function daysLeftColor(days) {
  if (days === null || days === undefined) return statusColors.expired;
  if (days <= 0) return statusColors.expired;
  if (days <= 7) return statusColors.expiring;
  return statusColors.active;
}

export function timeAgo(dateStr) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `قبل ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `قبل ${days} يوم`;
  const months = Math.floor(days / 30);
  return `قبل ${months} شهر`;
}
