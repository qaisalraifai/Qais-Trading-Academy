import { NextResponse } from "next/server";
import { jsonHandler } from "@/lib/api-guard";
import { requireUser } from "@/lib/api-auth";
import { isAllowedDocument, safeContentType, safeExtension, ALLOWED_DOCUMENT_LABEL } from "@/lib/upload-safety";
import { createAdminClient } from "@/lib/supabase-server";
import { submitManualPayment } from "@/lib/payments/billing-service";

const BUCKET = "payment-proofs";

async function ensureBucket(admin) {
  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: "10MB" });
  }
}

// POST /api/payments/manual/submit
// FormData: transactionId, walletId, network, txid, file (صورة/PDF إثبات التحويل)
async function POSTImpl(request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const formData = await request.formData();
  const transactionId = formData.get("transactionId");
  const walletId = formData.get("walletId");
  const network = formData.get("network");
  const txid = formData.get("txid");
  const file = formData.get("file");

  if (!transactionId || !network) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }
  if (!txid && !file) {
    return NextResponse.json({ error: "لازم ترفع رقم العملية (TXID) أو صورة إثبات على الأقل" }, { status: 400 });
  }

  const admin = createAdminClient();

  let proofImagePath = null;
  if (file && typeof file !== "string") {
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "حجم الملف أكبر من 10MB" }, { status: 400 });
    }
    /* ⚠️ الواجهة بتعلن `accept="image/*,.pdf"` (`app/payment/crypto/page.js`)
       والخادم ما كان يفرضها — فرض خادمي لعقد قائم. */
    if (!isAllowedDocument(file.type)) {
      return NextResponse.json(
        { error: `صيغة غير مدعومة — لازم ${ALLOWED_DOCUMENT_LABEL}`, code: "UNSUPPORTED_FILE_TYPE" },
        { status: 400 }
      );
    }
    await ensureBucket(admin);
    // الامتداد من النوع المتحقَّق مش من اسم الملف اللي بيبعته العميل
    const path = `${user.id}/${transactionId}-${Date.now()}.${safeExtension(file.type, "jpg")}`;
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, Buffer.from(arrayBuffer), {
        contentType: safeContentType(file.type),
        upsert: false,
      });
    if (uploadError) {
      return NextResponse.json({ error: `فشل رفع الصورة: ${uploadError.message}` }, { status: 500 });
    }
    proofImagePath = path;
  }

  try {
    await submitManualPayment({
      userId: user.id,
      transactionId,
      walletId: walletId || null,
      network,
      txid: txid || null,
      proofImagePath,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("submitManualPayment failed:", e.message);
    return NextResponse.json({ error: e.message || "تعذر إرسال إثبات الدفع" }, { status: 400 });
  }
}

export const POST = jsonHandler(POSTImpl);
