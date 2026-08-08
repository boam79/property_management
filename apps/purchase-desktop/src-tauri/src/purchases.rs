use crate::db::DbState;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::MutexGuard;
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Purchase {
  pub id: String,
  pub item_name: String,
  pub purchase_date: String,
  pub department: String,
  pub created_at: String,
  pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct PurchaseInput {
  pub item_name: String,
  pub purchase_date: String,
  pub department: String,
}

#[derive(Debug, Deserialize)]
pub struct PurchaseUpdate {
  pub id: String,
  pub item_name: String,
  pub purchase_date: String,
  pub department: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PurchaseFilter {
  pub q: Option<String>,
  pub department: Option<String>,
  pub from: Option<String>,
  pub to: Option<String>,
  pub page: Option<i64>,
  pub page_size: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct PurchaseListResult {
  pub rows: Vec<Purchase>,
  pub total: i64,
  pub page: i64,
  pub page_size: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct StatPoint {
  pub key: String,
  pub count: i64,
}

#[derive(Debug, Serialize)]
pub struct DeptTopItem {
  pub department: String,
  pub item_name: String,
  pub count: i64,
}

#[derive(Debug, Serialize)]
pub struct MonthDeptPoint {
  pub month: String,
  pub department: String,
  pub count: i64,
}

#[derive(Debug, Serialize)]
pub struct PurchaseStats {
  pub total: i64,
  pub this_month: i64,
  pub last_month: i64,
  pub mom_change_pct: Option<f64>,
  pub this_year: i64,
  pub last_year_same_period: i64,
  pub this_week: i64,
  pub unique_items: i64,
  pub unique_departments: i64,
  pub avg_per_day_30: f64,
  pub peak_month: Option<StatPoint>,
  pub by_month: Vec<StatPoint>,
  pub by_dept: Vec<StatPoint>,
  pub by_item: Vec<StatPoint>,
  pub by_weekday: Vec<StatPoint>,
  pub by_day_this_month: Vec<StatPoint>,
  pub by_quarter: Vec<StatPoint>,
  pub top_item_by_dept: Vec<DeptTopItem>,
  pub by_month_dept: Vec<MonthDeptPoint>,
}

#[derive(Debug, Serialize)]
pub struct AuthStatus {
  pub enabled: bool,
  pub unlocked: bool,
}

#[derive(Debug, Serialize)]
pub struct ImportResult {
  pub imported: i64,
  pub skipped: i64,
}

fn validate_fields(item_name: &str, purchase_date: &str, department: &str) -> Result<(), String> {
  let item = item_name.trim();
  let dept = department.trim();
  let date = purchase_date.trim();
  if item.is_empty() || dept.is_empty() || date.is_empty() {
    return Err("품목, 구매일자, 사용부서를 모두 입력하세요.".into());
  }
  if item.chars().count() > 200 {
    return Err("품목은 200자 이하여야 합니다.".into());
  }
  if dept.chars().count() > 100 {
    return Err("사용부서는 100자 이하여야 합니다.".into());
  }
  if date.len() != 10 || date.as_bytes()[4] != b'-' || date.as_bytes()[7] != b'-' {
    return Err("구매일자 형식이 올바르지 않습니다.".into());
  }
  Ok(())
}

fn hash_password(password: &str, salt: &str) -> String {
  let mut hasher = Sha256::new();
  hasher.update(salt.as_bytes());
  hasher.update(b":");
  hasher.update(password.as_bytes());
  hex::encode(hasher.finalize())
}

fn meta_get(conn: &Connection, key: &str) -> Result<Option<String>, String> {
  conn
    .query_row(
      "SELECT value FROM app_meta WHERE key = ?1",
      params![key],
      |row| row.get(0),
    )
    .optional()
    .map_err(|e| e.to_string())
}

fn meta_set(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
  conn
    .execute(
      "INSERT INTO app_meta (key, value) VALUES (?1, ?2)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      params![key, value],
    )
    .map_err(|e| e.to_string())?;
  Ok(())
}

fn map_purchase(row: &rusqlite::Row<'_>) -> rusqlite::Result<Purchase> {
  Ok(Purchase {
    id: row.get(0)?,
    item_name: row.get(1)?,
    purchase_date: row.get(2)?,
    department: row.get(3)?,
    created_at: row.get(4)?,
    updated_at: row.get(5)?,
  })
}

fn csv_escape_cell(value: &str) -> String {
  let mut out = value.to_string();
  if out.starts_with(['=', '+', '-', '@', '\t', '\r']) {
    out = format!("'{out}");
  }
  if out.contains(['"', ',', '\n', '\r']) {
    return format!("\"{}\"", out.replace('"', "\"\""));
  }
  out
}

fn chrono_like_now() -> String {
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

fn list_inner(conn: &Connection, filter: &PurchaseFilter) -> Result<PurchaseListResult, String> {
  let page_size = filter.page_size.unwrap_or(50).clamp(1, 5000);
  let page = filter.page.unwrap_or(1).max(1);
  let offset = (page - 1) * page_size;

  let mut where_sql = String::from("WHERE 1=1");
  let mut binds: Vec<String> = Vec::new();

  if let Some(q) = filter.q.as_ref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
    where_sql.push_str(" AND item_name LIKE ? ESCAPE '\\'");
    binds.push(like_pat(&q));
  }
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
    where_sql.push_str(" AND purchase_date >= ?");
    binds.push(from);
  }
  if let Some(to) = filter.to.as_ref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
    where_sql.push_str(" AND purchase_date <= ?");
    binds.push(to);
  }

  let count_sql = format!("SELECT COUNT(*) FROM purchase_histories {where_sql}");
  let mut count_stmt = conn.prepare(&count_sql).map_err(|e| e.to_string())?;
  let params_refs: Vec<&dyn rusqlite::ToSql> = binds.iter().map(|s| s as _).collect();
  let total: i64 = count_stmt
    .query_row(params_refs.as_slice(), |row| row.get(0))
    .map_err(|e| e.to_string())?;

  let list_sql = format!(
    "SELECT id, item_name, purchase_date, department, created_at, updated_at
     FROM purchase_histories {where_sql}
     ORDER BY purchase_date DESC, created_at DESC
     LIMIT ? OFFSET ?"
  );
  let mut list_stmt = conn.prepare(&list_sql).map_err(|e| e.to_string())?;
  let mut params_owned = binds;
  params_owned.push(page_size.to_string());
  params_owned.push(offset.to_string());
  let params_refs: Vec<&dyn rusqlite::ToSql> = params_owned.iter().map(|s| s as _).collect();

  let rows = list_stmt
    .query_map(params_refs.as_slice(), map_purchase)
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

  Ok(PurchaseListResult {
    rows,
    total,
    page,
    page_size,
  })
}

fn require_unlocked(conn: &Connection) -> Result<(), String> {
  let enabled = meta_get(conn, "password_enabled")?
    .map(|v| v == "1")
    .unwrap_or(false);
  if !enabled {
    return Ok(());
  }
  let unlocked = meta_get(conn, "session_unlocked")?
    .map(|v| v == "1")
    .unwrap_or(false);
  if !unlocked {
    return Err("잠금 상태입니다. 비밀번호를 입력하세요.".into());
  }
  Ok(())
}

fn lock_guard<'a>(state: &'a State<'_, DbState>) -> Result<MutexGuard<'a, Connection>, String> {
  let conn = state.conn.lock().map_err(|e| e.to_string())?;
  require_unlocked(&conn)?;
  Ok(conn)
}

#[tauri::command]
pub fn list_purchases(
  state: State<'_, DbState>,
  filter: PurchaseFilter,
) -> Result<PurchaseListResult, String> {
  let conn = lock_guard(&state)?;
  list_inner(&conn, &filter)
}

#[tauri::command]
pub fn create_purchase(
  state: State<'_, DbState>,
  input: PurchaseInput,
) -> Result<Purchase, String> {
  validate_fields(&input.item_name, &input.purchase_date, &input.department)?;
  let conn = lock_guard(&state)?;
  let id = Uuid::new_v4().to_string();
  let now = chrono_like_now();
  let item = input.item_name.trim();
  let dept = input.department.trim();
  let date = input.purchase_date.trim();

  conn
    .execute(
      "INSERT INTO purchase_histories
        (id, item_name, purchase_date, department, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
      params![id, item, date, dept, now, now],
    )
    .map_err(|e| e.to_string())?;

  Ok(Purchase {
    id,
    item_name: item.to_string(),
    purchase_date: date.to_string(),
    department: dept.to_string(),
    created_at: now.clone(),
    updated_at: now,
  })
}

#[tauri::command]
pub fn update_purchase(
  state: State<'_, DbState>,
  input: PurchaseUpdate,
) -> Result<Purchase, String> {
  validate_fields(&input.item_name, &input.purchase_date, &input.department)?;
  if input.id.trim().is_empty() {
    return Err("대상이 없습니다.".into());
  }
  let conn = lock_guard(&state)?;
  let now = chrono_like_now();
  let item = input.item_name.trim();
  let dept = input.department.trim();
  let date = input.purchase_date.trim();

  let changed = conn
    .execute(
      "UPDATE purchase_histories
       SET item_name = ?1, purchase_date = ?2, department = ?3, updated_at = ?4
       WHERE id = ?5",
      params![item, date, dept, now, input.id],
    )
    .map_err(|e| e.to_string())?;
  if changed == 0 {
    return Err("대상을 찾을 수 없습니다.".into());
  }

  conn
    .query_row(
      "SELECT id, item_name, purchase_date, department, created_at, updated_at
       FROM purchase_histories WHERE id = ?1",
      params![input.id],
      map_purchase,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_purchase(state: State<'_, DbState>, id: String) -> Result<(), String> {
  if id.trim().is_empty() {
    return Err("대상이 없습니다.".into());
  }
  let conn = lock_guard(&state)?;
  let changed = conn
    .execute("DELETE FROM purchase_histories WHERE id = ?1", params![id])
    .map_err(|e| e.to_string())?;
  if changed == 0 {
    return Err("대상을 찾을 수 없습니다.".into());
  }
  Ok(())
}

#[tauri::command]
pub fn export_csv(state: State<'_, DbState>, filter: PurchaseFilter) -> Result<String, String> {
  let conn = lock_guard(&state)?;
  let mut f = filter;
  f.page = Some(1);
  f.page_size = Some(5000);
  let list = list_inner(&conn, &f)?;
  let mut out = String::from("품목,구매일자,사용부서,등록일시\r\n");
  for row in list.rows {
    out.push_str(&format!(
      "{},{},{},{}\r\n",
      csv_escape_cell(&row.item_name),
      csv_escape_cell(&row.purchase_date),
      csv_escape_cell(&row.department),
      csv_escape_cell(&row.created_at),
    ));
  }
  Ok(format!("\u{FEFF}{out}"))
}

#[tauri::command]
pub fn import_csv(state: State<'_, DbState>, csv_text: String) -> Result<ImportResult, String> {
  let conn = lock_guard(&state)?;
  let mut imported = 0i64;
  let mut skipped = 0i64;

  for (idx, line) in csv_text.lines().enumerate() {
    let line = line.trim_start_matches('\u{FEFF}').trim();
    if line.is_empty() {
      continue;
    }
    if idx == 0 && (line.contains("품목") || line.to_lowercase().contains("item")) {
      continue;
    }
    let cols = parse_csv_line(line);
    if cols.len() < 3 {
      skipped += 1;
      continue;
    }
    let item = cols[0].trim().trim_start_matches('\'');
    let date = cols[1].trim();
    let dept = cols[2].trim().trim_start_matches('\'');
    if validate_fields(item, date, dept).is_err() {
      skipped += 1;
      continue;
    }
    let id = Uuid::new_v4().to_string();
    let now = chrono_like_now();
    match conn.execute(
      "INSERT INTO purchase_histories
        (id, item_name, purchase_date, department, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
      params![id, item, date, dept, now, now],
    ) {
      Ok(_) => imported += 1,
      Err(_) => skipped += 1,
    }
  }

  Ok(ImportResult { imported, skipped })
}

fn parse_csv_line(line: &str) -> Vec<String> {
  let mut out = Vec::new();
  let mut cur = String::new();
  let mut in_quotes = false;
  let mut chars = line.chars().peekable();
  while let Some(c) = chars.next() {
    match c {
      '"' => {
        if in_quotes && chars.peek() == Some(&'"') {
          cur.push('"');
          chars.next();
        } else {
          in_quotes = !in_quotes;
        }
      }
      ',' if !in_quotes => {
        out.push(cur);
        cur = String::new();
      }
      _ => cur.push(c),
    }
  }
  out.push(cur);
  out
}

#[tauri::command]
pub fn get_stats(state: State<'_, DbState>) -> Result<PurchaseStats, String> {
  let conn = lock_guard(&state)?;

  let total: i64 = conn
    .query_row("SELECT COUNT(*) FROM purchase_histories", [], |r| r.get(0))
    .map_err(|e| e.to_string())?;

  let this_month: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM purchase_histories
       WHERE purchase_date >= strftime('%Y-%m-01', 'now', 'localtime')
         AND purchase_date < strftime('%Y-%m-01', 'now', 'localtime', '+1 month')",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;

  let last_month: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM purchase_histories
       WHERE purchase_date >= strftime('%Y-%m-01', 'now', 'localtime', '-1 month')
         AND purchase_date < strftime('%Y-%m-01', 'now', 'localtime')",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;

  let mom_change_pct = if last_month > 0 {
    Some(((this_month - last_month) as f64 / last_month as f64) * 100.0)
  } else if this_month > 0 {
    Some(100.0)
  } else {
    None
  };

  let this_year: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM purchase_histories
       WHERE purchase_date >= strftime('%Y-01-01', 'now', 'localtime')",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;

  // 작년 동일 기간(1/1 ~ 오늘 월일)
  let last_year_same_period: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM purchase_histories
       WHERE purchase_date >= strftime('%Y-01-01', 'now', 'localtime', '-1 year')
         AND purchase_date <= strftime('%Y-%m-%d', 'now', 'localtime', '-1 year')",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;

  let this_week: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM purchase_histories
       WHERE purchase_date >= date('now', 'localtime', 'weekday 0', '-6 days')",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;

  let unique_items: i64 = conn
    .query_row(
      "SELECT COUNT(DISTINCT item_name) FROM purchase_histories",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;

  let unique_departments: i64 = conn
    .query_row(
      "SELECT COUNT(DISTINCT department) FROM purchase_histories",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;

  let last_30: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM purchase_histories
       WHERE purchase_date >= date('now', 'localtime', '-29 days')",
      [],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;
  let avg_per_day_30 = (last_30 as f64) / 30.0;

  let mut by_month = Vec::new();
  {
    let mut stmt = conn
      .prepare(
        "SELECT substr(purchase_date,1,7) AS m, COUNT(*) AS c
         FROM purchase_histories GROUP BY m ORDER BY m ASC",
      )
      .map_err(|e| e.to_string())?;
    for row in stmt
      .query_map([], |r| {
        Ok(StatPoint {
          key: r.get(0)?,
          count: r.get(1)?,
        })
      })
      .map_err(|e| e.to_string())?
    {
      by_month.push(row.map_err(|e| e.to_string())?);
    }
  }

  let peak_month = by_month
    .iter()
    .max_by_key(|p| p.count)
    .cloned();

  let mut by_dept = Vec::new();
  {
    let mut stmt = conn
      .prepare(
        "SELECT department, COUNT(*) AS c FROM purchase_histories
         GROUP BY department ORDER BY c DESC, department ASC",
      )
      .map_err(|e| e.to_string())?;
    for row in stmt
      .query_map([], |r| {
        Ok(StatPoint {
          key: r.get(0)?,
          count: r.get(1)?,
        })
      })
      .map_err(|e| e.to_string())?
    {
      by_dept.push(row.map_err(|e| e.to_string())?);
    }
  }

  let mut by_item = Vec::new();
  {
    let mut stmt = conn
      .prepare(
        "SELECT item_name, COUNT(*) AS c FROM purchase_histories
         GROUP BY item_name ORDER BY c DESC, item_name ASC LIMIT 15",
      )
      .map_err(|e| e.to_string())?;
    for row in stmt
      .query_map([], |r| {
        Ok(StatPoint {
          key: r.get(0)?,
          count: r.get(1)?,
        })
      })
      .map_err(|e| e.to_string())?
    {
      by_item.push(row.map_err(|e| e.to_string())?);
    }
  }

  // SQLite strftime %w : 0=Sunday .. 6=Saturday → 월~일 순으로 정렬 키
  let mut by_weekday_raw = Vec::new();
  {
    let mut stmt = conn
      .prepare(
        "SELECT CAST(strftime('%w', purchase_date) AS INTEGER) AS wd, COUNT(*) AS c
         FROM purchase_histories GROUP BY wd",
      )
      .map_err(|e| e.to_string())?;
    for row in stmt
      .query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?)))
      .map_err(|e| e.to_string())?
    {
      by_weekday_raw.push(row.map_err(|e| e.to_string())?);
    }
  }
  let weekday_labels = ["일", "월", "화", "수", "목", "금", "토"];
  // 화면은 월~일
  let order = [1, 2, 3, 4, 5, 6, 0];
  let mut by_weekday = Vec::new();
  for wd in order {
    let count = by_weekday_raw
      .iter()
      .find(|(k, _)| *k == wd)
      .map(|(_, c)| *c)
      .unwrap_or(0);
    by_weekday.push(StatPoint {
      key: weekday_labels[wd as usize].to_string(),
      count,
    });
  }

  let mut by_day_this_month = Vec::new();
  {
    let mut stmt = conn
      .prepare(
        "SELECT purchase_date, COUNT(*) AS c FROM purchase_histories
         WHERE purchase_date >= strftime('%Y-%m-01', 'now', 'localtime')
           AND purchase_date < strftime('%Y-%m-01', 'now', 'localtime', '+1 month')
         GROUP BY purchase_date ORDER BY purchase_date ASC",
      )
      .map_err(|e| e.to_string())?;
    for row in stmt
      .query_map([], |r| {
        Ok(StatPoint {
          key: r.get(0)?,
          count: r.get(1)?,
        })
      })
      .map_err(|e| e.to_string())?
    {
      by_day_this_month.push(row.map_err(|e| e.to_string())?);
    }
  }

  let mut by_quarter = Vec::new();
  {
    let mut stmt = conn
      .prepare(
        "SELECT printf('%s-Q%d', substr(purchase_date,1,4),
                ((CAST(substr(purchase_date,6,2) AS INTEGER)-1)/3)+1) AS q,
                COUNT(*) AS c
         FROM purchase_histories
         GROUP BY q ORDER BY q ASC",
      )
      .map_err(|e| e.to_string())?;
    for row in stmt
      .query_map([], |r| {
        Ok(StatPoint {
          key: r.get(0)?,
          count: r.get(1)?,
        })
      })
      .map_err(|e| e.to_string())?
    {
      by_quarter.push(row.map_err(|e| e.to_string())?);
    }
  }

  let mut top_item_by_dept = Vec::new();
  {
    let mut stmt = conn
      .prepare(
        "WITH ranked AS (
           SELECT department, item_name, COUNT(*) AS c,
                  ROW_NUMBER() OVER (PARTITION BY department ORDER BY COUNT(*) DESC, item_name ASC) AS rn
           FROM purchase_histories
           GROUP BY department, item_name
         )
         SELECT department, item_name, c FROM ranked WHERE rn = 1
         ORDER BY department ASC",
      )
      .map_err(|e| e.to_string())?;
    for row in stmt
      .query_map([], |r| {
        Ok(DeptTopItem {
          department: r.get(0)?,
          item_name: r.get(1)?,
          count: r.get(2)?,
        })
      })
      .map_err(|e| e.to_string())?
    {
      top_item_by_dept.push(row.map_err(|e| e.to_string())?);
    }
  }

  let mut by_month_dept = Vec::new();
  {
    let mut stmt = conn
      .prepare(
        "SELECT substr(purchase_date,1,7) AS m, department, COUNT(*) AS c
         FROM purchase_histories
         WHERE purchase_date >= strftime('%Y-%m-01', 'now', 'localtime', '-11 months')
         GROUP BY m, department
         ORDER BY m ASC, department ASC",
      )
      .map_err(|e| e.to_string())?;
    for row in stmt
      .query_map([], |r| {
        Ok(MonthDeptPoint {
          month: r.get(0)?,
          department: r.get(1)?,
          count: r.get(2)?,
        })
      })
      .map_err(|e| e.to_string())?
    {
      by_month_dept.push(row.map_err(|e| e.to_string())?);
    }
  }

  Ok(PurchaseStats {
    total,
    this_month,
    last_month,
    mom_change_pct,
    this_year,
    last_year_same_period,
    this_week,
    unique_items,
    unique_departments,
    avg_per_day_30,
    peak_month,
    by_month,
    by_dept,
    by_item,
    by_weekday,
    by_day_this_month,
    by_quarter,
    top_item_by_dept,
    by_month_dept,
  })
}

#[tauri::command]
pub fn get_auth_status(state: State<'_, DbState>) -> Result<AuthStatus, String> {
  let conn = state.conn.lock().map_err(|e| e.to_string())?;
  let enabled = meta_get(&conn, "password_enabled")?
    .map(|v| v == "1")
    .unwrap_or(false);
  let unlocked = !enabled
    || meta_get(&conn, "session_unlocked")?
      .map(|v| v == "1")
      .unwrap_or(false);
  Ok(AuthStatus { enabled, unlocked })
}

#[tauri::command]
pub fn set_password_enabled(
  state: State<'_, DbState>,
  enabled: bool,
  password: Option<String>,
) -> Result<AuthStatus, String> {
  let conn = state.conn.lock().map_err(|e| e.to_string())?;
  if enabled {
    let pw = password.unwrap_or_default();
    if pw.chars().count() < 4 {
      return Err("비밀번호는 4자 이상이어야 합니다.".into());
    }
    let salt = Uuid::new_v4().to_string();
    let hash = hash_password(&pw, &salt);
    meta_set(&conn, "password_salt", &salt)?;
    meta_set(&conn, "password_hash", &hash)?;
    meta_set(&conn, "password_enabled", "1")?;
    meta_set(&conn, "session_unlocked", "1")?;
  } else {
    meta_set(&conn, "password_enabled", "0")?;
    meta_set(&conn, "session_unlocked", "1")?;
    meta_set(&conn, "password_hash", "")?;
    meta_set(&conn, "password_salt", "")?;
  }
  drop(conn);
  get_auth_status(state)
}

#[tauri::command]
pub fn unlock(state: State<'_, DbState>, password: String) -> Result<AuthStatus, String> {
  let conn = state.conn.lock().map_err(|e| e.to_string())?;
  let enabled = meta_get(&conn, "password_enabled")?
    .map(|v| v == "1")
    .unwrap_or(false);
  if !enabled {
    meta_set(&conn, "session_unlocked", "1")?;
    drop(conn);
    return get_auth_status(state);
  }
  let salt = meta_get(&conn, "password_salt")?.unwrap_or_default();
  let hash = meta_get(&conn, "password_hash")?.unwrap_or_default();
  if hash_password(&password, &salt) != hash {
    return Err("비밀번호가 올바르지 않습니다.".into());
  }
  meta_set(&conn, "session_unlocked", "1")?;
  drop(conn);
  get_auth_status(state)
}

#[tauri::command]
pub fn lock_session(state: State<'_, DbState>) -> Result<AuthStatus, String> {
  let conn = state.conn.lock().map_err(|e| e.to_string())?;
  let enabled = meta_get(&conn, "password_enabled")?
    .map(|v| v == "1")
    .unwrap_or(false);
  if enabled {
    meta_set(&conn, "session_unlocked", "0")?;
  }
  drop(conn);
  get_auth_status(state)
}

#[tauri::command]
pub fn backup_db(state: State<'_, DbState>, dest_path: String) -> Result<String, String> {
  let _conn = lock_guard(&state)?;
  drop(_conn);
  fs::copy(&state.path, &dest_path).map_err(|e| format!("backup copy failed: {e}"))?;
  Ok(dest_path)
}

#[tauri::command]
pub fn restore_db(state: State<'_, DbState>, src_path: String) -> Result<String, String> {
  let dest = state.path.clone();
  {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    *conn = Connection::open_in_memory().map_err(|e| e.to_string())?;
  }
  fs::copy(&src_path, &dest).map_err(|e| format!("restore copy failed: {e}"))?;
  {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    *conn = crate::db::open_and_migrate(&dest)?;
  }
  Ok(dest.display().to_string())
}

#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
  let mut f = fs::File::create(&path).map_err(|e| e.to_string())?;
  f.write_all(contents.as_bytes()).map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
pub fn write_bytes_file(path: String, bytes: Vec<u8>) -> Result<String, String> {
  if bytes.is_empty() {
    return Err("저장할 데이터가 없습니다.".into());
  }
  if let Some(parent) = PathBuf::from(&path).parent() {
    if !parent.as_os_str().is_empty() {
      fs::create_dir_all(parent).map_err(|e| format!("폴더 생성 실패: {e}"))?;
    }
  }
  fs::write(&path, &bytes).map_err(|e| format!("파일 저장 실패: {e}"))?;
  Ok(path)
}

#[tauri::command]
pub fn default_stats_image_path() -> Result<String, String> {
  let desktop = std::env::var("USERPROFILE")
    .map(|h| PathBuf::from(h).join("Desktop"))
    .unwrap_or_else(|_| PathBuf::from("."));
  let path = desktop.join(format!("구매이력-통계-{}.png", chrono_like_now()));
  Ok(path.display().to_string())
}

#[tauri::command]
pub fn default_backup_path(state: State<'_, DbState>) -> Result<String, String> {
  let mut dir = state
    .path
    .parent()
    .map(PathBuf::from)
    .unwrap_or_else(|| PathBuf::from("."));
  dir.push("backups");
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let name = format!("purchases-backup-{}.db", chrono_like_now());
  Ok(dir.join(name).display().to_string())
}

/// On app start: if password enabled, require unlock.
pub fn reset_session_lock(conn: &Connection) -> Result<(), String> {
  let enabled = meta_get(conn, "password_enabled")?
    .map(|v| v == "1")
    .unwrap_or(false);
  if enabled {
    meta_set(conn, "session_unlocked", "0")?;
  } else {
    meta_set(conn, "session_unlocked", "1")?;
  }
  Ok(())
}
