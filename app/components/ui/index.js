/* ============================================================================
   ORBIT — نقطة الاستيراد الوحيدة لنظام التصميم.
   أي صفحة جديدة لازم تستورد من هون، وما تكتب style={{ }} أبداً.
   ============================================================================ */

/* ---------- الأسطح ---------- */
export {
  default as Module,
  ModuleHeader,
  ModuleTitle,
  ModuleBody,
  ModuleFooter,
  ModuleRow,
} from "./Module";
export { default as Card, CardHeader, CardTitle, CardDescription } from "./Card";

/* ---------- التحكّم ---------- */
export { default as Button, IconButton } from "./Button";
export { default as Input, Textarea, Select, Field, Switch } from "./Input";
export { default as Tabs } from "./Tabs";
export {
  default as Dropdown,
  DropdownItem,
  DropdownSeparator,
  DropdownLabel,
} from "./Dropdown";

/* ---------- عرض البيانات ---------- */
export { default as Stat, StatGrid, StatCell, KeyValue } from "./Stat";
export { default as Badge, Delta } from "./Badge";
export { default as ProgressBar, OrbitRing } from "./ProgressBar";
export { default as Avatar } from "./Avatar";
export {
  Table,
  TableHead,
  TableTh,
  TableBody,
  TableRow,
  TableTd,
  TableEmpty,
} from "./Table";

/* ---------- الطبقات العائمة ---------- */
export { default as Modal } from "./Modal";
export { default as Tooltip } from "./Tooltip";
export { ToastProvider, useToast, Callout } from "./Toast";

/* ---------- الحالات ---------- */
export {
  default as Skeleton,
  SkeletonCard,
  SkeletonText,
  SkeletonStatGrid,
} from "./Skeleton";
export { default as EmptyState } from "./EmptyState";
