import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import CourseClient from "./CourseClient";

export default async function CoursePage({ params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!course) redirect("/lecture");

  const { data: lectures } = await supabase
    .from("lectures")
    .select("*")
    .eq("course_id", params.id)
    .order("chapter_order", { ascending: true })
    .order("order_index", { ascending: true });

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

  return <CourseClient course={course} chapters={chapters} />;
}
