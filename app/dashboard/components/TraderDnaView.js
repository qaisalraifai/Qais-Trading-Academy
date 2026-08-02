"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  DNA_QUESTIONS,
  TRADER_TYPES,
  RISK_LABELS,
  SESSION_LABELS,
  scoreDnaQuiz,
  computeTradeInsights,
} from "@/lib/trader-dna";

const GOLD = "#E8B86D";
const GOLD_LIGHT = "#F0C588";
const GOLD_DARK = "#D4A05A";
const GREEN = "#3DBB6E";
const RED = "#E5484D";
const BLUE = "#3D8BFD";

const cardStyle = {
  background: "linear-gradient(145deg, #141517, #0D0E10)",
  border: `1px solid ${GOLD}26`,
  borderRadius: 18,
  boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
};

function SectionCard({ title, icon, children, style, right }) {
  return (
    <div style={{ ...cardStyle, padding: "1.4rem 1.6rem", marginBottom: "1.2rem", ...style }}>
      {title && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 17 }}>{icon}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{title}</span>
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

function ScoreRing({ label, value, color }) {
  const size = 92;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} stroke="#2b2e35" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            fontWeight: 800,
            color: "#fff",
          }}
        >
          {value}%
        </div>
      </div>
      <span style={{ fontSize: 12.5, color: "#9a9a9a", fontWeight: 700 }}>{label}</span>
    </div>
  );
}

function Pill({ children, color = GOLD }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: `${color}1a`,
        color,
        border: `1px solid ${color}40`,
        borderRadius: 20,
        padding: "0.35rem 0.8rem",
        fontSize: 12.5,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

function StatBlock({ icon, label, value, sub }) {
  return (
    <div
      style={{
        background: "#141517",
        border: `1px solid ${GOLD}1f`,
        borderRadius: 14,
        padding: "1rem 1.1rem",
        flex: "1 1 160px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#9a9a9a", fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "#666", marginTop: 2 }}>{sub}</div>}
      }
    </div>
  );
}

/* ===================== الاختبار ===================== */
function QuizFlow({ onFinish, onCancel }) {
  const { t } = useLocale();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const q = DNA_QUESTIONS[step];
  const progress = Math.round(((step + 1) / DNA_QUESTIONS.length) * 100);

  function choose(optId) {
    const next = { ...answers, [q.id]: optId };
    setAnswers(next);
    if (step < DNA_QUESTIONS.length - 1) {
      setTimeout(() => setStep((s) => s + 1), 180);
    } else {
      onFinish(next);
    }
  }

  return (
    <SectionCard title={t("traderDna.quizTitle")} icon="🧬">
      <div style={{ marginBottom: "1.2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9a9a9a", marginBottom: 6 }}>
          <span>{t("traderDna.questionOf", { current: step + 1, total: DNA_QUESTIONS.length })}</span>
          <span>{progress}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 6, background: "#2b2e35", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${GOLD_DARK}, ${GOLD_LIGHT})`,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: "1.1rem" }}>{q.text}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {q.options.map((opt) => {
          const selected = answers[q.id] === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => choose(opt.id)}
              style={{
                textAlign: "right",
                padding: "0.85rem 1rem",
                borderRadius: 12,
                border: `1px solid ${selected ? GOLD : GOLD + "26"}`,
                background: selected ? `${GOLD}1f` : "#141517",
                color: "#e5e5e5",
                fontSize: 14,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {opt.text}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.4rem" }}>
        <button
          onClick={() => (step === 0 ? onCancel() : setStep((s) => s - 1))}
          style={{
            background: "none",
            border: `1px solid #444`,
            color: "#9a9a9a",
            borderRadius: 10,
            padding: "0.55rem 1.1rem",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {step === 0 ? t("traderDna.cancel") : t("traderDna.previous")}
        </button>
      </div>
    </SectionCard>
  );
}

/* ===================== بطاقة الـ DNA ===================== */
function DnaCard({ profile, insights, onRetake }) {
  const { t } = useLocale();
  const typeInfo = TRADER_TYPES[profile.trader_type] || {};
  return (
    <div
      style={{
        ...cardStyle,
        padding: "1.6rem 1.8rem",
        marginBottom: "1.2rem",
        border: `1px solid ${GOLD}55`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -60,
          left: -60,
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${GOLD}22, transparent 70%)`,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.2rem", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 26 }}>🧬</span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>Trader DNA</div>
            <div style={{ fontSize: 12.5, color: "#9a9a9a" }}>
              {typeInfo.icon} {typeInfo.label}
            </div>
          </div>
        </div>
        <button
          onClick={onRetake}
          style={{
            background: "none",
            border: `1px solid ${GOLD}55`,
            color: GOLD,
            borderRadius: 10,
            padding: "0.5rem 1rem",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {t("traderDna.retakeQuiz")}
        </button>
      </div>

      <p style={{ fontSize: 13, color: "#9a9a9a", lineHeight: 1.7, marginBottom: "1.3rem" }}>{typeInfo.desc}</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1.6rem", marginBottom: "1.4rem" }}>
        <ScoreRing label={t("traderDna.scorePsychology")} value={profile.psychology_score} color={GOLD} />
        <ScoreRing label={t("traderDna.scoreDiscipline")} value={profile.discipline_score} color={GREEN} />
        {insights?.hasEnoughData && insights.winRate !== null && (
          <ScoreRing label={t("traderDna.scoreWinRate")} value={insights.winRate} color={BLUE} />
        )}
        <ScoreRing label={t("traderDna.scoreMaturity")} value={insights?.dnaMaturity ?? 0} color={GOLD_LIGHT} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: "0.4rem" }}>
        <Pill>{t("traderDna.riskLabel", { value: RISK_LABELS[profile.risk_tolerance] })}</Pill>
        <Pill color={BLUE}>{SESSION_LABELS[profile.session_preference] || "—"}</Pill>
        {insights?.bestAsset && <Pill color={GREEN}>{t("traderDna.bestAssetLabel", { value: insights.bestAsset.name })}</Pill>}
        }
        {insights?.bestSetup && <Pill color={GOLD_LIGHT}>{t("traderDna.bestSetupLabel", { value: insights.bestSetup.name })}</Pill>}
        }
      </div>
    </div>
  );
}

export default function TraderDnaView({ userId: userIdProp }) {
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(userIdProp || null);
  const [profile, setProfile] = useState(null);
  const [insights, setInsights] = useState(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !active) return;
      setUserId(user.id);

      const [{ data: dnaRow }, { data: tradeRows }] = await Promise.all([
        supabase.from("trader_dna_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("trades").select("asset, setup, session, result, trade_date").eq("user_id", user.id),
      ]);

      if (!active) return;
      setProfile(dnaRow || null);
      setInsights(computeTradeInsights(tradeRows || []));
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  async function handleFinishQuiz(answers) {
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      const scored = scoreDnaQuiz(answers);
      const supabase = createClient();
      const payload = {
        user_id: userId,
        answers,
        trader_type: scored.traderType,
        risk_tolerance: scored.riskTolerance,
        psychology_score: scored.psychologyScore,
        discipline_score: scored.disciplineScore,
        strengths: scored.strengths.map((s) => s.text),
        weaknesses: scored.weaknesses.map((w) => w.text),
        session_preference: scored.sessionPreference,
        updated_at: new Date().toISOString(),
      };
      const { data, error: upsertError } = await supabase
        .from("trader_dna_profiles")
        .upsert(payload, { onConflict: "user_id" })
        .select()
        .single();
      if (upsertError) throw upsertError;
      setProfile(data);
      // نحتفظ بخطة التطوير الأسبوعية بالذاكرة المحلية للعرض مباشرة
      setWeeklyPlanCache(scored.weeklyPlan);
      setShowQuiz(false);
    } catch (e) {
      setError(t("traderDna.saveError", { message: e.message || t("traderDna.unknownError") }));
    } finally {
      setSaving(false);
    }
  }

  // خطة التطوير الأسبوعية: نعيد حسابها من إجابات آخر اختبار محفوظة بالبروفايل
  const [weeklyPlanCache, setWeeklyPlanCache] = useState(null);
  useEffect(() => {
    if (profile?.answers) {
      const scored = scoreDnaQuiz(profile.answers);
      setWeeklyPlanCache(scored.weeklyPlan);
    }
  }, [profile?.answers]);

  if (loading) {
    return <div style={{ color: "#666", fontSize: 14, padding: "3rem 0", textAlign: "center" }}>{t("traderDna.analyzing")}</div>;
  }

  if (showQuiz || !profile) {
    if (showQuiz) {
      return (
        <>
          {error && (
            <div style={{ color: RED, fontSize: 13, marginBottom: "0.8rem" }}>{error}</div>
          )}
          <QuizFlow onFinish={handleFinishQuiz} onCancel={() => setShowQuiz(false)} />
          {saving && <div style={{ color: "#9a9a9a", fontSize: 13, marginTop: 8 }}>{t("traderDna.savingResult")}</div>}
          }
        </>
      );
    }
    return (
      <div style={{ ...cardStyle, padding: "3rem 2rem", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🧬</div>
        <h3 style={{ fontSize: 19, fontWeight: 800, color: "#fff", marginBottom: 8 }}>{t("traderDna.introTitle")}</h3>
        <p style={{ fontSize: 13.5, color: "#9a9a9a", maxWidth: 460, margin: "0 auto 1.6rem", lineHeight: 1.8 }}>
          {t("traderDna.introDesc", { count: DNA_QUESTIONS.length })}
        </p>
        <button
          onClick={() => setShowQuiz(true)}
          style={{
            background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_DARK})`,
            color: "#111",
            border: "none",
            borderRadius: 12,
            padding: "0.85rem 2rem",
            fontSize: 14.5,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {t("traderDna.startQuiz")}
        </button>
      </div>
    );
  }

  return (
    <>
      <DnaCard profile={profile} insights={insights} onRetake={() => setShowQuiz(true)} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem" }}>
        <SectionCard title={t("traderDna.strengthsTitle")} icon="💪">
          {profile.strengths?.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {profile.strengths.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5, color: "#d5d5d5" }}>
                  <span style={{ color: GREEN }}>✓</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "#666", fontSize: 13 }}>{t("traderDna.strengthsEmpty")}</div>
          )}
        </SectionCard>

        <SectionCard title={t("traderDna.weaknessesTitle")} icon="⚠️">
          {profile.weaknesses?.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {profile.weaknesses.map((w, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5, color: "#d5d5d5" }}>
                  <span style={{ color: RED }}>✕</span>
                  <span>{w}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "#666", fontSize: 13 }}>{t("traderDna.weaknessesEmpty")}</div>
          )}
        </SectionCard>
      </div>

      {weeklyPlanCache?.length > 0 && (
        <SectionCard title={t("traderDna.weeklyPlanTitle")} icon="📌">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {weeklyPlanCache.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  fontSize: 13.5,
                  color: "#d5d5d5",
                  background: "#141517",
                  border: `1px solid ${GOLD}1f`,
                  borderRadius: 10,
                  padding: "0.75rem 0.9rem",
                }}
              >
                <span style={{ color: GOLD, fontWeight: 800 }}>{i + 1}</span>
                <span>{item.task}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard title={t("traderDna.bestEnvTitle")} icon="🌍">
        {insights?.hasEnoughData ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.9rem" }}>
            <StatBlock icon="📊" label={t("traderDna.overallWinRate")} value={`${insights.winRate}%`} sub={t("traderDna.tradesRecorded", { count: insights.totalTrades })} />
            {insights.bestAsset && (
              <StatBlock icon="🥇" label={t("traderDna.bestAsset")} value={insights.bestAsset.name} sub={t("traderDna.winRateWithSample", { rate: insights.bestAsset.winRate, sample: insights.bestAsset.sample })} />
            )}
            {insights.bestSetup && (
              <StatBlock icon="🧩" label={t("traderDna.bestSetup")} value={insights.bestSetup.name} sub={t("traderDna.winRateWithSample", { rate: insights.bestSetup.winRate, sample: insights.bestSetup.sample })} />
            )}
            {insights.bestSession && (
              <StatBlock icon="🕒" label={t("traderDna.bestSession")} value={SESSION_LABELS[insights.bestSession.name] || insights.bestSession.name} sub={t("traderDna.winRateOnly", { rate: insights.bestSession.winRate })} />
            )}
            {insights.bestDay && (
              <StatBlock icon="📅" label={t("traderDna.bestDay")} value={insights.bestDay.name} sub={t("traderDna.winRateOnly", { rate: insights.bestDay.winRate })} />
            )}
            {insights.worstDay && (
              <StatBlock icon="🔻" label={t("traderDna.worstDay")} value={insights.worstDay.name} sub={t("traderDna.winRateOnly", { rate: insights.worstDay.winRate })} />
            )}
          </div>
        ) : (
          <div style={{ color: "#9a9a9a", fontSize: 13.5, lineHeight: 1.8 }}>
            {t("traderDna.notEnoughDataBefore")}{" "}
            <b style={{ color: GOLD }}>"{t("traderDna.tradesTabName")}"</b> {t("traderDna.notEnoughDataAfter")}
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#666", marginBottom: 4 }}>
                <span>{t("traderDna.dnaMaturityLabel")}</span>
                <span>{insights?.dnaMaturity ?? 0}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 6, background: "#2b2e35", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${insights?.dnaMaturity ?? 0}%`,
                    background: `linear-gradient(90deg, ${GOLD_DARK}, ${GOLD_LIGHT})`,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </SectionCard>
    </>
  );
}
