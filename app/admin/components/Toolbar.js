"use client";
import { useState } from "react";
import { gold, glass, transition, s } from "../styles";

const periods = [
  ["all", "الكل"],
  ["today", "اليوم"],
  ["week", "هذا الأسبوع"],
  ["month", "هذا الشهر"],
];

const statusOptions = [
  ["active", "نشط"],
  ["inactive", "منتهي"],
  ["vip", "VIP"],
];

const sortOptions = [
  ["newest", "الأحدث"],
  ["oldest", "الأقدم"],
  ["highest_paid", "الأعلى دفعاً"],
];

const fieldStyle = {
  background: "#0d0d0d",
  border: "1px solid #242424",
  color: "#F5F5F5",
  padding: "0.6rem 0.9rem",
  borderRadius: 10,
  fontSize: "0.85rem",
  outline: "none",
  transition,
};

export default function Toolbar({ search, setSearch, period, setPeriod, statuses, toggleStatus, sort, setSort, onExport }) {
  const [focused, setFocused] = useState(false);

  return (
    <div
      style={{
        ...glass,
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "0.9rem",
        padding: "0.9rem 1.2rem",
      }}
    >
      <input
        placeholder="🔍 بحث بالاسم أو الإيميل..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...fieldStyle,
          flex: "1 1 220px",
          minWidth: 200,
          borderColor: focused ? gold + "77" : "#242424",
        }}
      />

      <Divider />

      <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "#888" }}>
        📅
        <select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ ...fieldStyle, cursor: "pointer" }}>
          {periods.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </label>

      <Divider />

      <div style={{ display: "flex", gap: "0.9rem", alignItems: "center" }}>
        {statusOptions.map(([v, l]) => (
          <label key={v} style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.82rem", color: "#999", cursor: "pointer" }}>
            <input type="checkbox" checked={statuses.includes(v)} onChange={() => toggleStatus(v)} style={{ accentColor: gold }} />
            {l}
          </label>
        ))}
      </div>

      <Divider />

      <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "#888" }}>
        ترتيب
        <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ ...fieldStyle, cursor: "pointer" }}>
          {sortOptions.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </label>

      <Divider />

      <button onClick={onExport} style={{ ...s.btn, marginRight: "auto" }}>
        📤 Export Excel
      </button>
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 22, background: "#1c1c1c" }} />;
}
