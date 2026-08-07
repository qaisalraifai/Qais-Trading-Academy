"use client";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { GOLD, BORDER, btnGhost } from "./shared";

// يولّد QR Code محلياً بالكامل داخل المتصفح (canvas) — بدون أي اتصال بخدمة خارجية.
export default function QrCodeBox({ value, size = 180, filename = "qta-qr-code.png" }) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!value || !canvasRef.current) return;
    QRCode.toCanvas(
      canvasRef.current,
      value,
      {
        width: size,
        margin: 1,
        color: { dark: "#C9A860", light: "#080B14" },
      },
      (err) => setReady(!err)
    );
  }, [value, size]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div
      style={{
        flex: "0 0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.7rem",
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${BORDER}`,
        borderRadius: 0,
        padding: "1.1rem",
        margin: "0 auto",
      }}
      className="qta-animate-in"
    >
      <canvas ref={canvasRef} width={size} height={size} style={{ borderRadius: 3, display: "block" }} />
      <button onClick={download} disabled={!ready} style={{ ...btnGhost, fontSize: "0.75rem" }}>
        تنزيل الصورة
      </button>
    </div>
  );
}
