import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import QuizForm from "@/app/components/QuizForm";
import PageShell from "@/app/components/layout/PageShell";
import { getShellProfile } from "@/lib/shell-profile";

export default async function QuizPage({ params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const shellProfile = await getShellProfile(supabase, user);

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!quiz) redirect("/dashboard");

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("*")
    .eq("quiz_id", quiz.id)
    .order("order_index", { ascending: true });

  return (
    <PageShell {...shellProfile}>
      <div style={styles.container}>
        <h1 style={styles.title}>{quiz.title}</h1>
        <QuizForm quizId={quiz.id} questions={questions || []} studentId={user.id} />
      </div>
    </PageShell>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#080B14",
    color: "#fff",
    direction: "rtl",
    fontFamily: "system-ui, sans-serif",
    padding: "2rem",
    maxWidth: "700px",
    margin: "0 auto",
  },
  title: { marginBottom: "1.5rem" },
};
