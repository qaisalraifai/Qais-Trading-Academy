"use client";

import { X } from "lucide-react";

export default function SidePanel({ title, onClose, children }) {
  return (
    <div className="flex flex-col h-full bg-surface-1 border border-line rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-line shrink-0">
        <h3 className="text-sm font-bold text-text-primary">{title}</h3>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
