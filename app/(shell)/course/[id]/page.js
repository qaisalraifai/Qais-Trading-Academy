import { createClient, createAdminClient } from "@/lib/supabase-server";
import { getVerifiedUserId } from "@/lib/auth-context";
import { redirect } from "next/navigation";
import CourseClient from "./CourseClient";
import BatchSelectClient from "./BatchSelectClient";
import { getStudentBatchId } from "@/lib/student-batch";

export default async function CoursePage({ params }) {
  const supabase = await createClient();
  /* الهوية من ترويسة الـmiddleware المتحقَّقة — بلا رحلة شبكية
     تانية لنفس الفحص. بترجع لـauth.getUser() لو الترويسة غابت. */
  const userId = await getVerifiedUserId();
  if (!userId) redirect("/login");


  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!course) redirect("/lecture");

  // أول مرة الطالب يفتح هاي الدورة، لازم يختار دفعته قبل ما يشوف أي محتوى —
  // هاد كان معمول من قبل (BatchSelectClient + getStudentBatchId) بس ما كان
  // مربوط فعليًا بالصفحة. صلّحناها هون.
  const batchId = await getStudentBatchId(userId, params.id);

  if (!batchId) {
    const admin = createAdminClient();
    const { data: links } = await admin.from("batch_courses").select("batch_id").eq("course_id", params.id);
    const batchIds = [...new Set((links || []).map((l) => l.batch_id))];

    let availableBatches = [];
    if (batchIds.length) {
      const { data: batches } = await admin
        .from("batches")
        .select("*")
        .in("id", batchIds)
        .eq("is_archived", false)
        .eq("registration_status", "open")
        .order("start_date", { ascending: true });

      availableBatches = await Promise.all(
        (batches || []).map(async (b) => {
          const { count } = await admin
            .from("batch_enrollments")
            .select("id", { count: "exact", head: true })
            .eq("batch_id", b.id);
          const seatsTaken = count || 0;
          return {
            ...b,
            seats_remaining: b.seats_total == null ? null : Math.max(b.seats_total - seatsTaken, 0),
            is_full: b.seats_total != null && seatsTaken >= b.seats_total,
          };
        })
      );
    }

    return (
      <BatchSelectClient course={course} batches={availableBatches} />
    );
  }

  // تحديد batch_course_id الخاص بهاي الدورة داخل دفعة الطالب، عشان نفلتر
  // المحاضرات: حصرية لهاي الدفعة + مشتركة لكل دفعات الدورة (نفس منطق لوحة الإدارة)
  const { data: batchCourseLink } = await supabase
    .from("batch_courses")
    .select("id")
    .eq("batch_id", batchId)
    .eq("course_id", params.id)
    .maybeSingle();
  const batchCourseId = batchCourseLink?.id || null;

  let lectureQuery = supabase
    .from("lectures")
    .select("*")
    .eq("course_id", params.id);

  lectureQuery = batchCourseId
    ? lectureQuery.or(`batch_course_id.is.null,batch_course_id.eq.${batchCourseId}`)
    : lectureQuery.is("batch_course_id", null);

  const { data: lectures } = await lectureQuery
    .order("chapter_order", { ascending: true })
    .order("order_index", { ascending: true });

  const { data: progress } = await supabase
    .from("lecture_progress")
    .select("*")
    .eq("user_id", userId);

  const progressMap = {};
  (progress || []).forEach((p) => {
    progressMap[p.lecture_id] = p;
  });

  // تجميع المحاضرات حسب الفصل مع الحفاظ على ترتيب ظهورها
  const chaptersOrder = [];
  const chaptersMap = new Map();

  (lectures || []).forEach((lecture) => {
    const chapterName = lecture.chapter || "عام";
    if (!chaptersMap.has(chapterName)) {
      chaptersMap.set(chapterName, {
        name: chapterName,
        order: lecture.chapter_order ?? 999,
        lectures: [],
      });
      chaptersOrder.push(chapterName);
    }
    chaptersMap.get(chapterName).lectures.push({
      ...lecture,
      progress: progressMap[lecture.id] || null,
    });
  });

  const chapters = chaptersOrder
    .map((name) => chaptersMap.get(name))
    .sort((a, b) => a.order - b.order);

  return <CourseClient course={course} chapters={chapters} />;
}
