import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * يتحقق إنه فيه مستخدم مسجل دخول وإنه دوره "admin".
 * يرجّع { user } لو الكل تمام، أو { error, status } لو في مشكلة.
 * يُستخدم داخل API routes فقط (مش صفحات).
 */
export async function requireAdmin() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "غير مسجل دخول", status: 401 };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "غير مصرّح", status: 403 };
  }

  return { user };
}

/**
 * يستخرج Google Drive file ID من رابط كامل، أو يرجّع النص نفسه لو كان أصلاً ID.
 * يدعم الأشكال:
 *  - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 *  - https://drive.google.com/open?id=FILE_ID
 *  - https://drive.google.com/uc?id=FILE_ID
 *  - FILE_ID مباشرة
 */
export function extractDriveFileId(input) {
  if (!input) return "";
  const trimmed = input.trim();

  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];

  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch) return idParamMatch[1];

  // مش رابط، افترض إنه ID جاهز
  return trimmed;
}
