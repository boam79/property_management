"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const COLORS = [
  "#0f766e",
  "#0369a1",
  "#b45309",
  "#be123c",
  "#4f46e5",
  "#15803d",
  "#a16207",
  "#7c3aed",
];

export type PurchaseStatPoint = { key: string; count: number };

export function PurchaseStatisticsCharts({
  byMonth,
  byDept,
  byItem,
}: {
  byMonth: PurchaseStatPoint[];
  byDept: PurchaseStatPoint[];
  byItem: PurchaseStatPoint[];
}) {
  const monthTrend = [...byMonth]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((d) => ({ name: d.key.slice(2), count: d.count, full: d.key }));

  const deptBars = byDept.slice(0, 8).map((d) => ({
    name: d.key,
    count: d.count,
  }));

  const deptPie = byDept.slice(0, 8).map((d) => ({
    name: d.key,
    count: d.count,
  }));

  const itemBars = byItem.slice(0, 8).map((d) => ({
    name: truncateLabel(d.key, 14),
    fullName: d.key,
    count: d.count,
  }));

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 md:grid-cols-2 md:grid-rows-2">
      <ChartCard title="월별 추이">
        <EmptyOrChart empty={monthTrend.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={monthTrend}
              margin={{ top: 4, right: 8, left: -8, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-foreground/10"
                vertical={false}
              />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} height={24} />
              <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => [`${value as number}건`, "구매"]}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as { full?: string } | undefined;
                  return row?.full ?? "";
                }}
              />
              <Bar
                dataKey="count"
                name="건수"
                fill="#0f766e"
                radius={[3, 3, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        </EmptyOrChart>
      </ChartCard>

      <ChartCard title="부서 비중">
        <EmptyOrChart empty={deptPie.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Pie
                data={deptPie}
                dataKey="count"
                nameKey="name"
                cx="42%"
                cy="50%"
                innerRadius="38%"
                outerRadius="68%"
                paddingAngle={2}
              >
                {deptPie.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value as number}건`, "구매"]} />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                wrapperStyle={{ fontSize: 11, width: 88, lineHeight: "16px" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </EmptyOrChart>
      </ChartCard>

      <ChartCard title="부서별 건수">
        <EmptyOrChart empty={deptBars.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={deptBars}
              layout="vertical"
              margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-foreground/10"
                horizontal={false}
              />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} height={24} />
              <YAxis
                type="category"
                dataKey="name"
                width={64}
                tick={{ fontSize: 11 }}
              />
              <Tooltip formatter={(value) => [`${value as number}건`, "구매"]} />
              <Bar dataKey="count" name="건수" radius={[0, 3, 3, 0]} maxBarSize={16}>
                {deptBars.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </EmptyOrChart>
      </ChartCard>

      <ChartCard title="품목 상위 8">
        <EmptyOrChart empty={itemBars.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={itemBars}
              layout="vertical"
              margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-foreground/10"
                horizontal={false}
              />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} height={24} />
              <YAxis
                type="category"
                dataKey="name"
                width={88}
                tick={{ fontSize: 10 }}
              />
              <Tooltip
                formatter={(value) => [`${value as number}회`, "구매"]}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as
                    | { fullName?: string; name?: string }
                    | undefined;
                  return row?.fullName ?? row?.name ?? "";
                }}
              />
              <Bar
                dataKey="count"
                name="횟수"
                fill="#0369a1"
                radius={[0, 3, 3, 0]}
                maxBarSize={16}
              />
            </BarChart>
          </ResponsiveContainer>
        </EmptyOrChart>
      </ChartCard>
    </div>
  );
}

function truncateLabel(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function ChartCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      size="sm"
      className={cn("flex min-h-[11rem] flex-col overflow-hidden md:min-h-0", className)}
    >
      <CardHeader className="shrink-0 px-3 py-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-2 pb-2 pt-0">{children}</CardContent>
    </Card>
  );
}

function EmptyOrChart({
  empty,
  children,
}: {
  empty: boolean;
  children: React.ReactNode;
}) {
  if (empty) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
        등록된 데이터가 없습니다
      </p>
    );
  }
  return <div className="h-full w-full">{children}</div>;
}
