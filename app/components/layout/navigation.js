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
  MessageCircle,
  HelpCircle,
  LogOut,
  Crown,
  Radar,
  Bot,
  Layers,
} from "lucide-react";

/* ============================================================================
   كل عنصر هلأ إله href حقيقي (Workspace مستقلة بمسارها الخاص) بدل ما يكون
   مجرد "تبويب" داخلي بحالة الداشبورد. الـ key محفوظ للتوافق الخلفي (تمييز
   العنصر النشط...) لكن التنقل الفعلي صار عبر Next.js Link حسب المسار الحالي.
   ============================================================================ */
export const NAV_ITEMS = [
  { key: "accounts", label: "إدارة الحسابات", icon: Users, href: "/accounts", adminOnly: true },
  { key: "batches", label: "إدارة الدفعات", icon: Layers, href: "/admin/batches", adminOnly: true },
  { key: "live", label: "البث المباشر", icon: Radio, href: "/live-sessions" },
  { key: "radar", label: "Trading Radar", icon: Radar, href: "/trading-radar" },
  { key: "ai-trades", label: "صفقات QAIS AI", icon: Bot, href: "/ai-trades" },
  { key: "trader-dna", label: "بصمتك كمتداول", icon: Dna, href: "/trader-dna" },
  { key: "lectures", label: "المحاضرات", icon: GraduationCap, href: "/courses" },
  { key: "calendar", label: "التقويم الاقتصادي", icon: Calendar, href: "/economic-calendar" },
  { key: "replay", label: "Replay التدريب", icon: Target, href: "/replay" },
  { key: "trades", label: "الصفقات", icon: BarChart3, href: "/backtest" },
  { key: "reports", label: "التقارير", icon: FileText, href: "/reports" },
  { key: "affiliate", label: "العمولة والشبكة (Affiliate)", icon: Handshake, href: "/affiliate" },
  { key: "settings", label: "الإعدادات", icon: Settings, href: "/settings" },
];

export const FOOTER_LINKS = [
  { key: "discord", label: "مجتمع Discord", icon: MessageCircle, href: "/discord", color: "discord" },
  { key: "help", label: "مركز المساعدة", icon: HelpCircle, href: null, color: "muted" },
];

export const HOME_NAV = {
  key: "dashboard",
  label: "لوحة التحكم",
  icon: LayoutDashboard,
  href: "/dashboard",
};

export const VIP_CARD = {
  title: "VIP حساب",
  subtitle: "Elite Access",
  description: "وصول كامل لجميع الميزات",
  icon: Crown,
};

export const LOGOUT_ITEM = {
  key: "logout",
  label: "تسجيل الخروج",
  icon: LogOut,
};
