"use client";
import { useEffect, useRef, useState } from "react";

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#F2D57E";
const GOLD_DARK = "#9C7A22";

/*
 * مودال إضافة/تحديث طريقة الدفع — من غير ما يودّي المستخدم لصفحة الاشتراك الكاملة ($300).
 *
 * فيه حالتين حقيقيتين حسب وضع المستخدم:
 *
 * 1) عنده اشتراك Paddle أصلاً (managementUrls.updatePaymentMethod موجود):
 *    منعرض صفحة Paddle الرسمية لتحديث البطاقة جوا iframe بالمودال. هاي الصفحة
 *    مخصصة أصلاً لتحديث البطاقة بس وما بتفرض أي رسوم — نفس اللي Paddle نفسها بتستخدمه.
 *
 * 2) مستخدم جديد ما إله أي اشتراك Paddle لسا:
 *    Paddle ما بتسمح تسجيل بطاقة "فاضية" من غير أي عملية دفع مرتبطة فيها.
 *    الحل الصحيح: تنشئ منتج/سعر بـ $0 بلوحة تحكم Paddle خصيصاً لتوثيق البطاقة
 *    (Payment Method Verification)، وتحط الـ Price ID فيه بمتغير البيئة:
 *      NEXT_PUBLIC_PADDLE_PRICE_CARD_SETUP
 *    لو هاد المتغير موجود، منفتح Paddle Checkout المدمج بقيمة $0 جوا نفس المودال.
 *    لو مش موجود، منعرض رسالة توضيحية بدل ما نكسر التجربة أو نوجّه غلط لصفحة $300.
 */
export default function AddPaymentMethodModal({ open, onClose, managementUrls }) {
  const [paddle, setPaddle] = useState(null);
  const [checkoutStarted, setCheckoutStarted] = useState(false);
  const checkoutRef = useRef(null);

  const cardSetupPriceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_CARD_SETUP;
  const useIframe = Boolean(managementUrls?.updatePaymentMethod);
  const useInlineCheckout = !useIframe && Boolean(cardSetupPriceId);

  useEffect(() => {
    if (!open || !useInlineCheckout || paddle) return;
    import("@paddle/paddle-js").then(({ initializePaddle }) => {
      initializePaddle({
        environment: process.env.NEXT_PUBLIC_PADDLE_ENV || "sandbox",
        token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
      }).then((instance) => setPaddle(instance));
    });
  }, [open, useInlineCheckout, paddle]);

  useEffect(() => {
    if (!open) {
      setCheckoutStarted(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !useInlineCheckout || !paddle || checkoutStarted) return;
    setCheckoutStarted(true);
    requestAnimationFrame(() => {
      paddle.Checkout.open({
        items: [{ priceId: cardSetupPriceId, quantity: 1 }],
        settings: {
          displayMode: "inline",
          frameTarget: "add-card-checkout-container",
          frameInitialHeight: "450",
          frameStyle: "width: 100%; min-width: 280px; background-color: transparent; border: none;",
          theme: "dark",
        },
      });
    });
  }, [open, useInlineCheckout, paddle, checkoutStarted, cardSetupPriceId]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(3px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflowY: "auto",
          background: "linear-gradient(145deg, #121212, #0A0A0A)",
          border: `1px solid ${GOLD}44`,
          borderRadius: 18,
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          padding: "1.6rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff" }}>💳 طريقة الدفع</h3>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#888",
              fontSize: 18,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {useIframe && (
          <>
            <p style={{ fontSize: 12, color: "#888", margin: "0 0 12px" }}>
              حدّث بطاقتك مباشرة عبر صفحة Paddle الآمنة — ما رح ينخصم أي مبلغ.
            </p>
            <iframe
              src={managementUrls.updatePaymentMethod}
              title="تحديث طريقة الدفع"
              style={{ width: "100%", height: 560, border: "none", borderRadius: 12, background: "#0a0a0a" }}
            />
          </>
        )}

        {useInlineCheckout && (
          <>
            <p style={{ fontSize: 12, color: "#888", margin: "0 0 12px" }}>
              سجّل بطاقتك بأمان — هاي خطوة توثيق فقط بدون رسوم $300 الاشتراك.
            </p>
            <div className="add-card-checkout-container" style={{ width: "100%", minHeight: 300 }}>
              {!paddle && <p style={{ color: "#666", fontSize: 13, textAlign: "center" }}>...جاري التحميل</p>}
            </div>
          </>
        )}

        {!useIframe && !useInlineCheckout && (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <p style={{ fontSize: 13, color: "#999", lineHeight: 1.8, margin: "0 0 16px" }}>
              ما في طريقة دفع مسجلة عندك لهلق، وإضافة بطاقة لوحدها (من غير اشتراك) لسا مش متاحة تلقائياً من هون.
              تواصل مع فريق الدعم وبيسجلولك بطاقتك يدوياً.
            </p>
            <a
              href="mailto:qaisalraifai@gmail.com?subject=%D8%A5%D8%B6%D8%A7%D9%81%D8%A9%20%D8%B7%D8%B1%D9%8A%D9%82%D8%A9%20%D8%AF%D9%81%D8%B9"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_DARK})`,
                color: "#1a1608",
                fontWeight: 800,
                fontSize: 13,
                padding: "0.6rem 1.3rem",
                borderRadius: 10,
                textDecoration: "none",
              }}
            >
              <span>💬</span><span>تواصل مع الدعم</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
