import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { getVerifiedUserId } from "@/lib/auth-context";
import { getStudentBatchId } from "@/lib/student-batch";
import CalendarClient from "./CalendarClient";

// المرحلة 14: صفحة تقويم تجمع كل مواعيد دفعة الطالب (بداية/نهاية الدفعة، البثوث
// المباشرة، ومواعيد تسليم الواجبات) بشكل مرئي منظّم. ما فيها أي جدول جديد —
// بس تجميع لبيانات موجودة أصلاً من مراحل سابقة.
export default async function BatchCalendarPage({ params }) {
  const supabase = await createClient();
  /* الهوية من ترويسة الـmiddleware المتحقَّقة — بلا رحلة شبكية
     تانية لنفس الفحص. بترجع لـauth.getUser() لو الترويسة غابت. */
  const userId = await getVerifiedUserId();
  if (!userId) redirect("/login");


  const { data: course } = await supabase.from("courses").select("id, title, icon").eq("id", params.id).single();
  if (!course) redirect("/lecture");

  // نفس منطق المرحلة 6: لازم الطالب يكون فاتح صفحة الدورة واختار/انسجّل بدفعة أول
  const studentBatchId = await getStudentBatchId(userId, params.id);
  if (!studentBatchId) redirect(`/course/${params.id}`);

  const { data: batch } = await supabase
    .from("batches")
    .select("id, name, start_date, end_date")
    .eq("id", studentBatchId)
    .maybeSingle();

  const { data: liveSessions } = await supabase
    .from("live_sessions")
    .select("id, title, started_at, is_active")
    .eq("batch_id", studentBatchId)
    .order("started_at", { ascending: false });

  const { data: assignments } = await supabase
    .from("batch_assignments")
    .select("id, title, due_date")
    .eq("batch_id", studentBatchId)
    .not("due_date", "is", null);

  const events = [];

  if (batch?.start_date) {
    events.push({ type: "start", date: batch.start_date, title: `بداية دفعة ${batch.name}` });
  }
  if (batch?.end_date) {
    events.push({ type: "end", date: batch.end_date, title: `نهاية دفعة ${batch.name}` });
  }
  (liveSessions || []).forEach((s) => {
    events.push({
      type: "live",
      date: s.started_at,
      title: s.title || "بث مباشر",
      isActive: s.is_active,
    });
  });
  (assignments || []).forEach((a) => {
    events.push({ type: "assignment", date: a.due_date, title: `تسليم: ${a.title}` });
  });

  return (
    <CalendarClient course={course} batch={batch} events={events} />
  );
}
