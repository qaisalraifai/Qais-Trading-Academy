import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { refreshEconomicCalendar } from "@/lib/economic-calendar";

export async function POST() {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const result = await refreshEconomicCalendar();
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
