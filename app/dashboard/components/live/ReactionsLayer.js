"use client";

export default function ReactionsLayer({ reactions }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
      {reactions.map((r) => (
        <span
          key={r.id}
          className="absolute bottom-4 text-3xl animate-float-up"
          style={{ left: `${r.left}%` }}
        >
          {r.emoji}
        </span>
      ))}
      <style jsx>{`
        @keyframes float-up {
          0% {
            transform: translateY(0) scale(0.6);
            opacity: 0;
          }
          15% {
            opacity: 1;
            transform: translateY(-20px) scale(1);
          }
          100% {
            transform: translateY(-260px) scale(1.1);
            opacity: 0;
          }
        }
        .animate-float-up {
          animation: float-up 2.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
