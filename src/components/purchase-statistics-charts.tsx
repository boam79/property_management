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
    .map((d) => ({ name: d.key, count: d.count }));

  const deptBars = byDept.slice(0, 12).map((d) => ({
    name: d.key,
    count: d.count,
  }));

  const deptPie = byDept.slice(0, 8).map((d) => ({
    name: d.key,
    count: d.count,
  }));

  const itemBars = byItem.slice(0, 12).map((d) => ({
    name: truncateLabel(d.key, 18),
    fullName: d.key,
    count: d.count,
  }));

  const deptChartH = Math.max(220, deptBars.length * 28);
  const itemChartH = Math.max(220, itemBars.length * 28);

  return (
    <div className="grid gap-4">
      <ChartCard title="월별 구매 추이">
        <EmptyOrChart empty={monthTrend.length === 0} height={220}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={monthTrend}
              margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-foreground/10" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} width={32} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [`${value as number}건`, "구매"]}
                labelFormatter={(label) => `${label}`}
              />
              <Bar
                dataKey="count"
                name="건수"
                fill="#0f766e"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        </EmptyOrChart>
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="부서별 구매건수">
          <EmptyOrChart empty={deptBars.length === 0} height={deptChartH}>
            <ResponsiveContainer width="100%" height={deptChartH}>
              <BarChart
                data={deptBars}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-foreground/10"
                  horizontal={false}
                />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={72}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip formatter={(value) => [`${value as number}건`, "구매"]} />
                <Bar dataKey="count" name="건수" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {deptBars.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </EmptyOrChart>
        </ChartCard>

        <ChartCard title="부서 비중">
          <EmptyOrChart empty={deptPie.length === 0} height={260}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={deptPie}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="48%"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={2}
                >
                  {deptPie.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value as number}건`, "구매"]} />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(value) => (
                    <span className="text-foreground">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </EmptyOrChart>
        </ChartCard>
      </div>

      <ChartCard title="품목별 구매횟수 (상위 12)">
        <EmptyOrChart empty={itemBars.length === 0} height={itemChartH}>
          <ResponsiveContainer width="100%" height={itemChartH}>
            <BarChart
              data={itemBars}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-foreground/10"
                horizontal={false}
              />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                tick={{ fontSize: 11 }}
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
                radius={[0, 4, 4, 0]}
                maxBarSize={22}
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
    <Card size="sm" className={cn(className)}>
      <CardHeader className="pb-0">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyOrChart({
  empty,
  children,
  height,
}: {
  empty: boolean;
  children: React.ReactNode;
  height: number;
}) {
  if (empty) {
    return (
      <p
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        등록된 데이터가 없습니다
      </p>
    );
  }
  return children;
}
