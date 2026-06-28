import { createClient } from "@supabase/supabase-js";

export async function GET(request) {
  // تحقق من Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const now = new Date().toISOString();

  // حجب كل من انتهى اشتراكه
  const { data, error } = await supabase
    .from("profiles")
    .update({ subscription_status: "inactive" })
    .eq("subscription_status", "active")
    .lt("subscription_end", now);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ 
    success: true, 
    deactivated: data?.length || 0,
    timestamp: now 
  });
}
