import {
  LayoutDashboard,
  Users,
  Radio,
  Dna,
  GraduationCap,
  Calendar,
  Target,
  Puzzle,
  BarChart3,
  FileText,
  Settings,
  TreePine,
  Handshake,
  MessageCircle,
  HelpCircle,
  LogOut,
  Crown,
  Radar,
  Bot,
} from "lucide-react";

/* ============================================================================
   كل عنصر هلأ إله href حقيقي (Workspace مستقلة بمسارها الخاص) بدل ما يكون
   مجرد "تبويب" داخلي بحالة الداشبورد. الـ key محفوظ للتوافق الخلفي (تمييز
   العنصر النشط...) لكن التنقل الفعلي صار عبر Next.js Link حسب المسار الحالي.
   label = fallback عربي ثابت (يُستخدم فقط لو المكوّن ما بعده مربوط بـ useLocale)،
   labelKey = مفتاح الترجمة الفعلي بـ nav.* (استخدمه دايماً عبر t(item.labelKey)).
   ============================================================================ */
export const NAV_ITEMS = [
  { key: "accounts", label: "إدارة الحسابات", labelKey: "nav.accounts", icon: Users, href: "/accounts", adminOnly: true },
  { key: "live", label: "البث المباشر", labelKey: "nav.live", icon: Radio, href: "/live-sessions" },
  { key: "radar", label: "Trading Radar", labelKey: "nav.radar", icon: Radar, href: "/trading-radar" },
  { key: "ai-trades", label: "صفقات QAIS AI", labelKey: "nav.aiTrades", icon: Bot, href: "/ai-trades" },
  { key: "ai-trades-history", label: "سجل صفقات QAIS AI", labelKey: "nav.aiTradesHistory", icon: BarChart3, href: "/ai-trades/history" },
  { key: "trader-dna", label: "بصمتك كمتداول", labelKey: "nav.traderDna", icon: Dna, href: "/trader-dna" },
  { key: "lectures", label: "المحاضرات", labelKey: "nav.lectures", icon: GraduationCap, href: "/courses" },
  { key: "calendar", label: "التقويم الاقتصادي", labelKey: "nav.calendar", icon: Calendar, href: "/economic-calendar" },
  { key: "replay", label: "Replay التدريب", labelKey: "nav.replay", icon: Target, href: "/replay" },
  { key: "strategies", label: "الاستراتيجيات", labelKey: "nav.strategies", icon: Puzzle, href: "/strategies", comingSoon: true },
  { key: "trades", label: "الصفقات", labelKey: "nav.trades", icon: BarChart3, href: "/backtest" },
  { key: "reports", label: "التقارير", labelKey: "nav.reports", icon: FileText, href: "/reports" },
  { key: "mlm", label: "الشبكة (Network)", labelKey: "nav.mlm", icon: TreePine, href: "/mlm" },
  { key: "affiliate", label: "برنامج التسويق بالعمولة", labelKey: "nav.affiliate", icon: Handshake, href: "/affiliate" },
  { key: "settings", label: "الإعدادات", labelKey: "nav.settings", icon: Settings, href: "/settings" },
];

export const FOOTER_LINKS = [
  { key: "discord", label: "مجتمع Discord", labelKey: "footer.discord", icon: MessageCircle, href: "/discord", color: "discord" },
  { key: "help", label: "مركز المساعدة", labelKey: "footer.help", icon: HelpCircle, href: null, color: "muted" },
];

export const HOME_NAV = {
  key: "dashboard",
  label: "لوحة التحكم",
  labelKey: "nav.dashboard",
  icon: LayoutDashboard,
  href: "/dashboard",
};

export const VIP_CARD = {
  title: "VIP حساب",
  titleKey: "vip.title",
  subtitle: "Elite Access",
  subtitleKey: "vip.subtitle",
  description: "وصول كامل لجميع الميزات",
  descriptionKey: "vip.description",
  icon: Crown,
};

export const LOGOUT_ITEM = {
  key: "logout",
  label: "تسجيل الخروج",
  labelKey: "nav.logout",
  icon: LogOut,
};
