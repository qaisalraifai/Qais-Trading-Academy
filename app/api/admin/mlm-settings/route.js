import { NextResponse } from "next/server";
import { requireAdmin, requireAdminRole } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";
import { getAllSettings, updateSetting } from "@/lib/mlm-settings";
import { logActivity } from "@/lib/activity-log";

// GET: يرجّع كل إعدادات الخطة الحالية (المبالغ والنسب) لعرضها بلوحة الأدمن
export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const supabaseAdmin = createAdminClient();
  const settings = await getAllSettings(supabaseAdmin);
  return NextResponse.json({ settings });
}

// POST: يعدّل إعداد واحد { key, value }
export async function POST(request) {
  const { user, error, status } = await requireAdminRole([]); // super_admin بس (فارغة = ولا دور إضافي مسموح)
  if (error) return NextResponse.json({ error }, { status });

  const { key, value } = await request.json();
  if (!key || value === undefined || value === null || isNaN(Number(value))) {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  try {
    await updateSetting(supabaseAdmin, key, Number(value));
    await logActivity(user.id, "note", `تعديل إعداد MLM: ${key} = ${value}`, { key, value });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
