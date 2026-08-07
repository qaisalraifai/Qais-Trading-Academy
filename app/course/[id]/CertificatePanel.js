"use client";

import { useEffect, useState } from "react";

// المرحلة 13: شهادة دفعة الطالب لهاي الدورة — بتصدر تلقائيًا لما يخلّص 100% من
// محاضرات دفعته (السيرفر بيتحقق ويصدرها أول ما هاي الصفحة تفتح)، وبتضل تظهر
// كشريط تقدّم لحد ما يخلّص. كومبوننت مستقل بيجيب بياناته لحاله.
export default function CertificatePanel({ courseId }) {
  const [data, setData] = useState(undefined); // undefined = جاري التحميل

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/batches/certificates?course_id=${courseId}`)
      .then((res) => res.json())
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  // ما منعرض القسم لو لسا بيحمّل أو ما في بيانات إطلاقًا (مثلاً الطالب ما اختار دفعة لسا)
  if (!data || !data.progress || data.progress.total === 0) return null;

  const { certificate, progress } = data;

  return (
    <div style={styles.wrap}>
      {certificate ? (
        <>
          <div style={{ fontSize: 28 }}>🎓</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>مبروك! خلّصت متطلبات الدفعة</div>
            <div style={{ color: "#93A0B8", fontSize: 12, marginTop: 2 }}>شهادتك جاهزة للتحميل والمشاركة</div>
          </div>
          <a
            href={`/certificate/${certificate.certificate_code}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.btn}
          >
            عرض الشهادة ⬈
          </a>
        </>
      ) : (
        <>
          <div style={{ fontSize: 28 }}>📜</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>
              أكملت {progress.completed} من {progress.total} محاضرة ({progress.percent}%)
            </div>
            <div style={styles.barTrack}>
              <div style={{ ...styles.barFill, width: `${progress.percent}%` }} />
            </div>
            <div style={{ color: "#5D6880", fontSize: 11.5, marginTop: 4 }}>
              خلّصي كل محاضرات دفعتك عشان تحصلي على شهادة الإتمام تلقائيًا
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  wrap: {
    display: "flex",
    alignItems: "center",
    gap: "0.9rem",
    background: "#111726",
    border: "1px solid #26314A",
    borderRadius: 0,
    padding: "1rem 1.1rem",
    marginBottom: "1.5rem",
  },
  barTrack: {
    marginTop: 8,
    width: "100%",
    maxWidth: 320,
    height: 6,
    borderRadius: 3,
    background: "#1B2438",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    background: "linear-gradient(90deg, #C9A860, #9C7F42)",
    borderRadius: 3,
    transition: "width 0.3s ease",
  },
  btn: {
    background: "linear-gradient(135deg, #C9A860, #9C7F42)",
    color: "#111726",
    borderRadius: 3,
    padding: "0.55rem 1rem",
    fontSize: 12.5,
    fontWeight: 800,
    textDecoration: "none",
    whiteSpace: "nowrap",
  },
};
