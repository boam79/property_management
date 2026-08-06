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

const COLORS = ["#0f766e", "#0369a1", "#b45309", "#be123c", "#4f46e5"];

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
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="자산 구분별 분포">
        <EmptyOrChart empty={byType.every((d) => d.count === 0)}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={byType} dataKey="count" nameKey="name" outerRadius={80} label>
                {byType.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </EmptyOrChart>
      </ChartCard>

      <ChartCard title="자산 상태별 분포">
        <EmptyOrChart empty={byStatus.length === 0}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byStatus}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#0f766e" name="수량" />
            </BarChart>
          </ResponsiveContainer>
        </EmptyOrChart>
      </ChartCard>

      <ChartCard title="위치별 자산 수 (상위 10)">
        <EmptyOrChart empty={byLocation.length === 0}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byLocation} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={80} />
              <Tooltip />
              <Bar dataKey="count" fill="#0369a1" name="수량" />
            </BarChart>
          </ResponsiveContainer>
        </EmptyOrChart>
      </ChartCard>

      <ChartCard title="QR 연결 현황">
        <EmptyOrChart empty={byQr.every((d) => d.count === 0)}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={byQr} dataKey="count" nameKey="name" outerRadius={80} label>
                {byQr.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </EmptyOrChart>
      </ChartCard>

      <ChartCard title="최근 30일 등록 추이" className="lg:col-span-2">
        <EmptyOrChart empty={daily.length === 0}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#0f766e" name="신규" />
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
    <div
      className={`rounded-xl bg-card p-4 ring-1 ring-foreground/10 ${className ?? ""}`}
    >
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      {children}
    </div>
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
      <p className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        등록된 데이터가 없습니다
      </p>
    );
  }
  return children;
}
