import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
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
type Stats = {
  total: number;
  this_month: number;
  this_year: number;
  by_month: StatPoint[];
  by_dept: StatPoint[];
  by_item: StatPoint[];
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
      .then(() => invoke<{ path: string }>("get_db_info").then((i) => setDbPath(i.path)))
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
        <div className="stats-grid">
          <div className="kpi">
            <span>전체</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="kpi">
            <span>이번 달</span>
            <strong>{stats.this_month}</strong>
          </div>
          <div className="kpi">
            <span>올해</span>
            <strong>{stats.this_year}</strong>
          </div>
          <section className="card chart">
            <h2>월별 추이</h2>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.by_month.map((d) => ({ name: d.key.slice(2), count: d.count }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#0f766e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
          <section className="card chart">
            <h2>부서 비중</h2>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.by_dept.map((d) => ({ name: d.key, count: d.count }))}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={40}
                  outerRadius={70}
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
          <section className="card chart">
            <h2>부서별</h2>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={stats.by_dept.map((d) => ({ name: d.key, count: d.count }))}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#0369a1" />
              </BarChart>
            </ResponsiveContainer>
          </section>
          <section className="card chart">
            <h2>품목 상위 8</h2>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={stats.by_item.map((d) => ({
                  name: d.key.length > 14 ? `${d.key.slice(0, 13)}…` : d.key,
                  count: d.count,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#4f46e5" />
              </BarChart>
            </ResponsiveContainer>
          </section>
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
        </div>
      ) : null}
    </main>
  );
}
