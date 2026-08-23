import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { getStudentBatchId } from "@/lib/student-batch";

const MAX_LEN = 2000;
const PAGE_SIZE = 50;

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

// GET /api/batches/chat?course_id=... — آخر رسائل دردشة دفعة الطالب لهاي الدورة
// (نفس منطق فلترة المحتوى بالمرحلة 6: كل طالب يشوف بس دردشة دفعته)
export async function GET(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("course_id");
  if (!courseId) return NextResponse.json({ error: "لازم تحددي الدورة" }, { status: 400 });

  const batchId = await getStudentBatchId(user.id, courseId);
  if (!batchId) return NextResponse.json({ messages: [], batch_id: null, my_user_id: user.id });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("batch_chat_messages")
    .select("id, user_id, message, created_at")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const messages = await attachSenders(admin, (data || []).slice().reverse());

  return NextResponse.json({ messages, batch_id: batchId, my_user_id: user.id });
}

// POST /api/batches/chat { course_id, message } — إرسال رسالة بدردشة دفعة الطالب
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const courseId = body?.course_id;
  const message = body?.message?.trim();

  if (!courseId) return NextResponse.json({ error: "لازم تحددي الدورة" }, { status: 400 });
  if (!message) return NextResponse.json({ error: "لازم تكتبي رسالة" }, { status: 400 });
  if (message.length > MAX_LEN) {
    return NextResponse.json({ error: `الرسالة أطول من ${MAX_LEN} حرف` }, { status: 400 });
  }

  const batchId = await getStudentBatchId(user.id, courseId);
  if (!batchId) {
    return NextResponse.json({ error: "لازم تختاري دفعتك بهاي الدورة أول" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("batch_chat_messages")
    .insert({ batch_id: batchId, user_id: user.id, message })
    .select("id, user_id, message, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const [withSender] = await attachSenders(admin, [data]);

  return NextResponse.json({ message: withSender });
}
