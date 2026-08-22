"use client";

import { X } from "lucide-react";

export default function DeviceSettingsModal({ devices, onSelectCamera, onSelectMic, onSelectSpeaker, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface-1 border border-line rounded-2xl w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-text-primary font-bold text-base">إعدادات الصوت والفيديو</h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">الكاميرا</label>
            <select
              onChange={(e) => onSelectCamera(e.target.value)}
              className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm text-text-primary"
            >
              {devices.cameras.length === 0 && <option>لا توجد كاميرات</option>}
              {devices.cameras.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || "كاميرا"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1.5">الميكروفون</label>
            <select
              onChange={(e) => onSelectMic(e.target.value)}
              className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm text-text-primary"
            >
              {devices.microphones.length === 0 && <option>لا توجد ميكروفونات</option>}
              {devices.microphones.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || "ميكروفون"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1.5">مكبر الصوت</label>
            <select
              onChange={(e) => onSelectSpeaker(e.target.value)}
              className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm text-text-primary"
            >
              {devices.speakers.length === 0 && <option>الافتراضي</option>}
              {devices.speakers.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || "مكبر صوت"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
