"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-client";

export default function QuizForm({ quizId, questions, studentId }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);

  function selectAnswer(questionId, optionIndex) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  }

  async function handleSubmit() {
    setLoading(true);
    let correctCount = 0;

    questions.forEach((q) => {
      if (answers[q.id] === q.correct_option_index) correctCount++;
    });

    setScore(correctCount);

    const supabase = createClient();
    await supabase.from("quiz_attempts").insert({
      student_id: studentId,
      quiz_id: quizId,
      score: correctCount,
      total_questions: questions.length,
    });

    setSubmitted(true);
    setLoading(false);
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
    backgroundColor: "#242424",
    padding: "1rem",
    borderRadius: "10px",
    marginBottom: "1rem",
  },
  questionText: { marginBottom: "0.75rem", fontWeight: "bold" },
  optionsList: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  optionLabel: {
    display: "flex",
    alignItems: "center",
    padding: "0.5rem",
    borderRadius: "8px",
    backgroundColor: "#0f0f0f",
    cursor: "pointer",
  },
  optionSelected: { border: "1px solid #00C853" },
  submitButton: {
    padding: "0.75rem 1.5rem",
    backgroundColor: "#00C853",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
    width: "100%",
  },
  resultBox: { textAlign: "center", padding: "2rem", backgroundColor: "#242424", borderRadius: "12px" },
  resultTitle: { marginBottom: "0.5rem" },
  resultPercent: { fontSize: "2rem", color: "#00C853", marginBottom: "1.5rem" },
  backButton: {
    display: "inline-block",
    padding: "0.75rem 1.5rem",
    backgroundColor: "#3b82f6",
    color: "#fff",
    borderRadius: "8px",
    textDecoration: "none",
  },
};
