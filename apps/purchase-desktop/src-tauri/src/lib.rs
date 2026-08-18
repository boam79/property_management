mod db;
mod issues;
mod purchases;
mod update;

use db::{get_db_info, init_db};
use issues::{
  create_issue, delete_all_issues, delete_issue, get_issue_stats, list_issue_options, list_issues,
  update_issue,
};
use purchases::{
  backup_db, create_purchase, default_backup_path, default_stats_image_path, delete_all_purchases,
  delete_purchase, export_csv, get_auth_status, get_stats, import_csv, list_purchase_options,
  list_purchases, lock_session, restore_db, set_password_enabled, unlock, update_purchase,
  write_bytes_file, write_text_file,
};
use update::{
  check_for_update, download_and_run_update, get_app_version, get_update_check_url, open_external_url,
};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let db_state = init_db(app.handle()).expect("failed to initialize SQLite");
      app.manage(db_state);
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_db_info,
      list_purchases,
      list_purchase_options,
      create_purchase,
      update_purchase,
      delete_purchase,
      delete_all_purchases,
      export_csv,
      import_csv,
      get_stats,
      list_issues,
      list_issue_options,
      create_issue,
      update_issue,
      delete_issue,
      delete_all_issues,
      get_issue_stats,
      get_auth_status,
      set_password_enabled,
      unlock,
      lock_session,
      backup_db,
      restore_db,
      write_text_file,
      write_bytes_file,
      default_backup_path,
      default_stats_image_path,
      get_app_version,
      get_update_check_url,
      check_for_update,
      download_and_run_update,
      open_external_url
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
