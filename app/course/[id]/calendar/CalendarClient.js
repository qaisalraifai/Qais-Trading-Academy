"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const WEEKDAYS = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const TYPE_META = {
  start: { icon: "🚀", color: "#3DBB6E", label: "بداية الدفعة" },
  end: { icon: "🏁", color: "#E5484D", label: "نهاية الدفعة" },
  live: { icon: "🔴", color: "#E8B86D", label: "بث مباشر" },
  assignment: { icon: "📝", color: "#42A5F5", label: "تسليم واجب" },
};

function dateKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
}

export default function CalendarClient({ course, batch, events }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(null);

  const eventsByDay = useMemo(() => {
    const map = {};
    events.forEach((e) => {
      if (!e.date) return;
      const key = dateKey(e.date);
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [events]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return events
      .filter((e) => e.date && new Date(e.date) >= new Date(now.toDateString()))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 8);
  }, [events]);

  const grid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay(); // 0 = أحد
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [cursor]);

  function goMonth(delta) {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
    setSelectedDay(null);
  }

  function formatDate(d) {
    return new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  }

  const selectedEvents = selectedDay ? eventsByDay[dateKey(selectedDay)] || [] : null;

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={s.header}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ fontSize: 32 }}>{course.icon}</div>
            <div>
              <p style={s.headerSub}>QAIS TRADING ACADEMY</p>
              <h1 style={s.headerTitle}>📅 تقويم {batch?.name ? `دفعة ${batch.name}` : "الدفعة"}</h1>
            </div>
          </div>
          <Link href={`/course/${course.id}`} style={s.backLink}>← رجوع للدورة</Link>
        </div>

        {events.length === 0 ? (
          <div style={s.empty}>ما في مواعيد مسجّلة لدفعتك لسا.</div>
        ) : (
          <div style={s.layout}>
            <div style={s.calendarBox}>
              <div style={s.monthNav}>
                <button onClick={() => goMonth(-1)} style={s.navBtn}>‹</button>
                <span style={s.monthLabel}>{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</span>
                <button onClick={() => goMonth(1)} style={s.navBtn}>›</button>
              </div>

              <div style={s.weekRow}>
                {WEEKDAYS.map((w) => (
                  <div key={w} style={s.weekday}>{w}</div>
                ))}
              </div>

              <div style={s.daysGrid}>
                {grid.map((d, i) => {
                  if (!d) return <div key={i} style={s.dayCellEmpty} />;
                  const key = dateKey(d);
                  const dayEvents = eventsByDay[key] || [];
                  const isToday = dateKey(today) === key;
                  const isSelected = selectedDay && dateKey(selectedDay) === key;
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDay(dayEvents.length ? d : null)}
                      style={{
                        ...s.dayCell,
                        ...(isToday ? s.dayCellToday : {}),
                        ...(isSelected ? s.dayCellSelected : {}),
                        cursor: dayEvents.length ? "pointer" : "default",
                      }}
                    >
                      <span>{d.getDate()}</span>
                      {dayEvents.length > 0 && (
                        <div style={s.dotsRow}>
                          {dayEvents.slice(0, 3).map((e, idx) => (
                            <span key={idx} style={{ ...s.dot, background: TYPE_META[e.type]?.color || "#E8B86D" }} />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedEvents && selectedEvents.length > 0 && (
                <div style={s.dayDetail}>
                  <p style={s.dayDetailTitle}>{formatDate(selectedDay)}</p>
                  {selectedEvents.map((e, idx) => (
                    <div key={idx} style={s.eventRow}>
                      <span>{TYPE_META[e.type]?.icon} {e.title}</span>
                      {e.isActive && <span style={s.liveNow}>مباشر الآن</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={s.upcomingBox}>
              <p style={s.upcomingTitle}>المواعيد القادمة</p>
              {upcoming.length === 0 ? (
                <p style={{ color: "#666", fontSize: 13 }}>ما في مواعيد قادمة حاليًا.</p>
              ) : (
                upcoming.map((e, idx) => (
                  <div key={idx} style={s.upcomingRow}>
                    <span style={{ fontSize: 18 }}>{TYPE_META[e.type]?.icon}</span>
                    <div>
                      <div style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>{e.title}</div>
                      <div style={{ color: "#888", fontSize: 11.5 }}>{formatDate(e.date)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(ellipse at top, #1A1408 0%, #0D0E10 60%)",
    color: "#fff",
    fontFamily: "'Inter', sans-serif",
    direction: "rtl",
    padding: "2rem",
  },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" },
  headerSub: { color: "#E8B86D", fontSize: 11, letterSpacing: 2, margin: 0 },
  headerTitle: { margin: 0, fontSize: 20, fontWeight: 800 },
  backLink: { color: "#555", fontSize: 13, textDecoration: "none" },
  empty: { color: "#777", background: "#111108", border: "1px solid #E8B86D33", borderRadius: 12, padding: "2rem", textAlign: "center" },
  layout: { display: "flex", gap: "1.25rem", flexWrap: "wrap", alignItems: "flex-start" },
  calendarBox: { flex: "1 1 480px", background: "#111108", border: "1px solid #E8B86D33", borderRadius: 14, padding: "1.25rem" },
  monthNav: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" },
  navBtn: { background: "#1a1a0a", color: "#E8B86D", border: "1px solid #E8B86D44", borderRadius: 8, width: 32, height: 32, fontSize: 18, cursor: "pointer" },
  monthLabel: { fontWeight: 800, fontSize: 15 },
  weekRow: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: "0.4rem" },
  weekday: { textAlign: "center", color: "#888", fontSize: 11.5, fontWeight: 700 },
  daysGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 },
  dayCellEmpty: { height: 46 },
  dayCell: {
    height: 46, borderRadius: 8, background: "#0D0E10", border: "1px solid transparent",
    color: "#ccc", fontSize: 12.5, display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", gap: 3, fontFamily: "inherit",
  },
  dayCellToday: { border: "1px solid #E8B86D", color: "#E8B86D", fontWeight: 800 },
  dayCellSelected: { background: "#E8B86D22" },
  dotsRow: { display: "flex", gap: 2 },
  dot: { width: 5, height: 5, borderRadius: "50%" },
  dayDetail: { marginTop: "1rem", borderTop: "1px solid #E8B86D22", paddingTop: "0.9rem" },
  dayDetailTitle: { color: "#E8B86D", fontSize: 13, fontWeight: 800, marginBottom: "0.5rem" },
  eventRow: { display: "flex", justifyContent: "space-between", alignItems: "center", color: "#eee", fontSize: 13, padding: "0.4rem 0" },
  liveNow: { background: "#D4373722", color: "#E5484D", fontSize: 10.5, fontWeight: 800, borderRadius: 6, padding: "0.2rem 0.5rem" },
  upcomingBox: { flex: "1 1 260px", background: "#111108", border: "1px solid #E8B86D33", borderRadius: 14, padding: "1.25rem" },
  upcomingTitle: { color: "#E8B86D", fontSize: 13, fontWeight: 800, marginBottom: "0.9rem" },
  upcomingRow: { display: "flex", gap: "0.6rem", alignItems: "flex-start", marginBottom: "0.8rem" },
};
