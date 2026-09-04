/* ═══════════════════════════════════════════════════════════════════════════
   مولّد فيديو الريلز — من مشهد HTML لملف MP4
   ---------------------------------------------------------------------------
   الفكرة: كروم بيصوّر إطاراً لكل لحظة، وffmpeg بيخيّطهن فيديو.

   ⚠️ **`--virtual-time-budget` مش انتظاراً حقيقياً** — وهاد جوهر الشغلة.
   الراية بتقدّم **ساعة الصفحة الافتراضية** بالمقدار المطلوب وبعدين بتصوّر.
   يعني الإطار رقم ٣٦٠ بيطلع نفسه بالضبط سواء الجهاز سريع أو بطيء أو
   مشغول. لو استعملنا انتظاراً حقيقياً (`setTimeout` أو تسجيل شاشة)، كل
   تشغيل بيعطي توقيتاً مختلف — وبتصير إعادة الإنتاج مستحيلة.

   ⚠️ **وما بنستعمل تسجيل شاشة إطلاقاً.** OBS بيسجّل اللي الشاشة بترسمه:
   فيه إسقاط إطارات لو انشغل الجهاز، وفيه ضغط، وبيتأثر بمقاس النافذة. هون
   كل إطار بينرسم لحاله بدقّة كاملة، فالنتيجة ١٠٨٠×١٩٢٠ نظيفة ومكرَّرة.

   ⚠️ **بطيء عمداً** — كل إطار تشغيل كروم مستقل (~١.٥ ثانية). ٢٤ ثانية على
   ٣٠ إطار = ٧٢٠ تشغيل ≈ ١٥–٢٠ دقيقة. البديل (متصفّح واحد بـCDP) بده
   تبعية جديدة، والمشروع ما بيقبل تبعيات اختبار/أدوات.

   الاستعمال:
     node marketing/render-reel.cjs reels/reel-01-train-your-eye.html
     node marketing/render-reel.cjs <ملف> --fps 30 --dur 24 --out اسم.mp4
   ═══════════════════════════════════════════════════════════════════════════ */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

/* ── إيجاد الأدوات ─────────────────────────────────────────────────────────
   ⚠️ ما بنعتمد على PATH: winget بيثبّت ffmpeg بس الـPATH ما بيتحدّث إلا
   بجلسة طرفية جديدة — فأول تشغيل بعد التثبيت كان بيفشل بلا سبب واضح. */
function findChrome() {
  const c = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];
  for (const p of c) if (fs.existsSync(p)) return p;
  throw new Error("ما لقيت Chrome");
}
function findFfmpeg() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return "ffmpeg";
  } catch {}
  const base = path.join(os.homedir(), "AppData/Local/Microsoft/WinGet/Packages");
  if (fs.existsSync(base)) {
    for (const d of fs.readdirSync(base)) {
      if (!/ffmpeg/i.test(d)) continue;
      const stack = [path.join(base, d)];
      while (stack.length) {
        const cur = stack.pop();
        for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
          const full = path.join(cur, e.name);
          if (e.isDirectory()) stack.push(full);
          else if (e.name.toLowerCase() === "ffmpeg.exe") return full;
        }
      }
    }
  }
  throw new Error("ما لقيت ffmpeg — شغّل: winget install --id Gyan.FFmpeg -e");
}

/* ── الوسائط ── */
const args = process.argv.slice(2);
const file = args[0];
if (!file) {
  console.error("الاستعمال: node marketing/render-reel.cjs <ملف.html> [--fps 30] [--dur 24] [--out اسم.mp4]");
  process.exit(1);
}
const opt = (name, dflt) => {
  const i = args.indexOf("--" + name);
  return i === -1 ? dflt : args[i + 1];
};
const FPS = Number(opt("fps", 30));
const DUR = Number(opt("dur", 24));
const HTML = path.resolve(process.cwd(), file);
const OUT = path.resolve(process.cwd(), opt("out", path.join(
  path.dirname(HTML), path.basename(HTML).replace(/\.html$/, ".mp4"))));

if (!fs.existsSync(HTML)) { console.error("ما لقيت الملف: " + HTML); process.exit(1); }

const CHROME = findChrome();
const FFMPEG = findFfmpeg();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "qta-reel-"));
const url = "file:///" + HTML.replace(/\\/g, "/");
const total = Math.round(DUR * FPS);

console.log(`المشهد : ${path.basename(HTML)}`);
console.log(`الإطارات: ${total} (${DUR}s × ${FPS}fps)  ·  المخرج: ${path.basename(OUT)}`);
console.log(`ffmpeg  : ${FFMPEG === "ffmpeg" ? "من PATH" : FFMPEG}\n`);

const t0 = Date.now();
for (let i = 0; i < total; i++) {
  const ms = Math.round((i / FPS) * 1000);
  const dest = path.join(TMP, `f${String(i).padStart(5, "0")}.png`);
  execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars",
    `--screenshot=${dest}`,
    "--window-size=1080,1920",
    /* ⚠️ الحد الأدنى ١٢٠٠ms: الخطوط بتنجلب من الشبكة والميزانية بتشملها.
       أقل من هيك بتطلع أول الإطارات بخط النظام الاحتياطي — يعني أول ثانية
       بالفيديو بخط غلط. فالإطارات الأولى بتنرسم عند ١٢٠٠ms «افتراضية»،
       والحركة عندها لسا ببدايتها فما في فرق بصري. */
    `--virtual-time-budget=${Math.max(ms, 1200)}`,
    "--default-background-color=050308",
    url,
  ], { stdio: "ignore" });

  if (i % 30 === 0 || i === total - 1) {
    const pct = (((i + 1) / total) * 100).toFixed(0);
    const el = (Date.now() - t0) / 1000;
    const eta = el / (i + 1) * (total - i - 1);
    process.stdout.write(`\r  ${pct}%  ${i + 1}/${total}  ·  باقي ~${Math.round(eta / 60)} دقيقة   `);
  }
}
console.log("\n\nالتخييط...");

execFileSync(FFMPEG, [
  "-y", "-framerate", String(FPS),
  "-i", path.join(TMP, "f%05d.png"),
  /* yuv420p + الأبعاد الزوجية = يشتغل على كل مشغّل ومنصّة. بلاها إنستغرام
     وتيك توك بيرفضوا الملف أو بيعرضوه مقلوب الألوان. */
  "-c:v", "libx264", "-pix_fmt", "yuv420p",
  "-crf", "17", "-preset", "slow",
  "-movflags", "+faststart",
  OUT,
], { stdio: ["ignore", "ignore", "inherit"] });

fs.rmSync(TMP, { recursive: true, force: true });
const kb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
console.log(`\n✓ ${OUT}\n  ${kb} MB  ·  ${DUR}s  ·  1080×1920  ·  ${FPS}fps`);
