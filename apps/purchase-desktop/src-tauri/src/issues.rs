use crate::db::DbState;
use crate::purchases::lock_guard;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

const DEFAULT_ITEM: &str = "A4";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaperIssue {
  pub id: String,
  pub item_name: String,
  pub issue_date: String,
  pub department: String,
  pub quantity: i64,
  pub notes: String,
  pub created_at: String,
  pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct PaperIssueInput {
  pub issue_date: String,
  pub department: String,
  #[serde(default = "default_quantity")]
  pub quantity: i64,
  #[serde(default)]
  pub notes: String,
}

#[derive(Debug, Deserialize)]
pub struct PaperIssueUpdate {
  pub id: String,
  pub issue_date: String,
  pub department: String,
  #[serde(default = "default_quantity")]
  pub quantity: i64,
  #[serde(default)]
  pub notes: String,
}

fn default_quantity() -> i64 {
  1
}

#[derive(Debug, Clone, Deserialize)]
pub struct IssueFilter {
  pub department: Option<String>,
  pub from: Option<String>,
  pub to: Option<String>,
  pub page: Option<i64>,
  pub page_size: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct IssueListResult {
  pub rows: Vec<PaperIssue>,
  pub total: i64,
  pub page: i64,
  pub page_size: i64,
}

#[derive(Debug, Serialize)]
pub struct IssueOptions {
  pub departments: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct IssueDeptCycle {
  pub department: String,
  pub last_date: String,
  pub days_since: i64,
  pub issue_count: i64,
  pub total_quantity: i64,
  pub avg_cycle_days: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct IssueStatPoint {
  pub key: String,
  pub count: i64,
  pub quantity: i64,
}

#[derive(Debug, Serialize)]
pub struct IssueMonthDept {
  pub month: String,
  pub department: String,
  pub quantity: i64,
}

#[derive(Debug, Serialize)]
pub struct IssueStats {
  pub total: i64,
  pub total_quantity: i64,
  pub this_month: i64,
  pub this_month_quantity: i64,
  pub last_month: i64,
  pub last_month_quantity: i64,
  pub unique_departments: i64,
  pub by_month: Vec<IssueStatPoint>,
  pub by_dept: Vec<IssueStatPoint>,
  pub by_month_dept: Vec<IssueMonthDept>,
  pub dept_cycles: Vec<IssueDeptCycle>,
}

fn validate_issue(issue_date: &str, department: &str, quantity: i64, notes: &str) -> Result<(), String> {
  let dept = department.trim();
  let date = issue_date.trim();
  if dept.is_empty() || date.is_empty() {
    return Err("반출일과 부서를 입력하세요.".into());
  }
  if dept.chars().count() > 100 {
    return Err("부서는 100자 이하여야 합니다.".into());
  }
  if date.len() != 10 || date.as_bytes()[4] != b'-' || date.as_bytes()[7] != b'-' {
    return Err("반출일 형식이 올바르지 않습니다.".into());
  }
  if !(1..=999_999).contains(&quantity) {
    return Err("갯수는 1~999999 사이여야 합니다.".into());
  }
  if notes.chars().count() > 1000 {
    return Err("비고는 1000자 이하여야 합니다.".into());
  }
  Ok(())
}

fn now_stamp() -> String {
  use std::time::{SystemTime, UNIX_EPOCH};
  let ms = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis())
    .unwrap_or(0);
  format!("{ms}")
}

fn like_pat(raw: &str) -> String {
  format!(
    "%{}%",
    raw.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_")
  )
}

fn map_issue(row: &rusqlite::Row<'_>) -> rusqlite::Result<PaperIssue> {
  Ok(PaperIssue {
    id: row.get(0)?,
    item_name: row.get(1)?,
    issue_date: row.get(2)?,
    department: row.get(3)?,
    quantity: row.get(4)?,
    notes: row.get(5)?,
    created_at: row.get(6)?,
    updated_at: row.get(7)?,
  })
}

fn list_inner(conn: &Connection, filter: &IssueFilter) -> Result<IssueListResult, String> {
  let page_size = filter.page_size.unwrap_or(50).clamp(1, 5000);
  let page = filter.page.unwrap_or(1).max(1);
  let offset = (page - 1) * page_size;

  let mut where_sql = String::from("WHERE 1=1");
  let mut binds: Vec<String> = Vec::new();

  if let Some(d) = filter
    .department
    .as_ref()
    .map(|s| s.trim().to_string())
    .filter(|s| !s.is_empty())
  {
    where_sql.push_str(" AND department LIKE ? ESCAPE '\\'");
    binds.push(like_pat(&d));
  }
  if let Some(from) = filter.from.as_ref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
    where_sql.push_str(" AND issue_date >= ?");
    binds.push(from);
  }
  if let Some(to) = filter.to.as_ref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
    where_sql.push_str(" AND issue_date <= ?");
    binds.push(to);
  }

  let count_sql = format!("SELECT COUNT(*) FROM paper_issues {where_sql}");
  let mut count_stmt = conn.prepare(&count_sql).map_err(|e| e.to_string())?;
  let params_refs: Vec<&dyn rusqlite::ToSql> = binds.iter().map(|s| s as _).collect();
  let total: i64 = count_stmt
    .query_row(params_refs.as_slice(), |row| row.get(0))
    .map_err(|e| e.to_string())?;

  let list_sql = format!(
    "SELECT id, item_name, issue_date, department, quantity, notes, created_at, updated_at
     FROM paper_issues {where_sql}
     ORDER BY issue_date DESC, created_at DESC
     LIMIT ? OFFSET ?"
  );
  let mut list_stmt = conn.prepare(&list_sql).map_err(|e| e.to_string())?;
  let mut params_owned = binds;
  params_owned.push(page_size.to_string());
  params_owned.push(offset.to_string());
  let params_refs: Vec<&dyn rusqlite::ToSql> = params_owned.iter().map(|s| s as _).collect();

  let rows = list_stmt
    .query_map(params_refs.as_slice(), map_issue)
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

  Ok(IssueListResult {
    rows,
    total,
    page,
    page_size,
  })
}

#[tauri::command]
pub fn list_issues(state: State<'_, DbState>, filter: IssueFilter) -> Result<IssueListResult, String> {
  let conn = lock_guard(&state)?;
  list_inner(&conn, &filter)
}

#[tauri::command]
pub fn list_issue_options(state: State<'_, DbState>) -> Result<IssueOptions, String> {
  let conn = lock_guard(&state)?;
  let mut stmt = conn
    .prepare(
      "SELECT n FROM (
         SELECT DISTINCT TRIM(department) AS n FROM purchase_histories WHERE TRIM(department) != ''
         UNION
         SELECT DISTINCT TRIM(department) AS n FROM paper_issues WHERE TRIM(department) != ''
       )
       ORDER BY n COLLATE NOCASE ASC",
    )
    .map_err(|e| e.to_string())?;
  let departments = stmt
    .query_map([], |row| row.get::<_, String>(0))
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;
  Ok(IssueOptions { departments })
}

#[tauri::command]
pub fn create_issue(state: State<'_, DbState>, input: PaperIssueInput) -> Result<PaperIssue, String> {
  validate_issue(&input.issue_date, &input.department, input.quantity, &input.notes)?;
  let conn = lock_guard(&state)?;
  let id = Uuid::new_v4().to_string();
  let now = now_stamp();
  let dept = input.department.trim();
  let date = input.issue_date.trim();
  let notes = input.notes.trim();

  conn
    .execute(
      "INSERT INTO paper_issues
        (id, item_name, issue_date, department, quantity, notes, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
      params![id, DEFAULT_ITEM, date, dept, input.quantity, notes, now, now],
    )
    .map_err(|e| e.to_string())?;

  Ok(PaperIssue {
    id,
    item_name: DEFAULT_ITEM.to_string(),
    issue_date: date.to_string(),
    department: dept.to_string(),
    quantity: input.quantity,
    notes: notes.to_string(),
    created_at: now.clone(),
    updated_at: now,
  })
}

#[tauri::command]
pub fn update_issue(state: State<'_, DbState>, input: PaperIssueUpdate) -> Result<PaperIssue, String> {
  validate_issue(&input.issue_date, &input.department, input.quantity, &input.notes)?;
  let conn = lock_guard(&state)?;
  let now = now_stamp();
  let dept = input.department.trim();
  let date = input.issue_date.trim();
  let notes = input.notes.trim();

  let changed = conn
    .execute(
      "UPDATE paper_issues
       SET issue_date = ?1, department = ?2, quantity = ?3, notes = ?4,
           item_name = ?5, updated_at = ?6
       WHERE id = ?7",
      params![date, dept, input.quantity, notes, DEFAULT_ITEM, now, input.id],
    )
    .map_err(|e| e.to_string())?;
  if changed == 0 {
    return Err("해당 반출 이력을 찾을 수 없습니다.".into());
  }

  conn
    .query_row(
      "SELECT id, item_name, issue_date, department, quantity, notes, created_at, updated_at
       FROM paper_issues WHERE id = ?1",
      params![input.id],
      map_issue,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_issue(state: State<'_, DbState>, id: String) -> Result<(), String> {
  let conn = lock_guard(&state)?;
  let changed = conn
    .execute("DELETE FROM paper_issues WHERE id = ?1", params![id])
    .map_err(|e| e.to_string())?;
  if changed == 0 {
    return Err("해당 반출 이력을 찾을 수 없습니다.".into());
  }
  Ok(())
}

#[tauri::command]
pub fn delete_all_issues(state: State<'_, DbState>) -> Result<i64, String> {
  let conn = lock_guard(&state)?;
  let deleted = conn
    .execute("DELETE FROM paper_issues", [])
    .map_err(|e| e.to_string())? as i64;
  Ok(deleted)
}

#[tauri::command]
pub fn get_issue_stats(state: State<'_, DbState>) -> Result<IssueStats, String> {
  let conn = lock_guard(&state)?;

  let total: i64 = conn
    .query_row("SELECT COUNT(*) FROM paper_issues", [], |r| r.get(0))
    .map_err(|e| e.to_string())?;
  let total_quantity: i64 = conn
    .query_row("SELECT COALESCE(SUM(quantity), 0) FROM paper_issues", [], |r| r.get(0))
    .map_err(|e| e.to_string())?;

  let this_month: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM paper_issues
       WHERE issue_date >= strftime('%Y-%m-01', 'now', 'localtime')
         AND issue_date < strftime('%Y-%m-01', 'now', 'localtime', '+1 month')",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;
  let this_month_quantity: i64 = conn
    .query_row(
      "SELECT COALESCE(SUM(quantity), 0) FROM paper_issues
       WHERE issue_date >= strftime('%Y-%m-01', 'now', 'localtime')
         AND issue_date < strftime('%Y-%m-01', 'now', 'localtime', '+1 month')",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;

  let last_month: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM paper_issues
       WHERE issue_date >= strftime('%Y-%m-01', 'now', 'localtime', '-1 month')
         AND issue_date < strftime('%Y-%m-01', 'now', 'localtime')",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;
  let last_month_quantity: i64 = conn
    .query_row(
      "SELECT COALESCE(SUM(quantity), 0) FROM paper_issues
       WHERE issue_date >= strftime('%Y-%m-01', 'now', 'localtime', '-1 month')
         AND issue_date < strftime('%Y-%m-01', 'now', 'localtime')",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;

  let unique_departments: i64 = conn
    .query_row(
      "SELECT COUNT(DISTINCT department) FROM paper_issues",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;

  let mut by_month = Vec::new();
  {
    let mut stmt = conn
      .prepare(
        "SELECT substr(issue_date,1,7) AS m, COUNT(*) AS c, COALESCE(SUM(quantity),0) AS q
         FROM paper_issues GROUP BY m ORDER BY m ASC",
      )
      .map_err(|e| e.to_string())?;
    for row in stmt
      .query_map([], |r| {
        Ok(IssueStatPoint {
          key: r.get(0)?,
          count: r.get(1)?,
          quantity: r.get(2)?,
        })
      })
      .map_err(|e| e.to_string())?
    {
      by_month.push(row.map_err(|e| e.to_string())?);
    }
  }

  let mut by_dept = Vec::new();
  {
    let mut stmt = conn
      .prepare(
        "SELECT department, COUNT(*) AS c, COALESCE(SUM(quantity),0) AS q
         FROM paper_issues
         GROUP BY department ORDER BY q DESC, department ASC",
      )
      .map_err(|e| e.to_string())?;
    for row in stmt
      .query_map([], |r| {
        Ok(IssueStatPoint {
          key: r.get(0)?,
          count: r.get(1)?,
          quantity: r.get(2)?,
        })
      })
      .map_err(|e| e.to_string())?
    {
      by_dept.push(row.map_err(|e| e.to_string())?);
    }
  }

  let mut by_month_dept = Vec::new();
  {
    let mut stmt = conn
      .prepare(
        "SELECT substr(issue_date,1,7) AS m, department, COALESCE(SUM(quantity),0) AS q
         FROM paper_issues
         WHERE issue_date >= strftime('%Y-%m-01', 'now', 'localtime', '-11 months')
         GROUP BY m, department
         ORDER BY m ASC, department ASC",
      )
      .map_err(|e| e.to_string())?;
    for row in stmt
      .query_map([], |r| {
        Ok(IssueMonthDept {
          month: r.get(0)?,
          department: r.get(1)?,
          quantity: r.get(2)?,
        })
      })
      .map_err(|e| e.to_string())?
    {
      by_month_dept.push(row.map_err(|e| e.to_string())?);
    }
  }

  let mut dept_cycles = Vec::new();
  {
    let mut stmt = conn
      .prepare(
        "SELECT department,
                MAX(issue_date) AS last_date,
                CAST(julianday(date('now','localtime')) - julianday(MAX(issue_date)) AS INTEGER) AS days_since,
                COUNT(*) AS issue_count,
                COALESCE(SUM(quantity),0) AS total_qty,
                CASE WHEN COUNT(*) >= 2
                  THEN (julianday(MAX(issue_date)) - julianday(MIN(issue_date))) / (COUNT(*) - 1)
                  ELSE NULL
                END AS avg_cycle
         FROM paper_issues
         GROUP BY department
         ORDER BY days_since DESC, department ASC",
      )
      .map_err(|e| e.to_string())?;
    for row in stmt
      .query_map([], |r| {
        Ok(IssueDeptCycle {
          department: r.get(0)?,
          last_date: r.get(1)?,
          days_since: r.get(2)?,
          issue_count: r.get(3)?,
          total_quantity: r.get(4)?,
          avg_cycle_days: r.get(5)?,
        })
      })
      .map_err(|e| e.to_string())?
    {
      dept_cycles.push(row.map_err(|e| e.to_string())?);
    }
  }

  Ok(IssueStats {
    total,
    total_quantity,
    this_month,
    this_month_quantity,
    last_month,
    last_month_quantity,
    unique_departments,
    by_month,
    by_dept,
    by_month_dept,
    dept_cycles,
  })
}
