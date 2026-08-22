"use client";

import { Megaphone, X } from "lucide-react";

export default function AnnouncementBanner({ announcement, onDismiss }) {
  if (!announcement) return null;
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 max-w-[92%] bg-gold-300 text-ink rounded-xl px-4 py-2.5 shadow-glow flex items-center gap-2 animate-fade-in">
      <Megaphone size={16} className="shrink-0" />
      <span className="text-sm font-bold">{announcement.message}</span>
      <button onClick={onDismiss} className="shrink-0 opacity-70 hover:opacity-100">
        <X size={15} />
      </button>
    </div>
  );
}
