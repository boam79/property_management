"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ASSET_STATUS_LABELS,
  ASSET_TYPE_LABELS,
} from "@/lib/constants";
import type { AssetStatus, AssetType, DashboardStats } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const COLORS = ["#0f766e", "#0369a1", "#b45309", "#be123c", "#4f46e5"];
const CHART_H = 160;
const LINE_H = 140;

export function DashboardCharts({ stats }: { stats: DashboardStats }) {
  const byType = stats.by_type.map((d) => ({
    name: ASSET_TYPE_LABELS[d.key as AssetType] ?? d.key,
    count: d.count,
  }));
  const byStatus = stats.by_status.map((d) => ({
    name: ASSET_STATUS_LABELS[d.key as AssetStatus] ?? d.key,
    count: d.count,
  }));
  const byLocation = stats.by_location.map((d) => ({
    name: d.key,
    count: d.count,
  }));
  const byQr = stats.by_qr_link.map((d) => ({
    name: d.key === "linked" ? "연결" : "미연결",
    count: d.count,
  }));
  const daily = stats.daily_created.map((d) => ({
    date: d.date,
    count: d.count,
  }));

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <ChartCard title="자산 구분별 분포">
        <EmptyOrChart empty={byType.every((d) => d.count === 0)}>
          <ResponsiveContainer width="100%" height={CHART_H}>
            <PieChart>
              <Pie
                data={byType}
                dataKey="count"
                nameKey="name"
                outerRadius={56}
                label
              >
                {byType.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </EmptyOrChart>
      </ChartCard>

      <ChartCard title="자산 상태별 분포">
        <EmptyOrChart empty={byStatus.length === 0}>
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart data={byStatus} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#0f766e" name="수량" />
            </BarChart>
          </ResponsiveContainer>
        </EmptyOrChart>
      </ChartCard>

      <ChartCard title="위치별 자산 수 (상위 10)">
        <EmptyOrChart empty={byLocation.length === 0}>
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart
              data={byLocation}
              layout="vertical"
              margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={56}
                tick={{ fontSize: 11 }}
              />
              <Tooltip />
              <Bar dataKey="count" fill="#0369a1" name="수량" />
            </BarChart>
          </ResponsiveContainer>
        </EmptyOrChart>
      </ChartCard>

      <ChartCard title="QR 연결 현황">
        <EmptyOrChart empty={byQr.every((d) => d.count === 0)}>
          <ResponsiveContainer width="100%" height={CHART_H}>
            <PieChart>
              <Pie
                data={byQr}
                dataKey="count"
                nameKey="name"
                outerRadius={56}
                label
              >
                {byQr.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </EmptyOrChart>
      </ChartCard>

      <ChartCard title="최근 30일 등록 추이" className="sm:col-span-2 xl:col-span-4">
        <EmptyOrChart empty={daily.length === 0} height={LINE_H}>
          <ResponsiveContainer width="100%" height={LINE_H}>
            <LineChart data={daily} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#0f766e"
                name="신규"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </EmptyOrChart>
      </ChartCard>
    </div>
  );
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
  height = CHART_H,
}: {
  empty: boolean;
  children: React.ReactNode;
  height?: number;
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
