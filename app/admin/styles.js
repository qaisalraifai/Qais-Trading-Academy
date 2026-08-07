// تصميم فخم مطابق لنظام Aureus: أسود+ذهبي، خطوط Sora/Inter/JetBrains Mono،
// زجاج (glass) بتشبع لوني، وظلال فخمة (luxe/gold). كل الألوان مركزية هون.
//
// ملاحظة مهمة: `gold` تبقى hex عادي (#C9A860) عن قصد — كذا كل مكان بالكود
// القديم بيعمل `${gold}55` أو `gold + "44"` (ألفا بصيغة hex) بضل شغال متل
// ما هو. التدرجات/الظلال الجديدة (OKLCH) منفصلة بتوكنز جديدة تحت.

export const gold = "#C9A860";
export const goldLight = "#E4CD95";
export const ink = "#080B14";
export const panel = "#080B14";
export const panelElevated = "#0C1220";

// نسخة OKLCH من نفس الذهب (نفس قيم Aureus بالضبط) — تُستخدم بس بالتدرجات
// والظلال الجديدة (كخلفيات/box-shadow كاملة)، مش بتركيبات ألفا-hex
export const goldOklch = "oklch(0.82 0.14 88)";
export const goldSoft = "oklch(0.88 0.09 90)";
export const goldDeep = "oklch(0.66 0.14 78)";

export const statusColors = {
  active: "#1FBF87",
  expiring: "#FF9800",
  expired: "#5D6880",
  vip: "#B26FE0",
  trial: "#5FA8E8",
  suspended: "#3E4761",
};

export const planColors = {
  owner: { bg: "#3a2a0044", fg: "#E0A44A", border: "#E0A44A55" },
  admin: { bg: "#2a1a3a44", fg: "#B26FE0", border: "#B26FE055" },
  vip: { bg: "#11172644", fg: "#5FA8E8", border: "#5FA8E855" },
  elite: { bg: "#3a2a0044", fg: gold, border: gold + "55" },
  member: { bg: "#111726", fg: "#93A0B8", border: "#26314A" },
  trial: { bg: "#111726", fg: "#5FA8E8", border: "#182033" },
};

// خلفية الصفحة: نفس التدرج الأساسي + شعاعين ذهبيين خافتين (Ambient glow) متل Aureus
export const noiseBg = `
  radial-gradient(ellipse 700px 500px at 5% -10%, oklch(0.82 0.14 88 / 0.07) 0%, transparent 60%),
  radial-gradient(ellipse 800px 600px at 105% 35%, oklch(0.66 0.14 78 / 0.06) 0%, transparent 65%),
  radial-gradient(ellipse at top, #14100600 0%, ${ink} 70%),
  url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E")
`;

// زجاج فخم: تشبع لوني (saturate) + حد ذهبي خفيف — مطابق لـ @utility glass بـ Aureus
export const glass = {
  background: "linear-gradient(145deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012))",
  backdropFilter: "blur(20px) saturate(140%)",
  WebkitBackdropFilter: "blur(20px) saturate(140%)",
  border: "1px solid rgba(201,162,75,0.14)",
  borderRadius: 0,
};

export const goldBorder = {
  border: "1px solid transparent",
  backgroundImage: `linear-gradient(${panel}, ${panel}), linear-gradient(135deg, ${gold}, transparent 60%, ${gold}55)`,
  backgroundOrigin: "border-box",
  backgroundClip: "padding-box, border-box",
};

// التدرجات والظلال الفخمة (مطابقة لـ --gradient-gold / --shadow-luxe / --shadow-gold بـ Aureus)
export const gradientGold = `linear-gradient(135deg, ${goldSoft} 0%, ${goldDeep} 100%)`;
export const gradientSurface = `linear-gradient(180deg, ${panelElevated} 0%, #080B14 100%)`;
export const shadowLuxe = "0 24px 60px -20px rgba(0,0,0,0.6), 0 2px 0 0 rgba(255,255,255,0.04) inset";
export const shadowGold = "0 8px 40px -12px oklch(0.82 0.14 88 / 0.35)";

export const transition = "all 250ms cubic-bezier(.2,.8,.2,1)";

// خطوط: Sora للعناوين (display)، Inter للنص العادي، JetBrains Mono للأرقام
export const displayStack = "'Sora', 'Inter', sans-serif";
export const fontStack = "'Inter', sans-serif";
export const monoStack = "'JetBrains Mono', ui-monospace, monospace";

export const s = {
  page: {
    backgroundColor: ink,
    backgroundImage: noiseBg,
    color: "#EDF1F8",
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
    borderBottom: "1px solid #111726",
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
  headerTitle: { fontSize: "1.4rem", fontWeight: 800, fontFamily: displayStack, letterSpacing: "-0.02em" },
  section: { margin: "2rem 3rem" },
  sectionTitle: {
    fontSize: "0.85rem",
    color: "#5D6880",
    marginBottom: "0.9rem",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontWeight: 600,
    letterSpacing: "0.5px",
    fontFamily: displayStack,
  },
  divider: { height: 1, background: "linear-gradient(90deg, transparent, #111726 15%, #111726 85%, transparent)", margin: "2.5rem 3rem" },
  card: {
    ...glass,
    boxShadow: shadowLuxe,
    borderRadius: 20,
  },
  btn: {
    background: "none",
    border: "1px solid #1B2438",
    color: "#93A0B8",
    padding: "0.55rem 1.1rem",
    borderRadius: 3,
    cursor: "pointer",
    fontSize: "0.85rem",
    transition,
    fontFamily: fontStack,
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
  },
  btnGold: {
    backgroundImage: gradientGold,
    color: "#111726",
    border: "none",
    fontWeight: 700,
    boxShadow: shadowGold,
  },
  btnDanger: { borderColor: "#1E2941", color: "#E8495F" },
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
