import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { assertLiveSessionAccess } from "@/lib/live-access";

// GET /api/live/files?sessionId=...
export async function GET(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId مطلوب" }, { status: 400 });

  const admin = createAdminClient();
  const access = await assertLiveSessionAccess(admin, user.id, sessionId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { data, error } = await admin
    .from("live_files")
    .select("id, file_name, file_url, size_bytes, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ files: data || [] });
}

// POST /api/live/files { sessionId, fileName, fileUrl, sizeBytes } — الرفع الفعلي عالفرونت لـ Supabase Storage،
// وهون منسجّل بس الميتاداتا. بس المدرب/المشرف مسموحلهم.
export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const admin = createAdminClient();
  const payload = await request.json().catch(() => ({}));
  const { sessionId, fileName, fileUrl, sizeBytes } = payload;
  if (!sessionId || !fileName || !fileUrl) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const access = await assertLiveSessionAccess(admin, user.id, sessionId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (access.role === "student") return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  const { data, error } = await admin
    .from("live_files")
    .insert({ session_id: sessionId, uploaded_by: user.id, file_name: fileName, file_url: fileUrl, size_bytes: sizeBytes || null })
    .select("id, file_name, file_url, size_bytes, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ file: data });
}
