import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";
import { kickMemberFromGuild } from "@/lib/discord";

export async function POST(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = params;
  const { action, payload = {} } = await request.json();
  const supabase = createAdminClient();

  switch (action) {
    case "suspend": {
      const { data } = await supabase
        .from("profiles")
        .update({ suspended: true, suspended_reason: payload.reason || null, subscription_status: "inactive" })
        .eq("id", id)
        .select("discord_id")
        .maybeSingle();
      if (data?.discord_id) await kickMemberFromGuild(data.discord_id).catch(() => {});
      await logActivity(id, "suspended", `تم إيقاف الحساب${payload.reason ? `: ${payload.reason}` : ""}`);
      return NextResponse.json({ success: true });
    }

    case "unsuspend": {
      await supabase.from("profiles").update({ suspended: false, suspended_reason: null }).eq("id", id);
      await logActivity(id, "unsuspended", "تم إعادة تفعيل الحساب");
      return NextResponse.json({ success: true });
    }

    case "extend": {
      // payload.days: عدد الأيام المضافة على تاريخ النهاية الحالي (أو من اليوم لو منتهي)
      const days = Number(payload.days) || 30;
      const { data: profile } = await supabase.from("profiles").select("subscription_end").eq("id", id).single();
      const base = profile?.subscription_end && new Date(profile.subscription_end) > new Date()
        ? new Date(profile.subscription_end)
        : new Date();
      base.setDate(base.getDate() + days);
      await supabase
        .from("profiles")
        .update({ subscription_status: "active", subscription_end: base.toISOString() })
        .eq("id", id);
      await logActivity(id, "extended", `تمديد الاشتراك ${days} يوم`, { days });
      return NextResponse.json({ success: true });
    }

    case "discount": {
      // خصم يدوي — يسجل بالـ Timeline فقط (ما بيربط بمزود دفع خارجي)
      const percent = Number(payload.percent) || 0;
      await logActivity(id, "discount", `منح خصم ${percent}%`, { percent, note: payload.note || "" });
      return NextResponse.json({ success: true });
    }

    case "activate_free": {
      // تفعيل وصول مجاني بدون دفع — الحساب يضل role=student، فقط subscription_status=active
      // subscription_end = null يعني ما فيه انتهاء (الكرون جوب ما بيلمسه لأنه بيفحص فقط لما يكون subscription_end أقل من اليوم)
      const now = new Date();
      await supabase
        .from("profiles")
        .update({
          subscription_status: "active",
          subscription_start: now.toISOString(),
          subscription_end: null,
        })
        .eq("id", id);
      await logActivity(id, "free_activation", "تم تفعيل وصول مجاني (بدون دفع) من لوحة التحكم");
      return NextResponse.json({ success: true });
    }

    case "renew": {
      const now = new Date();
      const end = new Date();
      end.setMonth(end.getMonth() + 1);
      await supabase
        .from("profiles")
        .update({ subscription_status: "active", subscription_start: now.toISOString(), subscription_end: end.toISOString() })
        .eq("id", id);
      await supabase.from("payments").insert({
        user_id: id,
        amount: Number(payload.amount) || 0,
        status: "paid",
        method: "manual",
        note: "تجديد يدوي من لوحة التحكم",
      });
      await logActivity(id, "renew", "تجديد يدوي من لوحة التحكم");
      return NextResponse.json({ success: true });
    }

    case "notify": {
      await supabase.from("notifications").insert({
        user_id: id,
        title: payload.title || "إشعار",
        message: payload.message || "",
      });
      await logActivity(id, "note", `إرسال إشعار: ${payload.title || ""}`);
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  }
}
