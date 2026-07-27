"use client";
import React from "react";

/**
 * ChartInfoPanel - لوحة معلومات الشارت
 * تعرض:
 * - السعر الحالي
 * - التغير اليومي
 * - الأعلى والأدنى
 * - المؤشرات الأخرى
 */

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#F2D57E";
const GREEN = "#02C076";
const RED = "#F6465D";

export default function ChartInfoPanel({
  symbol,
  currentPrice,
  priceChange,
  priceChangePercent,
  high,
  low,
  open,
  volume,
  timeframe,
}) {
  const containerStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: "12px",
    background: "rgba(13, 17, 23, 0.95)",
    border: "1px solid #2A2E39",
    borderRadius: 8,
    backdropFilter: "blur(10px)",
    minWidth: 250,
  };

  const headerStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #2A2E39",
    paddingBottom: 8,
  };

  const symbolStyle = {
    fontSize: 16,
    fontWeight: 700,
    color: GOLD_LIGHT,
  };

  const timeframeStyle = {
    fontSize: 11,
    color: "#999",
    background: `${GOLD}11`,
    padding: "4px 8px",
    borderRadius: 4,
    border: `1px solid ${GOLD}22`,
  };

  const priceContainerStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  };

  const priceStyle = {
    fontSize: 24,
    fontWeight: 700,
    color: "#EAECEF",
    fontFamily: "monospace",
  };

  const changeStyle = {
    fontSize: 13,
    color: priceChange >= 0 ? GREEN : RED,
    fontWeight: 600,
  };

  const statsGridStyle = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  };

  const statItemStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: "8px",
    background: "rgba(20, 20, 20, 0.5)",
    borderRadius: 4,
    border: "1px solid #2A2E39",
  };

  const statLabelStyle = {
    fontSize: 11,
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  };

  const statValueStyle = {
    fontSize: 13,
    fontWeight: 700,
    color: "#EAECEF",
    fontFamily: "monospace",
  };

  const formatNumber = (num) => {
    if (num == null) return "—";
    if (num >= 1000000) return (num / 1000000).toFixed(2) + "M";
    if (num >= 1000) return (num / 1000).toFixed(2) + "K";
    return num.toFixed(2);
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={symbolStyle}>{symbol}</span>
        <span style={timeframeStyle}>{timeframe}</span>
      </div>

      <div style={priceContainerStyle}>
        <div style={priceStyle}>
          {currentPrice != null ? formatNumber(currentPrice) : "—"}
        </div>
        {priceChange != null && (
          <div style={changeStyle}>
            {priceChange >= 0 ? "▲" : "▼"} {Math.abs(priceChange).toFixed(2)} (
            {priceChangePercent >= 0 ? "+" : ""}
            {priceChangePercent?.toFixed(2)}%)
          </div>
        )}
      </div>

      <div style={statsGridStyle}>
        <div style={statItemStyle}>
          <div style={statLabelStyle}>الأعلى</div>
          <div style={statValueStyle}>{high != null ? formatNumber(high) : "—"}</div>
        </div>

        <div style={statItemStyle}>
          <div style={statLabelStyle}>الأدنى</div>
          <div style={statValueStyle}>{low != null ? formatNumber(low) : "—"}</div>
        </div>

        <div style={statItemStyle}>
          <div style={statLabelStyle}>الفتح</div>
          <div style={statValueStyle}>{open != null ? formatNumber(open) : "—"}</div>
        </div>

        <div style={statItemStyle}>
          <div style={statLabelStyle}>الحجم</div>
          <div style={statValueStyle}>{volume != null ? formatNumber(volume) : "—"}</div>
        </div>
      </div>

      {/* ملاحظة مرجعية */}
      <div
        style={{
          fontSize: 10,
          color: "#666",
          padding: "8px",
          background: "rgba(255, 255, 255, 0.02)",
          borderRadius: 4,
          borderLeft: `2px solid ${GOLD}`,
        }}
      >
        ℹ️ البيانات محدثة في الوقت الفعلي
      </div>
    </div>
  );
}
