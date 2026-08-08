use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::fs::File;
use std::io::Write;
use std::process::Command;

/// GitHub monorepo의 latest.json (별도 리포 불필요).
pub const UPDATE_CHECK_URL: &str = "https://raw.githubusercontent.com/boam79/property_management/main/apps/purchase-desktop/release/latest.json";

#[derive(Debug, Deserialize)]
struct LatestManifest {
  version: String,
  #[serde(default)]
  notes: String,
  url: String,
  #[serde(default, rename = "publishedAt")]
  published_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UpdateCheckResult {
  pub current_version: String,
  pub latest_version: String,
  pub notes: String,
  pub url: String,
  pub update_available: bool,
  pub check_url: String,
  pub published_at: Option<String>,
}

#[tauri::command]
pub fn get_app_version() -> String {
  env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub fn get_update_check_url() -> String {
  UPDATE_CHECK_URL.to_string()
}

fn parse_semver(raw: &str) -> Result<(u64, u64, u64), String> {
  let cleaned = raw.trim().trim_start_matches('v');
  let mut parts = cleaned.split('.');
  let major = parts
    .next()
    .ok_or_else(|| format!("버전 형식 오류: {raw}"))?
    .parse::<u64>()
    .map_err(|_| format!("버전 형식 오류: {raw}"))?;
  let minor = parts
    .next()
    .ok_or_else(|| format!("버전 형식 오류: {raw}"))?
    .parse::<u64>()
    .map_err(|_| format!("버전 형식 오류: {raw}"))?;
  let patch = parts
    .next()
    .unwrap_or("0")
    .split(|c: char| !c.is_ascii_digit())
    .next()
    .unwrap_or("0")
    .parse::<u64>()
    .map_err(|_| format!("버전 형식 오류: {raw}"))?;
  Ok((major, minor, patch))
}

fn is_newer(latest: &str, current: &str) -> Result<bool, String> {
  let l = parse_semver(latest)?;
  let c = parse_semver(current)?;
  Ok(l.cmp(&c) == Ordering::Greater)
}

#[tauri::command]
pub async fn check_for_update() -> Result<UpdateCheckResult, String> {
  let current_version = env!("CARGO_PKG_VERSION").to_string();
  let client = reqwest::Client::builder()
    .user_agent(format!("purchase-desktop/{current_version}"))
    .timeout(std::time::Duration::from_secs(20))
    .build()
    .map_err(|e| format!("HTTP 클라이언트 오류: {e}"))?;

  let response = client
    .get(UPDATE_CHECK_URL)
    .send()
    .await
    .map_err(|e| {
      format!(
        "업데이트 정보를 가져오지 못했습니다. 네트워크 또는 게시 상태를 확인하세요. ({e})"
      )
    })?;

  if !response.status().is_success() {
    return Err(format!(
      "업데이트 정보 HTTP {}: 아직 Releases/latest.json이 없을 수 있습니다.",
      response.status()
    ));
  }

  let manifest: LatestManifest = response
    .json()
    .await
    .map_err(|e| format!("latest.json 파싱 실패: {e}"))?;

  if manifest.url.trim().is_empty() {
    return Err("latest.json에 설치파일 url이 없습니다.".into());
  }

  let update_available = is_newer(&manifest.version, &current_version)?;

  Ok(UpdateCheckResult {
    current_version,
    latest_version: manifest.version,
    notes: manifest.notes,
    url: manifest.url,
    update_available,
    check_url: UPDATE_CHECK_URL.to_string(),
    published_at: manifest.published_at,
  })
}

#[tauri::command]
pub async fn download_and_run_update(url: String) -> Result<String, String> {
  if !(url.starts_with("https://") || url.starts_with("http://")) {
    return Err("설치파일 URL이 올바르지 않습니다.".into());
  }

  let current_version = env!("CARGO_PKG_VERSION");
  let client = reqwest::Client::builder()
    .user_agent(format!("purchase-desktop/{current_version}"))
    .timeout(std::time::Duration::from_secs(300))
    .build()
    .map_err(|e| format!("HTTP 클라이언트 오류: {e}"))?;

  let response = client
    .get(&url)
    .send()
    .await
    .map_err(|e| format!("설치파일 다운로드 실패: {e}"))?;

  if !response.status().is_success() {
    return Err(format!("설치파일 HTTP {}", response.status()));
  }

  let bytes = response
    .bytes()
    .await
    .map_err(|e| format!("설치파일 읽기 실패: {e}"))?;

  if bytes.len() < 1024 {
    return Err("다운로드한 파일이 너무 작습니다. URL을 확인하세요.".into());
  }

  let file_name = url
    .rsplit('/')
    .next()
    .filter(|s| s.ends_with(".exe"))
    .unwrap_or("구매이력-update-setup.exe");
  let dest = std::env::temp_dir().join(file_name);

  {
    let mut file = File::create(&dest).map_err(|e| format!("임시 파일 생성 실패: {e}"))?;
    file
      .write_all(&bytes)
      .map_err(|e| format!("임시 파일 저장 실패: {e}"))?;
  }

  let path_str = dest.to_string_lossy().to_string();
  Command::new(&dest)
    .spawn()
    .map_err(|e| format!("설치 프로그램 실행 실패: {e}"))?;

  Ok(path_str)
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
  if !(url.starts_with("https://") || url.starts_with("http://")) {
    return Err("URL이 올바르지 않습니다.".into());
  }
  #[cfg(target_os = "windows")]
  {
    Command::new("cmd")
      .args(["/C", "start", "", &url])
      .spawn()
      .map_err(|e| format!("브라우저 열기 실패: {e}"))?;
    return Ok(());
  }
  #[cfg(not(target_os = "windows"))]
  {
    Err("이 OS에서는 외부 URL 열기가 아직 지원되지 않습니다.".into())
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn semver_newer() {
    assert!(is_newer("0.1.1", "0.1.0").unwrap());
    assert!(!is_newer("0.1.0", "0.1.0").unwrap());
    assert!(!is_newer("0.1.0", "0.1.1").unwrap());
    assert!(is_newer("1.0.0", "0.9.9").unwrap());
  }
}
