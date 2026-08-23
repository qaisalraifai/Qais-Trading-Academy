/** @type {import('next').NextConfig} */

/* ============================================================================
   ⚠️ **كان هون إعداد `webpack` وانشال بترقية Next 16.**

   كل اللي كان يعمله: `config.resolve.alias['@'] = __dirname` — وهو **مكرَّر**
   أصلاً، لأن `jsconfig.json` بيعرّف نفس الشي (`paths: { "@/*": ["./*"] }`)
   وNext بيقراه لحاله.

   وNext 16 بيشتغل على Turbopack افتراضياً، فوجود إعداد `webpack` بلا إعداد
   `turbopack` مقابل بيوقف البناء بخطأ صريح («This build is using Turbopack,
   with a `webpack` config and no `turbopack` config»). فالحل مش ترجمة
   الإعداد لـTurbopack — هو حذفه، لأنه ما كان يضيف شي من الأساس.

   ⚠️ متحقَّق: البناء بيمرق والاستيرادات بـ`@/` بتنحلّ عادي.
   ============================================================================ */
const nextConfig = {
  /* ⚠️ `dukascopy-node` بتنترك خارج التحزيم عمداً.
     -----------------------------------------------------------------------
     تبعيتها `fastest-validator` فيها `require()` **اختيارية** لـ`prettier`
     و`cli-highlight` — بتستعملهن بس لتجميل رسائل الأخطاء، وبتتعامل مع
     غيابهن عادي وقت التشغيل.

     webpack كان يتسامح معهن. Turbopack (الافتراضي من Next 16) بيعتبرهن
     استيرادات ناقصة ويوقف البناء:

       Module not found: Can't resolve 'cli-highlight'
       Module not found: Can't resolve 'prettier'

     الحل مش تثبيتهن (تضخيم بلا سبب) — هو إخراج الحزمة من التحزيم أصلاً،
     فبتنطلب وقت التشغيل من `node_modules` زي أي حزمة خادم عادية، وبتضل
     الـ`require` الاختيارية تفشل بهدوء زي ما مصمَّمة. */
  serverExternalPackages: ["dukascopy-node"],
};

module.exports = nextConfig;
