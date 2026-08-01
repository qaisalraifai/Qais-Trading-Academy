"use client";

import { Loader2, Wifi, WifiOff } from "lucide-react";

const MAP = {
  idle: { label: "جاري التحضير...", color: "text-text-muted", icon: Loader2, spin: true },
  connecting: { label: "جاري الاتصال...", color: "text-warning", icon: Loader2, spin: true },
  connected: { label: "متصل", color: "text-profit", icon: Wifi, spin: false },
  reconnecting: { label: "انقطع الاتصال — جاري إعادة المحاولة...", color: "text-warning", icon: Loader2, spin: true },
  disconnected: { label: "غير متصل", color: "text-loss", icon: WifiOff, spin: false },
  failed: { label: "تعذّر الاتصال", color: "text-loss", icon: WifiOff, spin: false },
};

export default function ConnectionBadge({ state }) {
  const cfg = MAP[state] || MAP.idle;
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center gap-1.5 text-xs font-semibold ${cfg.color}`}>
      <Icon size={14} className={cfg.spin ? "animate-spin" : ""} />
      <span>{cfg.label}</span>
    </div>
  );
}
