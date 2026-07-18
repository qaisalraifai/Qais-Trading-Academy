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
  Brain,
} from "lucide-react";

export const NAV_ITEMS = [
  { key: "accounts", label: "إدارة الحسابات", icon: Users, view: "accounts", adminOnly: true },
  { key: "live", label: "البث المباشر", icon: Radio, view: "live" },
  { key: "radar", label: "Trading Radar", icon: Radar, view: "radar" },
  { key: "qais-engine", label: "QAIS SK Engine", icon: Brain, view: "qais-engine" },
  { key: "trader-dna", label: "بصمتك كمتداول", icon: Dna, view: "trader-dna" },
  { key: "lectures", label: "المحاضرات", icon: GraduationCap, view: "lectures" },
  { key: "calendar", label: "التقويم الاقتصادي", icon: Calendar, view: "calendar" },
  { key: "replay", label: "Replay التدريب", icon: Target, view: "replay" },
  { key: "strategies", label: "الاستراتيجيات", icon: Puzzle, view: "strategies", comingSoon: true },
  { key: "trades", label: "الصفقات", icon: BarChart3, view: "backtest" },
  { key: "reports", label: "التقارير", icon: FileText, view: "reports" },
  { key: "mlm", label: "شبكتي (الشجرة الثنائية)", icon: TreePine, view: "mlm" },
  { key: "affiliate", label: "برنامج التسويق بالعمولة", icon: Handshake, view: "affiliate" },
  { key: "settings", label: "الإعدادات", icon: Settings, view: "settings" },
];

export const FOOTER_LINKS = [
  { key: "discord", label: "مجتمع Discord", icon: MessageCircle, href: "/discord", color: "discord" },
  { key: "help", label: "مركز المساعدة", icon: HelpCircle, href: null, color: "muted" },
];

export const PLACEHOLDER_LABELS = {
  strategies: "الاستراتيجيات",
  reports: "التقارير",
};

export const HOME_NAV = {
  key: "dashboard",
  label: "لوحة التحكم",
  icon: LayoutDashboard,
  view: "dashboard",
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
