export const colors = {
  gold: "#C9A24B",
  goldLight: "#E8C468",
  goldDark: "#A07A2E",
  ink: "#050505",
  panel: "#0D0D0A",
  textPrimary: "#F0EBE0",
  textSecondary: "#9A9590",
  textMuted: "#6B6560",
  profit: "#10B981",
  loss: "#EF4444",
  warning: "#F59E0B",
  info: "#4FA8E0",
  discord: "#5865F2",
};

export const glass = {
  background: "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
  backdropFilter: "blur(14px)",
  border: "1px solid rgba(201, 162, 75, 0.16)",
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
