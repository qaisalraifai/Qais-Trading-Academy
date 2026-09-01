import { cookies } from "next/headers";
import { GENDER_COOKIE, isValidGender } from "./gender";

/* بتُستعمل جوّا Server Components وبس (متل `app/layout.js`) — نفس دور
   `getServerLocale` بالضبط: قيمة أوّلية قبل أي رندر، فما بيصير «وميض» صيغة
   غلط أول تحميل.

   ⚠️ بترجّع `null` لما ما يكون في كوكي — و`null` قيمة **مشروعة** معناها
   «حساب قديم أو زائر»، وبتقع على المذكّر (نصّ المنصّة الحالي). فما في مسار
   بينكسر لو غابت. */
export function getServerGender() {
  const stored = cookies().get(GENDER_COOKIE)?.value;
  return isValidGender(stored) ? stored : null;
}
