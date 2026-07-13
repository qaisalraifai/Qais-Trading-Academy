export const colors = {
  gold: "#D4AF37",
  goldLight: "#F2D57E",
  goldDark: "#9C7A22",
  ink: "#0B0B0B",
  panel: "#141414",
  panelHover: "#1E1E1E",
  border: "#2A2A2A",
  textPrimary: "#F5F5F5",
  textSecondary: "#9A9A9A",
  textMuted: "#6E6E6E",
  profit: "#00C853",
  loss: "#FF4D4F",
  warning: "#F59E0B",
  info: "#4FA8E0",
  discord: "#5865F2",
};

export const glass = {
  background: "linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))",
  backdropFilter: "blur(14px)",
  border: "1px solid rgba(42, 42, 42, 0.9)",
};

export const transition = "all 250ms cubic-bezier(0.2, 0.8, 0.2, 1)";

export const statusColors = {
  active: "#4CAF50",
  expiring: "#FF9800",
  expired: "#8B8B8B",
  vip: "#B26FE0",
  trial: "#4FA8E0",
  suspended: "#555555",
};

export function daysLeftColor(days) {
  if (days === null || days === undefined) return statusColors.expired;
  if (days <= 0) return statusColors.expired;
  if (days <= 7) return statusColors.expiring;
  return statusColors.active;
}
