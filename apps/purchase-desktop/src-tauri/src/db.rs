use rusqlite::Connection;
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, State};
use std::sync::Mutex;

pub struct DbState {
  pub conn: Mutex<Connection>,
  pub path: PathBuf,
}

#[derive(Debug, Serialize)]
pub struct DbInfo {
  pub path: String,
  pub table_ok: bool,
  pub row_count: i64,
  pub schema_version: i64,
}

fn db_file_path(app: &AppHandle) -> Result<PathBuf, String> {
  let dir = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("app_data_dir: {e}"))?;
  std::fs::create_dir_all(&dir).map_err(|e| format!("create_dir_all: {e}"))?;
  Ok(dir.join("purchases.db"))
}

fn column_exists(conn: &Connection, table: &str, column: &str) -> Result<bool, String> {
  let mut stmt = conn
    .prepare(&format!("PRAGMA table_info({table})"))
    .map_err(|e| format!("table_info: {e}"))?;
  let names = stmt
    .query_map([], |row| row.get::<_, String>(1))
    .map_err(|e| format!("table_info map: {e}"))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("table_info rows: {e}"))?;
  Ok(names.iter().any(|n| n == column))
}

fn migrate_schema(conn: &Connection) -> Result<(), String> {
  if !column_exists(conn, "purchase_histories", "quantity")? {
    conn
      .execute(
        "ALTER TABLE purchase_histories ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1",
        [],
      )
      .map_err(|e| format!("add quantity: {e}"))?;
  }
  if !column_exists(conn, "purchase_histories", "notes")? {
    conn
      .execute(
        "ALTER TABLE purchase_histories ADD COLUMN notes TEXT NOT NULL DEFAULT ''",
        [],
      )
      .map_err(|e| format!("add notes: {e}"))?;
  }
  conn
    .execute(
      "INSERT INTO app_meta (key, value) VALUES ('schema_version', '2')
       ON CONFLICT(key) DO UPDATE SET value = '2'",
      [],
    )
    .map_err(|e| format!("schema_version: {e}"))?;
  Ok(())
}

pub fn open_and_migrate(path: &Path) -> Result<Connection, String> {
  let conn = Connection::open(path).map_err(|e| format!("open db: {e}"))?;
  conn
    .execute_batch(
      r#"
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS purchase_histories (
        id TEXT PRIMARY KEY NOT NULL,
        item_name TEXT NOT NULL
          CHECK (length(trim(item_name)) > 0 AND length(item_name) <= 200),
        purchase_date TEXT NOT NULL
          CHECK (length(purchase_date) = 10),
        department TEXT NOT NULL
          CHECK (length(trim(department)) > 0 AND length(department) <= 100),
        quantity INTEGER NOT NULL DEFAULT 1
          CHECK (quantity >= 1 AND quantity <= 999999),
        notes TEXT NOT NULL DEFAULT ''
          CHECK (length(notes) <= 1000),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS purchase_histories_purchase_date_idx
        ON purchase_histories (purchase_date DESC);

      CREATE INDEX IF NOT EXISTS purchase_histories_department_idx
        ON purchase_histories (department);

      CREATE INDEX IF NOT EXISTS purchase_histories_item_name_idx
        ON purchase_histories (item_name);

      INSERT INTO app_meta (key, value)
      VALUES ('schema_version', '1')
      ON CONFLICT(key) DO NOTHING;
      "#,
    )
    .map_err(|e| format!("migrate: {e}"))?;
  migrate_schema(&conn)?;
  Ok(conn)
}

pub fn init_db(app: &AppHandle) -> Result<DbState, String> {
  let path = db_file_path(app)?;
  let conn = open_and_migrate(&path)?;
  crate::purchases::reset_session_lock(&conn)?;
  log::info!("SQLite ready at {}", path.display());
  Ok(DbState {
    conn: Mutex::new(conn),
    path,
  })
}

pub fn read_db_info(state: &DbState) -> Result<DbInfo, String> {
  let conn = state.conn.lock().map_err(|e| format!("lock: {e}"))?;

  let table_ok: bool = conn
    .query_row(
      "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='purchase_histories'",
      [],
      |row| row.get::<_, i64>(0),
    )
    .map(|n| n == 1)
    .map_err(|e| format!("table check: {e}"))?;

  let row_count: i64 = if table_ok {
    conn
      .query_row("SELECT COUNT(*) FROM purchase_histories", [], |row| row.get(0))
      .map_err(|e| format!("count: {e}"))?
  } else {
    0
  };

  let schema_version: i64 = conn
    .query_row(
      "SELECT value FROM app_meta WHERE key = 'schema_version'",
      [],
      |row| {
        let v: String = row.get(0)?;
        Ok(v.parse::<i64>().unwrap_or(0))
      },
    )
    .unwrap_or(0);

  Ok(DbInfo {
    path: state.path.display().to_string(),
    table_ok,
    row_count,
    schema_version,
  })
}

#[tauri::command]
pub fn get_db_info(state: State<'_, DbState>) -> Result<DbInfo, String> {
  read_db_info(&state)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn creates_schema_and_reports_ok() {
    let dir = std::env::temp_dir().join(format!(
      "purchase-db-test-{}",
      uuid::Uuid::new_v4()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("purchases.db");

    let conn = open_and_migrate(&path).expect("migrate");
    let state = DbState {
      conn: Mutex::new(conn),
      path: path.clone(),
    };
    let info = read_db_info(&state).expect("info");

    assert!(path.exists());
    assert!(info.table_ok);
    assert_eq!(info.schema_version, 2);
    assert_eq!(info.row_count, 0);

    let _ = std::fs::remove_dir_all(dir);
  }
}
