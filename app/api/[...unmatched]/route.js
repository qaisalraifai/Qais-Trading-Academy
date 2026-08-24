import { NextResponse } from "next/server";

/* ============================================================================
   مسار API غير موجود → ٤٠٤ **بصيغة JSON**.

   ---------------------------------------------------------------------------
   ⚠️ بدون هالملف، أي نداء لمسار API مش موجود (خطأ مطبعي بالمسار، أو مسار
   انشال بنسخة جديدة والواجهة لسا بتناديه) بياخد **صفحة ٤٠٤ بـHTML** من
   Next. والواجهة بتناديها بـ`res.json()` فبتطلّع:

       Unexpected token '<', "<!DOCTYPE "... is not valid JSON

   وهاي الرسالة بتخفي السبب تماماً — المستخدم بيشوف عطل مُحلِّل، وإحنا ما
   منعرف إذا المسار غلط ولا الخادم انهار. هلّق بيرجع سبب صريح باسم المسار.

   ---------------------------------------------------------------------------
   ⚠️ **ما بيحجب ولا مسار قائم.** بالـApp Router المقاطع المحدَّدة بتسبق
   المقطع الشامل (`[...]`)، فما بيوصله إلا اللي ما طابق ولا مسار من الـ١٣٩.
   متحقَّق بالتشغيل: كل المسارات القائمة بتضل ترد كما هي.

   ⚠️ وبيغطّي كل الأفعال — نداء `POST` لمسار غلط لازم ياخد JSON زي `GET`.
   ============================================================================ */
function notFound(request) {
  return NextResponse.json(
    {
      error: "المسار المطلوب غير موجود",
      code: "ROUTE_NOT_FOUND",
      path: request?.nextUrl?.pathname ?? null,
    },
    { status: 404 }
  );
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const HEAD = notFound;
export const OPTIONS = notFound;
