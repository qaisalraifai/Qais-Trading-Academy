/* ============================================================================
   app/loading.js — حدّ Suspense على مستوى الجذر لكل انتقال بين الصفحات.

   ---------------------------------------------------------------------------
   ⚠️ ليش انبنى: **ما كان في ولا ملف `loading.js` بالمشروع كله** (٥١ صفحة).

   بـApp Router، بلا حدّ Suspense ما بيقدر React يعرض أي بديل أثناء التنقّل.
   فلما يضغط المستخدم رابطاً بتضل الصفحة القديمة **مجمّدة بلا أي إشارة** لحد
   ما يخلص الخادم، وبعدين تقفز الصفحة الجديدة دفعة وحدة.

   والانتظار مش قصير: كل انتقال بيمرّ على **خمس رحلات شبكية متسلسلة** لـ
   Supabase — تنتان بالـproxy (`auth.getUser()` ثم `profiles`) وتلاتة
   بالصفحة (`auth.getUser()` ثم `profiles` ثم `batch_enrollments`) —
   وتنتان منهن **مكرَّرتان حرفياً** بين الطبقتين.

   هالملف ما بيقلّل ولا رحلة. اللي بيعمله إنه يخلّي الضغطة **تستجيب فوراً**
   بدل ما تبان المنصّة متجمّدة. الرحلات المكرَّرة سؤال منفصل — بتمسّ مسار
   المصادقة، فقرارها إله.

   ⚠️ بلا إيموجي وبلا صور — CSS خالص، عشان يبان بأول فريم بلا أي تحميل.
   الألوان من متغيّرات الثيم نفسها (`globals.css`) حتى ما تومض أرضية غريبة.
   ============================================================================ */
export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="جاري التحميل"
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: "var(--space-1, #0a0614)",
        zIndex: 40,
      }}
    >
      {/* حلقة دوّارة بسيطة — نفس بنفسجي الهوية. الحركة بـtransform بس
          عشان تضل على المعالج الرسومي وما تسبب إعادة تخطيط. */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          border: "2px solid var(--edge-lit, #3d2f63)",
          borderTopColor: "var(--iris, #7c4dff)",
          animation: "qtaSpin 720ms linear infinite",
        }}
      />
      <style>{`
        @keyframes qtaSpin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          [role="status"] > div { animation-duration: 2.4s; }
        }
      `}</style>
    </div>
  );
}
