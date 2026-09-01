import {
  LayoutDashboard,
  Users,
  Radio,
  Dna,
  GraduationCap,
  Calendar,
  Target,
  BarChart3,
  FileText,
  Settings,
  Handshake,
  HelpCircle,
  LogOut,
  Crown,
  Radar,
  Bot,
  Layers,
  BookOpen,
} from "lucide-react";

/* ============================================================================
   كل عنصر هلأ إله href حقيقي (Workspace مستقلة بمسارها الخاص) بدل ما يكون
   مجرد "تبويب" داخلي بحالة الداشبورد. الـ key محفوظ للتوافق الخلفي (تمييز
   العنصر النشط...) لكن التنقل الفعلي صار عبر Next.js Link حسب المسار الحالي.
   label = fallback عربي ثابت (يُستخدم فقط لو المكوّن ما بعده مربوط بـ useLocale)،
   labelKey = مفتاح الترجمة الفعلي بـ nav.* (استخدمه دايماً عبر t(item.labelKey)).
   ============================================================================ */
/* ============================================================================
   التنقّل مجمّع حسب المهمّة، مش قائمة مسطّحة من 14 عنصر.
   المجموعة بتنعرض كعنوان صغير وقت توسّع الرِيل، وبتنعرض كفاصل خط وقت الطيّ.
   group: "trading" | "learning" | "network" | "admin" | "system"
   ============================================================================ */
export const NAV_GROUPS = [
  { key: "trading", labelKey: "navGroup.trading", label: "التداول" },
  { key: "learning", labelKey: "navGroup.learning", label: "التعلّم" },
  { key: "network", labelKey: "navGroup.network", label: "الشبكة" },
  { key: "admin", labelKey: "navGroup.admin", label: "الإدارة" },
  { key: "system", labelKey: "navGroup.system", label: "النظام" },
];

export const NAV_ITEMS = [
  /* --- التداول --- */
  { key: "radar", group: "trading", label: "Trading Radar", labelKey: "nav.radar", icon: Radar, href: "/trading-radar" },
  { key: "ai-trades", group: "trading", label: "صفقات QAIS AI", labelKey: "nav.aiTrades", icon: Bot, href: "/ai-trades" },
  { key: "replay", group: "trading", label: "استعراض التدريب", labelKey: "nav.replay", icon: Target, href: "/replay" },
  { key: "trades", group: "trading", label: "الصفقات", labelKey: "nav.trades", icon: BarChart3, href: "/backtest" },
  { key: "calendar", group: "trading", label: "التقويم الاقتصادي", labelKey: "nav.calendar", icon: Calendar, href: "/economic-calendar" },

  /* --- التعلّم --- */
  { key: "lectures", group: "learning", label: "المحاضرات", labelKey: "nav.lectures", icon: GraduationCap, href: "/courses" },
  { key: "live", group: "learning", label: "البث المباشر", labelKey: "nav.live", icon: Radio, href: "/live-sessions" },
  { key: "trader-dna", group: "learning", label: "بصمتك كمتداول", labelKey: "nav.traderDna", icon: Dna, href: "/trader-dna" },
  { key: "reports", group: "learning", label: "التقارير", labelKey: "nav.reports", icon: FileText, href: "/reports" },

  /* --- الشبكة --- */
  { key: "affiliate", group: "network", label: "العمولة والشبكة", labelKey: "nav.affiliateNetwork", icon: Handshake, href: "/affiliate" },

  /* --- الإدارة --- */
  { key: "accounts", group: "admin", label: "إدارة الحسابات", labelKey: "nav.accounts", icon: Users, href: "/accounts", adminOnly: true },
  { key: "admin-batches", group: "admin", label: "إدارة الدفعات", labelKey: "nav.adminBatches", icon: Layers, href: "/admin/batches", adminOnly: true },
  { key: "admin-lectures", group: "admin", label: "إدارة المحاضرات", labelKey: "nav.adminLectures", icon: BookOpen, href: "/admin/lectures", adminOnly: true },

  /* --- النظام --- */
  { key: "settings", group: "system", label: "الإعدادات", labelKey: "nav.settings", icon: Settings, href: "/settings" },
];

export const FOOTER_LINKS = [
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
