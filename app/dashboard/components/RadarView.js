"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ASSETS, getAssetByValue } from "@/lib/assets";

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#F2D57E";
const GREEN = "#02C076";
const RED = "#F6465D";

const cardStyle = {
  background: "linear-gradient(145deg, #22252B, #181A20)",
  border: `1px solid ${GOLD}26`,
  borderRadius: 18,
  boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
};

/* ألوان حالة الرادار — الفصل 9 من توثيق QAIS SK Engine + شرح الفكرة الأصلي */
const STATUS_META = {
  gray: { color: "#6b7280", label: "لا توجد فرصة", dot: "⚪" },
  yellow: { color: "#eab308", label: "يقترب من منطقة اهتمام", dot: "🟡" },
  orange: { color: "#f97316", label: "بدأ يتكون Setup", dot: "🟠" },
  green: { color: GREEN, label: "فرصة جاهزة", dot: "🟢" },
  red: { color: RED, label: "انتهت الفرصة", dot: "🔴" },
};

function statusMeta(status) {
  return STATUS_META[status] || STATUS_META.gray;
}

function assetLabel(symbol) {
  return getAssetByValue(symbol)?.label || symbol;
}

export default function RadarView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [manageOpen, setManageOpen] = useState(false);
  const pollRef = useRef(null);

  async function loadRadar() {
    try {
      const res = await fetch("/api/radar");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setItems(data.items || []);
      setError("");
    } catch (e) {
      setError(e.message || "تعذّر تحميل الرادار");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRadar();
    // بولينغ خفيف من قاعدة بياناتنا (مش من يوهو مباشرة) — التحديث الفعلي بصير بالكرون
    // بالخلفية كل 15 دقيقة، فمنكفي نحدّث الواجهة كل دقيقة عشان تلحق أي تغيير محفوظ
    pollRef.current = setInterval(loadRadar, 60_000);
    return () => clearInterval(pollRef.current);
  }, []);

  const opportunities = useMemo(
    () =>
      [...items]
        .filter((i) => i.status !== "gray")
        .sort((a, b) => {
          const order = { green: 0, orange: 1, yellow: 2, red: 3 };
          return (order[a.status] ?? 9) - (order[b.status] ?? 9) || b.score - a.score;
        }),
    [items]
  );

  async function toggleWatch(symbol, add) {
    await fetch("/api/radar/watchlist", {
      method: add ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
    });
    loadRadar();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: "#f0f0f0" }}>📡 Trading Radar</h2>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
            صورة لحظية عن مكان الفرص — بدل ما تفتح عشرات الشارتات
          </div>
        </div>
        <button
          onClick={() => setManageOpen(true)}
          style={{
            background: "transparent",
            border: `1px solid ${GOLD}55`,
            color: GOLD_LIGHT,
            borderRadius: 10,
            padding: "8px 14px",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          ⚙ إدارة الأصول المتابَعة
        </button>
      </div>

      {error && (
        <div style={{ ...cardStyle, padding: "0.8rem 1rem", color: RED, fontSize: 13 }}>{error}</div>
      )}

      {/* -------- شريط Live Opportunities -------- */}
      {opportunities.length > 0 && (
        <div style={{ ...cardStyle, padding: "0.8rem 1rem" }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Live Opportunities</div>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {opportunities.map((it) => {
              const meta = statusMeta(it.status);
              return (
                <button
                  key={it.symbol}
                  onClick={() => setSelected(it)}
                  style={{
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#181A20",
                    border: `1px solid ${meta.color}55`,
                    borderRadius: 10,
                    padding: "6px 12px",
                    color: "#f0f0f0",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <span>{meta.dot}</span>
                  <span>{assetLabel(it.symbol)}</span>
                  {it.status === "green" && <span style={{ color: GREEN }}>({it.score}%)</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* -------- دائرة الرادار -------- */}
      <div style={{ ...cardStyle, padding: "1.5rem", display: "flex", justifyContent: "center" }}>
        {loading ? (
          <div style={{ color: "#888", padding: "3rem 0" }}>جاري تحميل الرادار...</div>
        ) : items.length === 0 ? (
          <div style={{ color: "#888", padding: "3rem 0", textAlign: "center" }}>
            ما في أصول متابَعة بعد — اضغطي ⚙ إدارة الأصول لإضافة أصول لرادارك
          </div>
        ) : (
          <RadarCircle items={items} onSelect={setSelected} />
        )}
      </div>

      {selected && <DetailPanel item={selected} onClose={() => setSelected(null)} />}
      {manageOpen && (
        <ManageWatchlist
          watched={items.map((i) => i.symbol)}
          onToggle={toggleWatch}
          onClose={() => {
            setManageOpen(false);
            loadRadar();
          }}
        />
      )}
    </div>
  );
}

/* دوائر الأصول موزّعة حول مركز "Market Radar" — نفس الفكرة المرسومة بالتوضيح الأصلي */
function RadarCircle({ items, onSelect }) {
  const size = 340;
  const radius = 130;
  const center = size / 2;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {/* حلقات خلفية للتوضيح البصري */}
      {[1, 0.66, 0.33].map((f) => (
        <div
          key={f}
          style={{
            position: "absolute",
            top: center - radius * f,
            left: center - radius * f,
            width: radius * 2 * f,
            height: radius * 2 * f,
            borderRadius: "50%",
            border: `1px solid ${GOLD}22`,
          }}
        />
      ))}

      {/* المركز */}
      <div
        style={{
          position: "absolute",
          top: center - 34,
          left: center - 34,
          width: 68,
          height: 68,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          color: "#181A20",
          textAlign: "center",
          boxShadow: `0 0 30px ${GOLD}55`,
        }}
      >
        Market
        <br />
        Radar
      </div>

      {items.map((it, i) => {
        const angle = (2 * Math.PI * i) / items.length - Math.PI / 2;
        const x = center + radius * Math.cos(angle) - 30;
        const y = center + radius * Math.sin(angle) - 24;
        const meta = statusMeta(it.status);
        return (
          <button
            key={it.symbol}
            onClick={() => onSelect(it)}
            title={assetLabel(it.symbol)}
            style={{
              position: "absolute",
              top: y,
              left: x,
              width: 60,
              height: 48,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "#181A20",
              border: `1.5px solid ${meta.color}`,
              borderRadius: 12,
              cursor: "pointer",
              boxShadow: it.status === "green" ? `0 0 14px ${GREEN}88` : "none",
              gap: 2,
            }}
          >
            <span style={{ fontSize: 14 }}>{meta.dot}</span>
            <span style={{ fontSize: 9, color: "#ddd", whiteSpace: "nowrap" }}>{it.symbol}</span>
          </button>
        );
      })}
    </div>
  );
}

function DetailPanel({ item, onClose }) {
  const meta = statusMeta(item.status);
  const decision = item.decision || {};
  const reasonTags = item.reason_tags || decision.reasonTags || [];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "1rem",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ ...cardStyle, padding: "1.4rem", width: 380, maxWidth: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#f0f0f0" }}>
            {meta.dot} {assetLabel(item.symbol)}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", fontSize: 18, cursor: "pointer" }}>
            ✕
          </button>
        </div>

        <div style={{ marginTop: 6, fontSize: 13, color: meta.color, fontWeight: 600 }}>{meta.label}</div>

        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Stat label="السعر الحالي" value={item.price ? Number(item.price).toLocaleString("en-US") : "—"} />
          <Stat label="الفريم" value={item.timeframe || "M15"} />
          <Stat label="نوع الفرصة" value={item.direction === "up" ? "Buy" : item.direction === "down" ? "Sell" : "—"} />
          <Stat label="جودة الإشارة" value={item.score != null ? `${item.score}%` : "—"} color={item.score >= 85 ? GREEN : undefined} />
        </div>

        {reasonTags.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>سبب الإشارة</div>
            <div style={{ fontSize: 14, color: "#f0f0f0" }}>{reasonTags.join(" + ")}</div>
          </div>
        )}

        {decision.reasonsChecklist && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>تسلسل الفحص</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {decision.reasonsChecklist.map((c) => (
                <div key={c.key} style={{ fontSize: 12.5, color: c.ok ? "#ddd" : "#777", display: "flex", gap: 6 }}>
                  <span>{c.ok ? "✅" : "❌"}</span>
                  <span>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {item.updated_at && (
          <div style={{ marginTop: 10, fontSize: 11, color: "#666" }}>
            آخر تحديث: {new Date(item.updated_at).toLocaleTimeString("ar-EG")}
          </div>
        )}

        <a
          href={`/dashboard?tab=replay&asset=${encodeURIComponent(item.symbol)}`}
          style={{
            marginTop: 16,
            display: "block",
            textAlign: "center",
            background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`,
            color: "#181A20",
            fontWeight: 700,
            borderRadius: 10,
            padding: "10px 0",
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          فتح الشارت
        </a>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: "#181A20", borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ fontSize: 11, color: "#888" }}>{label}</div>
      <div style={{ fontSize: 14, color: color || "#f0f0f0", fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function ManageWatchlist({ watched, onToggle, onClose }) {
  const watchedSet = new Set(watched);
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "1rem",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ ...cardStyle, padding: "1.4rem", width: 420, maxWidth: "100%", maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f0" }}>الأصول المتابَعة على رادارك</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", fontSize: 18, cursor: "pointer" }}>
            ✕
          </button>
        </div>
        {ASSETS.map((group) => (
          <div key={group.group} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>{group.group}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {group.items
                .filter((i) => i.yahoo)
                .map((asset) => {
                  const on = watchedSet.has(asset.v);
                  return (
                    <button
                      key={asset.v}
                      onClick={() => onToggle(asset.v, !on)}
                      style={{
                        background: on ? `${GOLD}22` : "#181A20",
                        border: `1px solid ${on ? GOLD : "#333"}`,
                        color: on ? GOLD_LIGHT : "#aaa",
                        borderRadius: 8,
                        padding: "6px 10px",
                        fontSize: 12.5,
                        cursor: "pointer",
                      }}
                    >
                      {on ? "✓ " : "+ "}
                      {asset.label}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
