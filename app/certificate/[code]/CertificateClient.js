"use client";

// زر الطباعة/الحفظ كـ PDF — أبسط طريقة موثوقة بدون أي مكتبة إضافية،
// كل متصفح فيه خيار "حفظ كـ PDF" جوا نافذة الطباعة نفسها.
export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        marginTop: "1.5rem",
        background: "linear-gradient(135deg, #C9A860, #9C7F42)",
        color: "#111726",
        border: "none",
        borderRadius: 3,
        padding: "0.75rem 1.75rem",
        fontWeight: 800,
        fontSize: 14,
        cursor: "pointer",
      }}
      className="no-print"
    >طباعة / حفظ كـ PDF
    </button>
  );
}
