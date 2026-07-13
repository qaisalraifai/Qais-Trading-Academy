export const colors = {
  gold: "#D4AF37",
  goldLight: "#F2D57E",
  goldDark: "#9C7A22",
  ink: "#000000",
  panel: "#0A0A0A",
  textPrimary: "#FFFFFF",
  textSecondary: "#B8B8B8",
  textMuted: "#7A7A7A",
  profit: "#10B981",
  loss: "#EF4444",
  warning: "#F59E0B",
  info: "#4FA8E0",
  discord: "#5865F2",
};

export const glass = {
  background: "linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))",
  backdropFilter: "blur(14px)",
  border: "1px solid rgba(212, 175, 55, 0.2)",
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
