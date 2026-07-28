import { createClient, createAdminClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import CourseClient from "./CourseClient";
import BatchSelectClient from "./BatchSelectClient";
import PageShell from "@/app/components/layout/PageShell";
import { getShellProfile } from "@/lib/shell-profile";

export default async function CoursePage({ params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const shellProfile = await getShellProfile(supabase, user);

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!course) redirect("/lecture");

  // ---------- المرحلة 5: اختيار الدفعة أول مرة يفتح فيها الطالب الدورة ----------
  const admin = createAdminClient();

  const { data: enrollment } = await admin
    .from("batch_enrollments")
    .select("batch_id")
    .eq("user_id", user.id)
    .eq("course_id", params.id)
    .maybeSingle();

  // هاي الدفعة اللي رح تفلتر عليها كل محتوى الدورة تحت (المرحلة 6)
  let studentBatchId = enrollment?.batch_id || null;

  if (!enrollment) {
    // فيه دفعات حقيقية (غير الافتراضية) مفتوحة للتسجيل لهاي الدورة؟
    const { data: openBatches } = await admin
      .from("batches")
      .select("*")
      .eq("course_id", params.id)
      .eq("is_default", false)
      .eq("is_archived", false)
      .eq("registration_status", "open")
      .order("start_date", { ascending: true });

    if (openBatches && openBatches.length > 0) {
      const batchIds = openBatches.map((b) => b.id);
      const { data: enrollments } = await admin
        .from("batch_enrollments")
        .select("batch_id")
        .in("batch_id", batchIds);

      const counts = (enrollments || []).reduce((acc, r) => {
        acc[r.batch_id] = (acc[r.batch_id] || 0) + 1;
        return acc;
      }, {});

      const enrichedBatches = openBatches.map((b) => {
        const taken = counts[b.id] || 0;
        return {
          id: b.id,
          name: b.name,
          start_date: b.start_date,
          end_date: b.end_date,
          seats_total: b.seats_total,
          seats_remaining: b.seats_total == null ? null : Math.max(b.seats_total - taken, 0),
          is_full: b.seats_total != null && taken >= b.seats_total,
        };
      });

      return (
        <PageShell {...shellProfile}>
          <BatchSelectClient course={course} batches={enrichedBatches} />
        </PageShell>
      );
    }

    // ما في دفعات حقيقية مفتوحة لهاي الدورة لسا — نسجّل الطالب تلقائيًا
    // بالدفعة الافتراضية بصمت (استمرارية بدون احتكاك)، لحد ما الأدمن ينشئ
    // دفعات فعلية، عندها بتظهرله شاشة الاختيار فعليًا
    const { data: defaultBatch } = await admin
      .from("batches")
      .select("id")
      .eq("course_id", params.id)
      .eq("is_default", true)
      .maybeSingle();

    if (defaultBatch) {
      await admin.from("batch_enrollments").insert({
        user_id: user.id,
        batch_id: defaultBatch.id,
        course_id: params.id,
      });
      studentBatchId = defaultBatch.id;
    }
  }
  // ---------------------------------------------------------------------------

  // ---------- المرحلة 6: عرض محتوى دفعة الطالب بس، مو كل محتوى الدورة ----------
  let lecturesQuery = supabase
    .from("lectures")
    .select("*")
    .eq("course_id", params.id)
    .order("chapter_order", { ascending: true })
    .order("order_index", { ascending: true });

  if (studentBatchId) {
    lecturesQuery = lecturesQuery.eq("batch_id", studentBatchId);
  }

  const { data: lectures } = await lecturesQuery;
  // ---------------------------------------------------------------------------

  const { data: progress } = await supabase
    .from("lecture_progress")
    .select("*")
    .eq("user_id", user.id);

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

  return (
    <PageShell {...shellProfile}>
      <CourseClient course={course} chapters={chapters} />
    </PageShell>
  );
}
