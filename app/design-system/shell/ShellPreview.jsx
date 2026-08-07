"use client";

import Link from "next/link";
import { WorkspaceShell } from "@/app/components/layout";
import {
  Callout,
  Module,
  ModuleBody,
  ModuleHeader,
  ModuleTitle,
  Stat,
  StatCell,
  StatGrid,
} from "@/app/components/ui";

/* معاينة WorkspaceShell ببيانات وهمية — الرِيل المداري والشريط العلوي.
   بدّل اللغة من الشريط العلوي عشان تتأكد إن التنقّل بينعكس صح. */
export default function ShellPreview() {
  return (
    <WorkspaceShell username="قيس الرفاعي" initials="ق" isAdmin daysLeft={18}>
      <div className="p-4 md:p-6">
        <Callout tone="info" title="معاينة الغلاف" className="mb-5">
          هاي صفحة معاينة ببيانات وهمية. جرّب زرّ الطيّ بالشريط العلوي وبدّل اللغة —
          الرِيل ونقاط المدار وأسهم الطيّ كلها بتنعكس مع اتجاه اللغة.{" "}
          <Link href="/design-system" className="text-ice-200 underline underline-offset-2">
            رجوع لمعرض المكوّنات
          </Link>
        </Callout>

        <StatGrid cols={4} className="mb-5">
          <StatCell>
            <Stat label="رأس المال" value="$52,140" tone="value" sub="من $48,856" />
          </StatCell>
          <StatCell>
            <Stat label="ربح الشهر" value="+$3,284" tone="profit" delta={6.42} />
          </StatCell>
          <StatCell>
            <Stat label="نسبة النجاح" value="64.0%" sub="48 صفقة" />
          </StatCell>
          <StatCell>
            <Stat label="مفتوحة الآن" value="3" tone="ice" sub="تعرّض $8,400" />
          </StatCell>
        </StatGrid>

        <Module level="primary">
          <ModuleHeader meta="30D">
            <ModuleTitle>منطقة الأداة</ModuleTitle>
          </ModuleHeader>
          <ModuleBody>
            <p className="text-sm text-text-secondary">
              كل أداة (Radar، Replay، المحاضرات، التقارير…) بتنعرض هون وبتاخد كامل
              العرض والارتفاع المتبقي.
            </p>
          </ModuleBody>
        </Module>
      </div>
    </WorkspaceShell>
  );
}
