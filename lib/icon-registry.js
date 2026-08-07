/* ============================================================
   سجل الأيقونات — Icon Registry
   ------------------------------------------------------------
   بعض الأيقونات محفوظة كنص بقاعدة البيانات (شارات المستويات،
   الإنجازات، أيقونات الكورسات). بدل ما نخزّن إيموجي، منخزّن
   اسم أيقونة من Lucide ومنحوّله لمكوّن وقت العرض.

   الصفوف القديمة يلي لسا فيها إيموجي رح ترجع الأيقونة
   الافتراضية تلقائياً — بدون أي تعديل على قاعدة البيانات.
   ============================================================ */

import {
  Award,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Brain,
  Briefcase,
  CandlestickChart,
  CircleDollarSign,
  Coins,
  Compass,
  Crown,
  Diamond,
  Flag,
  Gem,
  GraduationCap,
  Handshake,
  Landmark,
  LineChart,
  Medal,
  Rocket,
  Scale,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

/* الأسماء المسموحة — نفس الأسماء يلي بتنحفظ بقاعدة البيانات */
export const ICON_REGISTRY = {
  award: Award,
  "badge-check": BadgeCheck,
  "bar-chart": BarChart3,
  "book-open": BookOpen,
  brain: Brain,
  briefcase: Briefcase,
  candlestick: CandlestickChart,
  coins: Coins,
  compass: Compass,
  crown: Crown,
  diamond: Diamond,
  dollar: CircleDollarSign,
  flag: Flag,
  gem: Gem,
  "graduation-cap": GraduationCap,
  handshake: Handshake,
  landmark: Landmark,
  "line-chart": LineChart,
  medal: Medal,
  rocket: Rocket,
  scale: Scale,
  shield: Shield,
  "shield-check": ShieldCheck,
  sparkles: Sparkles,
  star: Star,
  target: Target,
  "trending-up": TrendingUp,
  trophy: Trophy,
  users: Users,
  wallet: Wallet,
  zap: Zap,
};

/* قائمة جاهزة لقوائم الاختيار بلوحة الإدارة */
export const ICON_OPTIONS = Object.keys(ICON_REGISTRY);

/**
 * بترجّع مكوّن أيقونة من الاسم المحفوظ.
 * إذا الاسم فاضي أو غير معروف (مثلاً صف قديم فيه إيموجي)
 * بترجّع الأيقونة الافتراضية بدل ما تعرض نص عشوائي.
 */
export function resolveIcon(name, fallback = Medal) {
  if (!name || typeof name !== "string") return fallback;
  return ICON_REGISTRY[name.trim().toLowerCase()] || fallback;
}

/* أيقونات مراتب المستويات حسب الترتيب — Bronze → Silver → Gold → ... */
const TIER_LADDER = [Shield, ShieldCheck, Medal, Award, Trophy, Crown, Gem];

/**
 * بتختار أيقونة مناسبة لمستوى تسويقي:
 * بتحترم badge_icon إذا كان اسم صالح، وإلا بتشتق وحدة من ترتيب المستوى.
 */
export function resolveTierIcon(tier) {
  if (!tier) return Shield;
  const explicit = tier.badge_icon && ICON_REGISTRY[String(tier.badge_icon).trim().toLowerCase()];
  if (explicit) return explicit;
  const order = Number(tier.sort_order);
  if (Number.isFinite(order) && order >= 0) return TIER_LADDER[Math.min(order, TIER_LADDER.length - 1)];
  return Shield;
}
