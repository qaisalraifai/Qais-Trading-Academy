"use client";
import { gold, transition } from "../styles";

export const chipDefs = [
  ["vip", "VIP"],
  ["expired", "Expired"],
  ["trial", "Trial"],
  ["elite", "Elite"],
  ["pending", "⏳ Pending"],
  ["cancelled", "Cancelled"],
];

export default function FilterChips({ active, toggle }) {
  return (
    <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
      {chipDefs.map(([key, label]) => {
        const isActive = active.includes(key);
        return (
          <button
            key={key}
            onClick={() => toggle(key)}
            style={{
              background: isActive ? gold + "1c" : "transparent",
              border: `1px solid ${isActive ? gold + "88" : "#1E1836"}`,
              color: isActive ? gold : "#6E6690",
              padding: "0.4rem 0.9rem",
              borderRadius: 999,
              fontSize: "0.78rem",
              cursor: "pointer",
              transition,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
