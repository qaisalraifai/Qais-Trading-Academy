import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

const MAX_LEN = 2000;
const PAGE_SIZE = 200;

async function attachSenders(admin, messages) {
  const userIds = [...new Set((messages || []).map((m) => m.user_id))];
  let profilesMap = {};
  if (userIds.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, username, role")
      .in("id", userIds);
    (profiles || []).forEach((p) => {
      profilesMap[p.id] = p;
    });
  }
  return (messages || []).map((m) => ({
    ...m,
    sender_name: profilesMap[m.user_id]?.username || "مستخدم",
    sender_role: profilesMap[m.user_id]?.role === "admin" ? "admin" : "student",
  }));
}

// GET /api/admin/batches/[id]/chat — آخر رسائل دردشة هاي الدفعة (بيقدر يشوفها أي أدمن/مدرب)
export async function GET(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createAdminClient();

  const { data: batch } = await admin.from("batches").select("id").eq("id", params.id).maybeSingle();
  if (!batch) return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });

  const { data, error } = await admin
    .from("batch_chat_messages")
    .select("id, user_id, message, created_at")
    .eq("batch_id", params.id)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const messages = await attachSenders(admin, (data || []).slice().reverse());

  return NextResponse.json({ messages });
}

// POST /api/admin/batches/[id]/chat { message } — إرسال رسالة كمدرب/أدمن بدردشة الدفعة
export async function POST(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createAdminClient();

  const { data: batch } = await admin.from("batches").select("id").eq("id", params.id).maybeSingle();
  if (!batch) return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const message = body?.message?.trim();
  if (!message) return NextResponse.json({ error: "لازم تكتبي رسالة" }, { status: 400 });
  if (message.length > MAX_LEN) {
    return NextResponse.json({ error: `الرسالة أطول من ${MAX_LEN} حرف` }, { status: 400 });
  }

  const { data, error } = await admin
    .from("batch_chat_messages")
    .insert({ batch_id: params.id, user_id: auth.user.id, message })
    .select("id, user_id, message, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const [withSender] = await attachSenders(admin, [data]);

  return NextResponse.json({ message: withSender });
}
