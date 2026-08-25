"use client";

import { useState } from "react";
import { readJson } from "@/lib/http-json";

/* ⚠️ `studentId` ما عاد ينستعمل: الهوية بتنقرا من الجلسة بالخادم
   (`/api/quiz/[id]/submit`) بدل ما تنبعت من المتصفّح. */
export default function QuizForm({ quizId, questions }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function selectAnswer(questionId, optionIndex) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  }

  /* ⚠️ التصحيح **على الخادم**. كان بينحسب هون بمقارنة `q.correct_option_index`
     — وهاد بيعني إنّ الإجابات الصحيحة كانت تنشحن للمتصفّح مع كل اختبار.
     صار المكوّن يبعت الإجابات وبس، والخادم بيرجّع الدرجة. */
  async function handleSubmit() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/quiz/${quizId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "تعذّر تسليم الاختبار");

      setScore(data.score);
      setSubmitted(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    const percent = Math.round((score / questions.length) * 100);
    return (
      <div style={styles.resultBox}>
        <h2 style={styles.resultTitle}>نتيجتك: {score} / {questions.length}</h2>
        <p style={styles.resultPercent}>{percent}%</p>
        <a href="/dashboard" style={styles.backButton}>رجوع للوحة</a>
      </div>
    );
  }

  return (
    <div>
      {questions.map((q, idx) => (
        <div key={q.id} style={styles.questionBox}>
          <p style={styles.questionText}>
            {idx + 1}. {q.question_text}
          </p>
          <div style={styles.optionsList}>
            {q.options.map((option, i) => (
              <label
                key={i}
                style={{
                  ...styles.optionLabel,
                  ...(answers[q.id] === i ? styles.optionSelected : {}),
                }}
              >
                <input
                  type="radio"
                  name={`question-${q.id}`}
                  checked={answers[q.id] === i}
                  onChange={() => selectAnswer(q.id, i)}
                  style={{ marginLeft: "0.5rem" }}
                />
                {option}
              </label>
            ))}
          </div>
        </div>
      ))}

      {error && (
        <p style={{ color: "#FF6B6B", textAlign: "center", marginBottom: "0.8rem" }}>{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || Object.keys(answers).length < questions.length}
        style={styles.submitButton}
      >
        {loading ? "جاري التسليم..." : "تسليم الاختبار"}
      </button>
    </div>
  );
}

const styles = {
  questionBox: {
    backgroundColor: "#241C3E",
    padding: "1rem",
    borderRadius: "3px",
    marginBottom: "1rem",
  },
  questionText: { marginBottom: "0.75rem", fontWeight: "bold" },
  optionsList: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  optionLabel: {
    display: "flex",
    alignItems: "center",
    padding: "0.5rem",
    borderRadius: "3px",
    backgroundColor: "#0A0614",
    cursor: "pointer",
  },
  optionSelected: { border: "1px solid #10E5A0" },
  submitButton: {
    padding: "0.75rem 1.5rem",
    backgroundColor: "#10E5A0",
    color: "#fff",
    border: "none",
    borderRadius: "3px",
    cursor: "pointer",
    fontWeight: "bold",
    width: "100%",
  },
  resultBox: { textAlign: "center", padding: "2rem", backgroundColor: "#241C3E", borderRadius: "0px" },
  resultTitle: { marginBottom: "0.5rem" },
  resultPercent: { fontSize: "2rem", color: "#10E5A0", marginBottom: "1.5rem" },
  backButton: {
    display: "inline-block",
    padding: "0.75rem 1.5rem",
    backgroundColor: "#7C4DFF",
    color: "#fff",
    borderRadius: "3px",
    textDecoration: "none",
  },
};
