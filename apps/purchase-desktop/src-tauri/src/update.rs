use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::fs::File;
use std::io::Write;
use std::process::Command;
use std::time::Duration;
use tauri::AppHandle;

/// 업데이트 매니페스트 URL (캐시 강한 raw CDN 회피: jsDelivr → GitHub API → raw).
const UPDATE_CHECK_URLS: &[&str] = &[
  "https://cdn.jsdelivr.net/gh/boam79/property_management@main/apps/purchase-desktop/release/latest.json",
  "https://api.github.com/repos/boam79/property_management/contents/apps/purchase-desktop/release/latest.json?ref=main",
  "https://raw.githubusercontent.com/boam79/property_management/main/apps/purchase-desktop/release/latest.json",
];

/// UI/로그용 대표 URL
pub const UPDATE_CHECK_URL: &str = UPDATE_CHECK_URLS[0];

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct VersionHistoryEntry {
  pub version: String,
  #[serde(default)]
  pub date: String,
  #[serde(default)]
  pub notes: String,
}

#[derive(Debug, Deserialize)]
struct LatestManifest {
  version: String,
  #[serde(default)]
  notes: String,
  url: String,
  #[serde(default, rename = "publishedAt")]
  published_at: Option<String>,
  #[serde(default)]
  history: Vec<VersionHistoryEntry>,
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
  pub history: Vec<VersionHistoryEntry>,
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

  let mut last_err = String::from("업데이트 정보를 가져오지 못했습니다.");
  let mut used_url = UPDATE_CHECK_URL.to_string();
  let mut manifest: Option<LatestManifest> = None;

  for url in UPDATE_CHECK_URLS {
    let mut req = client.get(*url).header("Cache-Control", "no-cache");
    if url.contains("api.github.com") {
      req = req.header("Accept", "application/vnd.github.raw+json");
    }
    match req.send().await {
      Ok(response) if response.status().is_success() => match response.json::<LatestManifest>().await {
        Ok(m) => {
          used_url = (*url).to_string();
          manifest = Some(m);
          break;
        }
        Err(e) => {
          last_err = format!("latest.json 파싱 실패 ({url}): {e}");
        }
      },
      Ok(response) => {
        last_err = format!("업데이트 정보 HTTP {} ({url})", response.status());
      }
      Err(e) => {
        last_err = format!("업데이트 정보 요청 실패 ({url}): {e}");
      }
    }
  }

  let manifest = manifest.ok_or(last_err)?;
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
    check_url: used_url,
    published_at: manifest.published_at,
    history: manifest.history,
  })
}

#[tauri::command]
pub async fn download_and_run_update(app: AppHandle, url: String) -> Result<String, String> {
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

  // ASCII 전용 임시 경로 — 한글 productName이 URL/파일명에 섞여도 cmd 코드페이지 깨짐 방지
  let setup_path = std::env::temp_dir().join(format!(
    "purchase-desktop-update-setup-{}.exe",
    std::process::id()
  ));

  {
    let mut file = File::create(&setup_path).map_err(|e| format!("임시 파일 생성 실패: {e}"))?;
    file
      .write_all(&bytes)
      .map_err(|e| format!("임시 파일 저장 실패: {e}"))?;
  }

  let app_exe = std::env::current_exe().map_err(|e| format!("실행 경로 확인 실패: {e}"))?;
  let path_str = setup_path.to_string_lossy().to_string();

  spawn_silent_upgrade_and_relaunch(&setup_path, &app_exe)?;

  let handle = app.clone();
  std::thread::spawn(move || {
    // 업그레이드 스크립트가 떠 있는 뒤 종료 → 설치본이 exe를 덮어쓸 수 있음
    std::thread::sleep(Duration::from_millis(1200));
    handle.exit(0);
  });

  Ok(path_str)
}

/// PowerShell 문자열 리터럴용 이스케이프 (`'` → `''`).
fn ps_quote(path: &str) -> String {
  path.replace('\'', "''")
}

/// UTF-8 BOM 바이트로 스크립트 저장 (PowerShell -File이 한글 경로를 올바르게 읽도록).
fn write_utf8_bom_file(path: &std::path::Path, content: &str) -> Result<(), String> {
  let mut bytes = vec![0xEF, 0xBB, 0xBF];
  bytes.extend_from_slice(content.as_bytes());
  std::fs::write(path, bytes).map_err(|e| format!("재실행 스크립트 작성 실패: {e}"))
}

/// NSIS `/S` 설치를 기다린 뒤 동일 경로로 앱을 다시 실행하는 분리 프로세스.
///
/// 한글 productName(`구매이력.exe`) 경로가 UTF-8(무BOM) .cmd에서 깨지던 문제를 피하기 위해
/// UTF-8 BOM PowerShell 스크립트를 사용한다.
fn spawn_silent_upgrade_and_relaunch(
  setup_path: &std::path::Path,
  app_exe: &std::path::Path,
) -> Result<(), String> {
  let setup = ps_quote(&setup_path.to_string_lossy());
  let exe = ps_quote(&app_exe.to_string_lossy());
  let pid = std::process::id();
  let script_path = std::env::temp_dir().join(format!("purchase-desktop-relaunch-{pid}.ps1"));

  // 1) 앱 PID 종료 대기  2) 조용히 설치(/S)  3) 짧게 대기  4) 재실행  5) 스크립트 삭제
  let script = format!(
    "$ErrorActionPreference = 'Continue'\r\n\
     $setup = '{setup}'\r\n\
     $exe = '{exe}'\r\n\
     $pidToWait = {pid}\r\n\
     $deadline = (Get-Date).AddSeconds(90)\r\n\
     while ((Get-Date) -lt $deadline) {{\r\n\
       $alive = Get-Process -Id $pidToWait -ErrorAction SilentlyContinue\r\n\
       if ($null -eq $alive) {{ break }}\r\n\
       Start-Sleep -Milliseconds 400\r\n\
     }}\r\n\
     Start-Sleep -Seconds 1\r\n\
     if (-not (Test-Path -LiteralPath $setup)) {{\r\n\
       throw \"installer missing: $setup\"\r\n\
     }}\r\n\
     $proc = Start-Process -FilePath $setup -ArgumentList '/S' -PassThru -Wait\r\n\
     Start-Sleep -Seconds 2\r\n\
     if (-not (Test-Path -LiteralPath $exe)) {{\r\n\
       throw \"app exe missing after install: $exe\"\r\n\
     }}\r\n\
     Start-Process -FilePath $exe\r\n\
     Remove-Item -LiteralPath $setup -Force -ErrorAction SilentlyContinue\r\n\
     Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue\r\n"
  );

  write_utf8_bom_file(&script_path, &script)?;

  #[cfg(target_os = "windows")]
  {
    use std::os::windows::process::CommandExt;
    // DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW | CREATE_BREAKAWAY_FROM_JOB
    const FLAGS: u32 = 0x00000008 | 0x00000200 | 0x08000000 | 0x01000000;
    let script_arg = script_path.to_string_lossy().to_string();
    let spawn_result = Command::new("powershell")
      .args([
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-WindowStyle",
        "Hidden",
        "-File",
        &script_arg,
      ])
      .creation_flags(FLAGS)
      .spawn();

    match spawn_result {
      Ok(_) => {}
      Err(_) => {
        // Job breakaway 불가 환경 폴백
        const FLAGS_FALLBACK: u32 = 0x00000008 | 0x00000200 | 0x08000000;
        Command::new("powershell")
          .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-WindowStyle",
            "Hidden",
            "-File",
            &script_arg,
          ])
          .creation_flags(FLAGS_FALLBACK)
          .spawn()
          .map_err(|e| format!("재실행 스크립트 시작 실패: {e}"))?;
      }
    }
  }

  #[cfg(not(target_os = "windows"))]
  {
    let _ = (setup, exe, script_path);
    return Err("조용한 업데이트+재실행은 Windows에서만 지원됩니다.".into());
  }

  Ok(())
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
