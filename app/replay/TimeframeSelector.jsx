"use client";
import React from "react";

/**
 * TimeframeSelector - صف أزرار فريمات مدمج بستايل شريط الأدوات الحالي
 * (بديل الـ<select> القديم بشكل أزرار TradingView).
 *
 * ملاحظة مهمة: لا يحتوي هذا المكوّن على قائمة فريمات ثابتة خاصة به عمداً -
 * بيستقبل `options` جاهزة من ReplayClient (نفس مصفوفة INTERVALS الحقيقية
 * + منطق تعطيل الفريمات البعيدة عن نقطة القص) حتى نضمن توافق 100% مع
 * البيانات الفعلية المتاحة، بدل ما نعرض فريمات (متل 30m أو 1w أو 1M) ما
 * عندها تحميل بيانات حقيقي بالمشروع.
 */

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#F2D57E";

export default function TimeframeSelector({ options, currentTimeframe, onTimeframeChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
      {options.map((o) => {
        const active = currentTimeframe === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => !o.disabled && onTimeframeChange(o.value)}
            disabled={o.disabled}
            title={o.title || o.label}
            style={{
              minWidth: 34,
              height: 26,
              padding: "0 6px",
              borderRadius: 4,
              border: `1px solid ${active ? GOLD : "transparent"}`,
              background: active ? `${GOLD}22` : "transparent",
              color: active ? GOLD_LIGHT : o.disabled ? "#4a4e58" : "#b2b5be",
              cursor: o.disabled ? "not-allowed" : "pointer",
              opacity: o.disabled ? 0.5 : 1,
              fontSize: 11.5,
              fontWeight: active ? 700 : 500,
              transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
              flexShrink: 0,
            }}
          >
            {o.shortLabel || o.label}
          </button>
        );
      })}
    </div>
  );
}
