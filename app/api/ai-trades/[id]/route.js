import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

// GET /api/ai-trades/[id] — تفاصيل صفقة QAIS AI واحدة (لصفحة Trade Details)
export async function GET(request, { params }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const admin = createAdminClient();
  const { data: trade, error } = await admin
    .from("qais_ai_trades")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (error || !trade) return NextResponse.json({ error: "الصفقة غير موجودة" }, { status: 404 });

  return NextResponse.json({ trade });
}
