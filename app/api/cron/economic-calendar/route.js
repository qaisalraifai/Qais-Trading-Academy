import { refreshEconomicCalendar } from "@/lib/economic-calendar";

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshEconomicCalendar();
    return Response.json({ success: true, ...result });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
