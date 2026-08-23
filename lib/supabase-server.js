import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/* ⚠️ **صارت async بترقية Next 16.**
   ---------------------------------------------------------------------------
   `cookies()` كانت متزامنة لحد Next 14. من 15 صارت بترجّع **Promise**، فنداؤها
   بلا `await` بيعطي كائناً ما فيه `.get` — والخطأ بيطلع بعيداً عن مصدره:

     TypeError: cookieStore.get is not a function   (lib/supabase-server.js)
     Route "/api/live" used `cookies().get`. `cookies()` returns a Promise…

   فصارت الدالة `async`، وكل مناديها (١٣٨ نداء بـ١١٨ ملف) بيعملوا `await`.

   ⚠️ `createAdminClient` تحت **ما تغيّرت** — هي ما بتلمس الكوكيز أصلاً
   (مفتاح خدمة بلا جلسة)، فخلّيها متزامنة عشان ما نضيف `await` بلا سبب. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (e) {
            // يحصل أحياناً بـ Server Components، يمكن تجاهله بأمان
          }
        },
        remove(name, options) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (e) {}
        },
      },
    }
  );
}

// عميل خاص بصلاحيات كاملة (Service Role) - يستخدم فقط داخل API Routes على السيرفر
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
