import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
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
import "./App.css";

type Tab = "list" | "stats" | "settings";

type Purchase = {
  id: string;
  item_name: string;
  purchase_date: string;
  department: string;
  created_at: string;
  updated_at: string;
};

type ListResult = {
  rows: Purchase[];
  total: number;
  page: number;
  page_size: number;
};

type AuthStatus = { enabled: boolean; unlocked: boolean };

type StatPoint = { key: string; count: number };
type DeptTopItem = { department: string; item_name: string; count: number };
type MonthDeptPoint = { month: string; department: string; count: number };
type Stats = {
  total: number;
  this_month: number;
  last_month: number;
  mom_change_pct: number | null;
  this_year: number;
  last_year_same_period: number;
  this_week: number;
  unique_items: number;
  unique_departments: number;
  avg_per_day_30: number;
  peak_month: StatPoint | null;
  by_month: StatPoint[];
  by_dept: StatPoint[];
  by_item: StatPoint[];
  by_weekday: StatPoint[];
  by_day_this_month: StatPoint[];
  by_quarter: StatPoint[];
  top_item_by_dept: DeptTopItem[];
  by_month_dept: MonthDeptPoint[];
};

type UpdateCheckResult = {
  current_version: string;
  latest_version: string;
  notes: string;
  url: string;
  update_available: boolean;
  check_url: string;
  published_at: string | null;
};

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

function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthDeptStacked(stats: Stats) {
  const months = Array.from(new Set(stats.by_month_dept.map((r) => r.month))).sort();
  return months.map((month) => {
    const row: Record<string, string | number> = { name: month.slice(2) };
    for (const d of stats.by_dept) {
      row[d.key] = 0;
    }
    for (const r of stats.by_month_dept) {
      if (r.month === month) row[r.department] = r.count;
    }
    return row;
  });
}

export default function App() {
  const [tab, setTab] = useState<Tab>("list");
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [authError, setAuthError] = useState("");
  const [unlockPw, setUnlockPw] = useState("");
  const [message, setMessage] = useState("");

  const [q, setQ] = useState("");
  const [department, setDepartment] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<ListResult | null>(null);

  const [itemName, setItemName] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [dept, setDept] = useState("");
  const [editing, setEditing] = useState<Purchase | null>(null);

  const [stats, setStats] = useState<Stats | null>(null);

  const [pwEnabled, setPwEnabled] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [dbPath, setDbPath] = useState("");
  const [appVersion, setAppVersion] = useState("");
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);

  const filter = useMemo(
    () => ({
      q: q || null,
      department: department || null,
      from: from || null,
      to: to || null,
      page,
      page_size: 50,
    }),
    [q, department, from, to, page]
  );

  const refreshAuth = useCallback(async () => {
    const status = await invoke<AuthStatus>("get_auth_status");
    setAuth(status);
    setPwEnabled(status.enabled);
  }, []);

  const refreshList = useCallback(async () => {
    const result = await invoke<ListResult>("list_purchases", { filter });
    setList(result);
  }, [filter]);

  const refreshStats = useCallback(async () => {
    const result = await invoke<Stats>("get_stats");
    setStats(result);
  }, []);

  useEffect(() => {
    if (!isTauri()) {
      setAuthError("Tauri 앱에서 실행하세요 (npm run tauri:dev)");
      return;
    }
    refreshAuth()
      .then(() =>
        Promise.all([
          invoke<{ path: string }>("get_db_info").then((i) => setDbPath(i.path)),
          invoke<string>("get_app_version").then((v) => setAppVersion(v)),
        ])
      )
      .catch((e) => setAuthError(String(e)));
  }, [refreshAuth]);

  useEffect(() => {
    if (!auth?.unlocked) return;
    if (tab === "list") {
      refreshList().catch((e) => setMessage(String(e)));
    } else if (tab === "stats") {
      refreshStats().catch((e) => setMessage(String(e)));
    }
  }, [auth?.unlocked, tab, refreshList, refreshStats]);

  async function onUnlock(e: FormEvent) {
    e.preventDefault();
    setAuthError("");
    try {
      const status = await invoke<AuthStatus>("unlock", { password: unlockPw });
      setAuth(status);
      setUnlockPw("");
    } catch (err) {
      setAuthError(String(err));
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      if (editing) {
        await invoke("update_purchase", {
          input: {
            id: editing.id,
            item_name: itemName,
            purchase_date: purchaseDate,
            department: dept,
          },
        });
        setEditing(null);
        setMessage("수정했습니다.");
      } else {
        await invoke("create_purchase", {
          input: {
            item_name: itemName,
            purchase_date: purchaseDate,
            department: dept,
          },
        });
        setMessage("등록했습니다.");
      }
      setItemName("");
      setDept("");
      setPurchaseDate(today());
      await refreshList();
    } catch (err) {
      setMessage(String(err));
    }
  }

  async function onDelete(id: string) {
    if (!confirm("이 구매이력을 삭제할까요?")) return;
    try {
      await invoke("delete_purchase", { id });
      await refreshList();
    } catch (err) {
      setMessage(String(err));
    }
  }

  async function onExport() {
    try {
      const csv = await invoke<string>("export_csv", { filter });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `purchase-histories-${today()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMessage(String(err));
    }
  }

  async function onImportFile(file: File) {
    try {
      const text = await file.text();
      const result = await invoke<{ imported: number; skipped: number }>("import_csv", {
        csvText: text,
      });
      setMessage(`가져오기: ${result.imported}건 성공, ${result.skipped}건 건너뜀`);
      await refreshList();
      if (tab === "stats") await refreshStats();
    } catch (err) {
      setMessage(String(err));
    }
  }

  async function onTogglePassword(enabled: boolean) {
    setMessage("");
    try {
      if (enabled && newPw.length < 4) {
        setMessage("비밀번호는 4자 이상이어야 합니다.");
        return;
      }
      const status = await invoke<AuthStatus>("set_password_enabled", {
        enabled,
        password: enabled ? newPw : null,
      });
      setAuth(status);
      setPwEnabled(status.enabled);
      setNewPw("");
      setMessage(enabled ? "비밀번호 사용을 켰습니다." : "비밀번호 사용을 껐습니다.");
    } catch (err) {
      setMessage(String(err));
    }
  }

  async function onBackup() {
    try {
      const dest = await invoke<string>("default_backup_path");
      const path = await invoke<string>("backup_db", { destPath: dest });
      setMessage(`백업 완료: ${path}`);
    } catch (err) {
      setMessage(String(err));
    }
  }

  async function onCheckUpdate() {
    setUpdateBusy(true);
    setMessage("");
    setUpdateInfo(null);
    try {
      const result = await invoke<UpdateCheckResult>("check_for_update");
      setUpdateInfo(result);
      if (result.update_available) {
        setMessage(`새 버전 ${result.latest_version}이(가) 있습니다.`);
      } else {
        setMessage(`최신 버전입니다. (현재 ${result.current_version})`);
      }
    } catch (err) {
      setMessage(String(err));
    } finally {
      setUpdateBusy(false);
    }
  }

  async function onInstallUpdate() {
    if (!updateInfo?.url) return;
    setUpdateBusy(true);
    setMessage("설치파일 다운로드 중…");
    try {
      const path = await invoke<string>("download_and_run_update", { url: updateInfo.url });
      setMessage(`설치 프로그램을 실행했습니다: ${path}`);
    } catch (err) {
      setMessage(String(err));
    } finally {
      setUpdateBusy(false);
    }
  }

  if (authError && !auth) {
    return (
      <main className="app center">
        <h1>구매이력</h1>
        <p className="err">{authError}</p>
      </main>
    );
  }

  if (auth && !auth.unlocked) {
    return (
      <main className="app center">
        <h1>구매이력</h1>
        <p className="muted">비밀번호를 입력하세요</p>
        <form className="card form" onSubmit={onUnlock}>
          <input
            type="password"
            value={unlockPw}
            onChange={(e) => setUnlockPw(e.target.value)}
            placeholder="비밀번호"
            autoFocus
          />
          <button type="submit">잠금 해제</button>
          {authError ? <p className="err">{authError}</p> : null}
        </form>
      </main>
    );
  }

  const totalPages = Math.max(1, Math.ceil((list?.total ?? 0) / (list?.page_size ?? 50)));

  return (
    <main className="app">
      <header className="top">
        <div>
          <h1>구매이력</h1>
          <p className="muted">로컬 · 오프라인</p>
        </div>
        <nav className="tabs">
          <button className={tab === "list" ? "active" : ""} onClick={() => setTab("list")}>
            목록
          </button>
          <button className={tab === "stats" ? "active" : ""} onClick={() => setTab("stats")}>
            통계
          </button>
          <button
            className={tab === "settings" ? "active" : ""}
            onClick={() => setTab("settings")}
          >
            설정
          </button>
        </nav>
      </header>

      {message ? <p className="banner">{message}</p> : null}

      {tab === "list" ? (
        <div className="layout">
          <section className="card">
            <h2>{editing ? "수정" : "등록"}</h2>
            <form className="form grid3" onSubmit={onCreate}>
              <label>
                품목
                <input
                  value={itemName}
                  maxLength={200}
                  required
                  onChange={(e) => setItemName(e.target.value)}
                />
              </label>
              <label>
                구매일자
                <input
                  type="date"
                  value={purchaseDate}
                  required
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </label>
              <label>
                사용부서
                <input
                  value={dept}
                  maxLength={100}
                  required
                  onChange={(e) => setDept(e.target.value)}
                />
              </label>
              <div className="row">
                <button type="submit">{editing ? "저장" : "등록"}</button>
                {editing ? (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      setEditing(null);
                      setItemName("");
                      setDept("");
                      setPurchaseDate(today());
                    }}
                  >
                    취소
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="card">
            <div className="row between">
              <h2>검색·필터</h2>
              <div className="row">
                <button type="button" className="ghost" onClick={onExport}>
                  CSV 내보내기
                </button>
                <label className="file-btn">
                  CSV 가져오기
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onImportFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
            <form
              className="form grid4"
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                void refreshList();
              }}
            >
              <label>
                품목
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="부분일치" />
              </label>
              <label>
                부서
                <input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="부분일치"
                />
              </label>
              <label>
                시작일
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label>
                종료일
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
              <button type="submit">적용</button>
            </form>
          </section>

          <section className="card table-card">
            <div className="row between">
              <h2>목록</h2>
              <span className="muted">총 {list?.total ?? 0}건</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>구매일자</th>
                  <th>품목</th>
                  <th>사용부서</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(list?.rows ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      구매이력이 없습니다.
                    </td>
                  </tr>
                ) : (
                  list!.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.purchase_date}</td>
                      <td>{row.item_name}</td>
                      <td>{row.department}</td>
                      <td className="actions">
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            setEditing(row);
                            setItemName(row.item_name);
                            setPurchaseDate(row.purchase_date);
                            setDept(row.department);
                          }}
                        >
                          수정
                        </button>
                        <button type="button" className="danger" onClick={() => void onDelete(row.id)}>
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="row between">
              <span className="muted">
                {page}/{totalPages}
              </span>
              <div className="row">
                <button
                  type="button"
                  className="ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  이전
                </button>
                <button
                  type="button"
                  className="ghost"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  다음
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {tab === "stats" && stats ? (
        <div className="stats-scroll">
          <div className="kpi-row">
            <div className="kpi">
              <span>전체</span>
              <strong>{stats.total.toLocaleString()}</strong>
            </div>
            <div className="kpi">
              <span>이번 달</span>
              <strong>{stats.this_month.toLocaleString()}</strong>
              <em className={stats.mom_change_pct != null && stats.mom_change_pct >= 0 ? "up" : "down"}>
                전월 {stats.last_month.toLocaleString()}
                {stats.mom_change_pct != null
                  ? ` (${stats.mom_change_pct >= 0 ? "+" : ""}${stats.mom_change_pct.toFixed(1)}%)`
                  : ""}
              </em>
            </div>
            <div className="kpi">
              <span>이번 주</span>
              <strong>{stats.this_week.toLocaleString()}</strong>
            </div>
            <div className="kpi">
              <span>올해</span>
              <strong>{stats.this_year.toLocaleString()}</strong>
              <em>작년 동기 {stats.last_year_same_period.toLocaleString()}</em>
            </div>
            <div className="kpi">
              <span>고유 품목</span>
              <strong>{stats.unique_items.toLocaleString()}</strong>
            </div>
            <div className="kpi">
              <span>부서 수</span>
              <strong>{stats.unique_departments.toLocaleString()}</strong>
            </div>
            <div className="kpi">
              <span>최근 30일 일평균</span>
              <strong>{stats.avg_per_day_30.toFixed(1)}</strong>
            </div>
            <div className="kpi">
              <span>최다 월</span>
              <strong>
                {stats.peak_month
                  ? `${stats.peak_month.key.slice(2)}`
                  : "—"}
              </strong>
              <em>
                {stats.peak_month
                  ? `${stats.peak_month.count.toLocaleString()}건`
                  : ""}
              </em>
            </div>
          </div>

          <div className="stats-charts">
            <section className="card chart tall">
              <h2>월별 추이</h2>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={stats.by_month.map((d) => ({
                    name: d.key.slice(2),
                    count: d.count,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} width={36} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#0f766e"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </section>

            <section className="card chart tall">
              <h2>분기별</h2>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.by_quarter.map((d) => ({
                    name: d.key.replace(/^\d{2}/, "'"),
                    count: d.count,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} width={36} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0369a1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="card chart tall">
              <h2>이번 달 일별</h2>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.by_day_this_month.map((d) => ({
                    name: d.key.slice(8),
                    count: d.count,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={1} />
                  <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0f766e" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="card chart tall">
              <h2>요일별</h2>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.by_weekday.map((d) => ({
                    name: d.key,
                    count: d.count,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} width={36} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#b45309" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="card chart tall">
              <h2>부서별 건수</h2>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={stats.by_dept.map((d) => ({
                    name: d.key,
                    count: d.count,
                    pct:
                      stats.total > 0
                        ? Math.round((d.count / stats.total) * 1000) / 10
                        : 0,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={78} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, _name, item) => {
                      const pct = (item?.payload as { pct?: number })?.pct;
                      return [`${value}건 (${pct ?? 0}%)`, "건수"];
                    }}
                  />
                  <Bar dataKey="count" fill="#0369a1" />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="card chart tall">
              <h2>부서 비중</h2>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.by_dept.map((d) => ({
                      name: d.key,
                      count: d.count,
                    }))}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={75}
                  >
                    {stats.by_dept.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </section>

            <section className="card chart wide tall">
              <h2>최근 12개월 · 부서별 월간 (누적)</h2>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthDeptStacked(stats)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} width={36} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {stats.by_dept.map((d, i) => (
                    <Bar
                      key={d.key}
                      dataKey={d.key}
                      stackId="a"
                      fill={COLORS[i % COLORS.length]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="card chart wide tall">
              <h2>품목 상위 15</h2>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={stats.by_item.map((d) => ({
                    name: d.key.length > 18 ? `${d.key.slice(0, 17)}…` : d.key,
                    full: d.key,
                    count: d.count,
                  }))}
                  margin={{ left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value) => [`${value}건`, "건수"]}
                    labelFormatter={(_, payload) => {
                      const full = (payload?.[0]?.payload as { full?: string })?.full;
                      return full ?? "";
                    }}
                  />
                  <Bar dataKey="count" fill="#4f46e5" />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="card table-card wide">
              <h2>부서별 최다 구매 품목</h2>
              <table>
                <thead>
                  <tr>
                    <th>부서</th>
                    <th>최다 품목</th>
                    <th>건수</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.top_item_by_dept.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="muted">
                        데이터 없음
                      </td>
                    </tr>
                  ) : (
                    stats.top_item_by_dept.map((row) => (
                      <tr key={row.department}>
                        <td>{row.department}</td>
                        <td>{row.item_name}</td>
                        <td>{row.count.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          </div>
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="layout">
          <section className="card">
            <h2>비밀번호 (선택)</h2>
            <p className="muted">끄면 바로 앱을 씁니다. 켜면 시작 시 비밀번호가 필요합니다.</p>
            <div className="form">
              <label className="check">
                <input
                  type="checkbox"
                  checked={pwEnabled}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setPwEnabled(true);
                    } else {
                      void onTogglePassword(false);
                    }
                  }}
                />
                비밀번호 사용
              </label>
              {pwEnabled ? (
                <>
                  <input
                    type="password"
                    placeholder="새 비밀번호 (4자 이상)"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                  />
                  <button type="button" onClick={() => void onTogglePassword(true)}>
                    비밀번호 저장·사용
                  </button>
                </>
              ) : null}
              {auth?.enabled ? (
                <button
                  type="button"
                  className="ghost"
                  onClick={() =>
                    void invoke<AuthStatus>("lock_session").then((s) => setAuth(s))
                  }
                >
                  지금 잠그기
                </button>
              ) : null}
            </div>
          </section>
          <section className="card">
            <h2>백업·복원</h2>
            <div className="row">
              <button type="button" onClick={() => void onBackup()}>
                DB 백업
              </button>
            </div>
            <label>
              복원 파일 경로 (.db)
              <div className="row">
                <input
                  id="restore-path"
                  placeholder="C:\\...\\purchases-backup-....db"
                />
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(
                      "restore-path"
                    ) as HTMLInputElement | null;
                    const path = el?.value.trim() ?? "";
                    if (!path) {
                      setMessage("복원 경로를 입력하세요.");
                      return;
                    }
                    void invoke("restore_db", { srcPath: path })
                      .then(async () => {
                        setMessage("복원 완료");
                        await refreshAuth();
                        await refreshList();
                      })
                      .catch((err) => setMessage(String(err)));
                  }}
                >
                  복원
                </button>
              </div>
            </label>
            <p className="muted path">{dbPath}</p>
          </section>
          <section className="card">
            <h2>업데이트</h2>
            <p className="muted">현재 버전: {appVersion || "…"}</p>
            <div className="row">
              <button type="button" disabled={updateBusy} onClick={() => void onCheckUpdate()}>
                {updateBusy ? "확인 중…" : "업데이트 확인"}
              </button>
              {updateInfo?.update_available ? (
                <>
                  <button type="button" disabled={updateBusy} onClick={() => void onInstallUpdate()}>
                    다운로드·설치
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    disabled={updateBusy}
                    onClick={() =>
                      void invoke("open_external_url", { url: updateInfo.url }).catch((err) =>
                        setMessage(String(err))
                      )
                    }
                  >
                    브라우저에서 열기
                  </button>
                </>
              ) : null}
            </div>
            {updateInfo ? (
              <div className="update-meta">
                <p className="muted">
                  최신: {updateInfo.latest_version}
                  {updateInfo.published_at ? ` · ${updateInfo.published_at}` : ""}
                </p>
                {updateInfo.notes ? <p>{updateInfo.notes}</p> : null}
              </div>
            ) : (
              <p className="muted">
                GitHub에 latest.json이 올라간 뒤부터 확인됩니다.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}
