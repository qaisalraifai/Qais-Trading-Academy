"use client";

/* ============================================================================
   OrbitDiagram — البصرية البطل بصفحة الهبوط.
   ----------------------------------------------------------------------------
   أربع منهجيات المنهج (FND · FUN · ICT · SK) كأقمار على مدارات حول نواة
   واحدة = المتداول. المدار الأبعد أبطأ — نفس منطق الجاذبية، وبيعطي عمق حقيقي
   بدل دوران مسطّح.

   القمر بيتحرّك بـ<animateMotion> على **نفس** مسار الإهليلج المرسوم، فالحركة
   مطابقة للمدار بالضبط. (لو استخدمنا transform: rotate بيطلع دوران دائري
   على مدار إهليلجي — يعني القمر بيطلع برّا الخط.)

   بيحترم prefers-reduced-motion عبر قاعدة CSS بتوقف كل الحركات بالنظام.
   ============================================================================ */

const RINGS = [
  { rx: 62, dur: 26, tilt: -24, size: 5.5 },
  { rx: 92, dur: 38, tilt: -12, size: 4.5 },
  { rx: 122, dur: 52, tilt: 0, size: 4.5 },
  { rx: 152, dur: 68, tilt: 12, size: 4 },
];

const RATIO = 0.36; // نسبة تسطيح المدار

/* مسار إهليلج مقفل حول المركز (180,180) */
function ellipsePath(rx) {
  const ry = rx * RATIO;
  return `M ${180 - rx} 180 a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0`;
}

export default function OrbitDiagram({ size = 380, className }) {
  return (
    <div className={className} style={{ width: size, height: size, maxWidth: "100%" }}>
      <svg
        viewBox="0 0 360 360"
        width="100%"
        height="100%"
        fill="none"
        role="img"
        aria-label="منهج الأكاديمية: الأساسيات، التحليل الأساسي، ICT، وSK حول المتداول"
      >
        <defs>
          <linearGradient id="orbIri" x1="40" y1="30" x2="320" y2="330" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7C4DFF" />
            <stop offset="0.5" stopColor="#9F6CFF" />
            <stop offset="1" stopColor="#22D3EE" />
          </linearGradient>
          <radialGradient id="orbCore" cx="0.4" cy="0.35" r="0.75">
            <stop stopColor="#C4B0FF" />
            <stop offset="0.55" stopColor="#7C4DFF" />
            <stop offset="1" stopColor="#3C2090" />
          </radialGradient>
          <radialGradient id="orbHalo" cx="0.5" cy="0.5" r="0.5">
            <stop stopColor="#7C4DFF" stopOpacity="0.28" />
            <stop offset="1" stopColor="#7C4DFF" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="180" cy="180" r="155" fill="url(#orbHalo)" />

        {RINGS.map((ring, i) => {
          const d = ellipsePath(ring.rx);
          return (
            <g key={ring.rx} transform={`rotate(${ring.tilt} 180 180)`}>
              <path d={d} stroke="url(#orbIri)" strokeWidth="1" opacity={0.44 - i * 0.07} />
              <circle r={ring.size} fill="url(#orbIri)">
                <animateMotion dur={`${ring.dur}s`} repeatCount="indefinite" path={d} />
              </circle>
            </g>
          );
        })}

        {/* النواة — المتداول */}
        <circle cx="180" cy="180" r="30" fill="url(#orbCore)" />
        <circle cx="180" cy="180" r="30" fill="none" stroke="#C4B0FF" strokeWidth="1" opacity="0.45" />
        <circle cx="180" cy="180" r="42" fill="none" stroke="url(#orbIri)" strokeWidth="0.8" opacity="0.28" />
      </svg>
    </div>
  );
}
