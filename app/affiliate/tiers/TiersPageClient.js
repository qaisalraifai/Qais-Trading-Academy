"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GOLD,
  BORDER,
  card,
  monoStack,
  displayStack,
  fmt,
  SkeletonBlock,
  ShimmerStyles,
} from "../components/shared";

export default function TiersPageClient() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/affiliate/tiers-overview")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={s.page}>
      <ShimmerStyles />

      <Link href="/affiliate" style={s.backLink}>← رجوع لبرنامج العمولة</Link>

      <div style={{ marginBottom: "1.8rem" }}>
        <p style={{ fontFamily: monoStack, color: GOLD, fontSize: 11, letterSpacing: 3, marginBottom: 8 }}>
          QAIS TRADING ACADEMY
        </p>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, fontFamily: displayStack, margin: 0 }}>
          مستويات المسوّقين
        </h1>
        <p style={{ color: "#A79FC4", fontSize: "0.85rem", marginTop: 8, lineHeight: 1.8, maxWidth: 680 }}>
          كل ما زاد عدد عملائك النشطين، ترقّى مستواك — وعمولتك على كل تسجيل وكل تجديد بتزيد معه فوراً.
          المستوى مبني على أدائك الحقيقي الحالي (عملاء نشطين فعلياً)، مو على عدد التسجيلات التاريخية —
          يعني استمراريتك بمتابعة عملائك هي اللي بتحافظلك على مستواك.
        </p>
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "1rem" }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={card}>
              <SkeletonBlock h={140} radius={14} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {data?.myStatus && (
            <div style={{ ...card, marginBottom: "1.6rem", border: `1px solid ${data.myStatus.current.color_hex}55` }} className="qta-animate-in">
              <p style={{ color: "#A79FC4", fontSize: "0.8rem", marginBottom: 6 }}>مستواك الحالي</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 26 }}>{data.myStatus.current.badge_icon}</span>
                <span style={{ fontSize: "1.3rem", fontWeight: 800, color: data.myStatus.current.color_hex }}>
                  {data.myStatus.current.title_ar}
                </span>
                <span style={{ color: "#6E6690", fontSize: "0.82rem" }}>
                  · {data.myStatus.activeClientsCount} عميل نشط
                </span>
              </div>
            </div>
          )}

          {!data?.isAffiliate && (
            <div style={{ ...card, marginBottom: "1.6rem", border: `1px solid #3D2F63`, background: "rgba(212,175,55,0.05)" }} className="qta-animate-in">
              <p style={{ color: "#F5F3FF", fontSize: "0.85rem", lineHeight: 1.8, margin: 0 }}>
                لسا ما انضممت لبرنامج العمولة. <Link href="/affiliate" style={{ color: GOLD, fontWeight: 700 }}>سجّل من هون</Link> وابلّش من Bronze.
              </p>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "1rem" }}>
            {(data?.tiers || []).map((t, i) => {
              const isCurrent = data?.myStatus?.current?.id === t.id;
              const isReached = data?.myStatus ? data.myStatus.activeClientsCount >= t.min_active_clients : false;
              const nextTier = data.tiers[i + 1];

              return (
                <div
                  key={t.id}
                  style={{
                    ...card,
                    border: `1px solid ${isCurrent ? t.color_hex : BORDER}`,
                    boxShadow: isCurrent ? `0 0 30px ${t.color_hex}22` : "none",
                    position: "relative",
                    opacity: data?.myStatus && !isReached ? 0.55 : 1,
                  }}
                  className="qta-animate-in"
                >
                  {isCurrent && (
                    <span
                      style={{
                        position: "absolute",
                        top: 14,
                        left: 14,
                        fontSize: "0.65rem",
                        fontWeight: 800,
                        color: t.color_hex,
                        background: `${t.color_hex}18`,
                        border: `1px solid ${t.color_hex}55`,
                        borderRadius: 999,
                        padding: "3px 10px",
                      }}
                    >
                      مستواك الحالي
                    </span>
                  )}

                  <div style={{ textAlign: "center", marginBottom: "1rem", marginTop: isCurrent ? "1.4rem" : 0 }}>
                    <div style={{ fontSize: "2.2rem", marginBottom: 6 }}>{t.badge_icon}</div>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: t.color_hex, margin: 0 }}>{t.title_ar}</h3>
                    <p style={{ color: "#6E6690", fontSize: "0.75rem", marginTop: 4 }}>
                      {t.min_active_clients === 0 ? "المستوى الافتتاحي" : `${t.min_active_clients}+ عميل نشط`}
                      {nextTier ? ` (لحد ${nextTier.min_active_clients - 1})` : " فأكثر"}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginBottom: "0.6rem" }}>
                    <div style={rateBox(t.color_hex)}>
                      <p style={rateLabel}>عمولة التسجيل</p>
                      <p style={{ ...rateValue, color: t.color_hex }}>${fmt(t.signup_amount)}</p>
                    </div>
                    <div style={rateBox(t.color_hex)}>
                      <p style={rateLabel}>عمولة التجديد</p>
                      <p style={{ ...rateValue, color: t.color_hex }}>${fmt(t.renewal_amount)}</p>
                    </div>
                  </div>

                  <p style={{ color: "#6E6690", fontSize: "0.72rem", textAlign: "center", marginTop: 8 }}>
                    شرط الوصول: {t.min_active_clients === 0 ? "تلقائي عند القبول بالبرنامج" : `${t.min_active_clients} عميل نشط بنفس الوقت`}
                  </p>
                </div>
              );
            })}
          </div>

          <div style={{ ...card, marginTop: "1.6rem" }} className="qta-animate-in">
            <h3 style={{ fontSize: "1rem", fontWeight: 800, marginBottom: 10, color: "#F5F3FF" }}>كيف تُحسب المستويات؟</h3>
            <ul style={{ color: "#A79FC4", fontSize: "0.82rem", lineHeight: 2, paddingRight: 18, margin: 0 }}>
              <li>المستوى يُحسب حيًّا من عدد عملائك <b style={{ color: "#F5F3FF" }}>النشطين حالياً</b> — مو من إجمالي عدد من سجّل عن طريقك تاريخياً.</li>
              <li>لو زاد عدد عملائك النشطين، بترقّى تلقائياً — بدون أي طلب أو موافقة يدوية.</li>
              <li>لو قلّ عدد عملائك النشطين (مثلاً بسبب إلغاءات)، مستواك بيتحدّث تلقائياً ليعكس وضعك الحالي.</li>
              <li>عمولتك الجديدة تنطبق فوراً على <b style={{ color: "#F5F3FF" }}>كل عملياتك الجاية</b> — كل تسجيل جديد وكل تجديد شهري، حتى من عملاء قدامى.</li>
              <li>عمولات سبق واستحقيتها (قبل الترقية) ما بتتغيّر — القيمة تُقفل وقت كل عملية على حدة.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

const rateLabel = { fontSize: "0.65rem", color: "#A79FC4", marginBottom: 3, textAlign: "center" };
const rateValue = { fontSize: "1rem", fontWeight: 800, fontFamily: monoStack, textAlign: "center" };
function rateBox(color) {
  return {
    flex: 1,
    background: `${color}0d`,
    border: `1px solid ${color}33`,
    borderRadius: 3,
    padding: "0.6rem 0.4rem",
  };
}

const s = {
  page: { direction: "rtl", color: "#F5F3FF", padding: "2rem 1.5rem 4rem", maxWidth: 1150, margin: "0 auto" },
  backLink: { display: "inline-block", color: "#6E6690", fontSize: "0.82rem", textDecoration: "none", marginBottom: "1.2rem" },
};
