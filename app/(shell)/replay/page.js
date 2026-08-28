import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { getVerifiedUserId } from "@/lib/auth-context";
import ReplayWorkspace from "./ReplayWorkspace";

export const dynamic = "force-dynamic";

// Workspace مستقلة لـ "Replay التدريب" — شارت + أدوات التحكم بالريبلاي + اليومية
// (Journal) + AI Coach + الإحصائيات. المكوّن (ReplayClient) لم يتغيّر إطلاقاً.
export default async function ReplayPage() {
  const supabase = createClient();
  /* الهوية من ترويسة الـmiddleware المتحقَّقة — بلا رحلة شبكية
     تانية لنفس الفحص. بترجع لـauth.getUser() لو الترويسة غابت. */
  const userId = await getVerifiedUserId();
  if (!userId) redirect("/login");


  /* ⚠️ `ReplayWorkspace` غلاف رقيق: بالوضع الافتراضي (شارت واحد) بيرسم نفس
     `ReplayClient` بنفس الـprops القديمة تماماً — صفر تغيير بالسلوك. */
  return (
    <ReplayWorkspace userId={userId} />
  );
}
