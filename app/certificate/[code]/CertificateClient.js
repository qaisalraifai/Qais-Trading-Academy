"use client";

// زر الطباعة/الحفظ كـ PDF — أبسط طريقة موثوقة بدون أي مكتبة إضافية،
// كل متصفح فيه خيار "حفظ كـ PDF" جوا نافذة الطباعة نفسها.
export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        marginTop: "1.5rem",
        background: "linear-gradient(135deg, #E8B86D, #D4A05A)",
        color: "#111",
        border: "none",
        borderRadius: 10,
        padding: "0.75rem 1.75rem",
        fontWeight: 800,
        fontSize: 14,
        cursor: "pointer",
      }}
      className="no-print"
    >
      🖨 طباعة / حفظ كـ PDF
    </button>
  );
}
