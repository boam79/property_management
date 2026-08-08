use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::fs::File;
use std::io::Write;
use std::process::Command;
use std::time::Duration;
use tauri::AppHandle;

const REPO: &str = "boam79/property_management";
const MANIFEST_PATH: &str = "apps/purchase-desktop/release/latest.json";
const RELEASES_API_URL: &str =
  "https://api.github.com/repos/boam79/property_management/releases?per_page=30";

/// UI/로그용 대표 URL (GitHub Contents API — CDN 캐시 없음)
pub const UPDATE_CHECK_URL: &str =
  "https://api.github.com/repos/boam79/property_management/contents/apps/purchase-desktop/release/latest.json?ref=main";

/// 캐시 회피: GitHub API → raw(?t=) → jsDelivr(최후, 자주 stale)
fn manifest_check_urls() -> Vec<String> {
  let t = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_secs())
    .unwrap_or(0);
  vec![
    format!("https://api.github.com/repos/{REPO}/contents/{MANIFEST_PATH}?ref=main&t={t}"),
    format!("https://raw.githubusercontent.com/{REPO}/main/{MANIFEST_PATH}?t={t}"),
    // jsDelivr @main 은 수 시간~일 단위로 오래될 수 있음 → 최후 수단만
    format!("https://cdn.jsdelivr.net/gh/{REPO}@main/{MANIFEST_PATH}?t={t}"),
  ]
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct VersionHistoryEntry {
  pub version: String,
  #[serde(default)]
  pub date: String,
  #[serde(default)]
  pub notes: String,
}

#[derive(Debug, Clone, Deserialize)]
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

#[derive(Debug, Deserialize)]
struct GhReleaseAsset {
  name: String,
  browser_download_url: String,
}

#[derive(Debug, Deserialize)]
struct GhRelease {
  tag_name: String,
  #[serde(default)]
  name: String,
  #[serde(default)]
  body: Option<String>,
  #[serde(default)]
  published_at: Option<String>,
  #[serde(default)]
  draft: bool,
  #[serde(default)]
  prerelease: bool,
  #[serde(default)]
  assets: Vec<GhReleaseAsset>,
}

/// GitHub Releases에서 purchase-desktop-v* 최신 태그를 매니페스트로 변환.
async fn fetch_manifest_from_releases(
  client: &reqwest::Client,
) -> Result<(LatestManifest, String), String> {
  let response = client
    .get(RELEASES_API_URL)
    .header("Accept", "application/vnd.github+json")
    .header("Cache-Control", "no-cache")
    .send()
    .await
    .map_err(|e| format!("Releases API 요청 실패: {e}"))?;

  if !response.status().is_success() {
    return Err(format!("Releases API HTTP {}", response.status()));
  }

  let releases: Vec<GhRelease> = response
    .json()
    .await
    .map_err(|e| format!("Releases API 파싱 실패: {e}"))?;

  let mut best: Option<(String, (u64, u64, u64), GhRelease)> = None;
  for rel in releases {
    if rel.draft || rel.prerelease {
      continue;
    }
    let Some(ver) = rel.tag_name.strip_prefix("purchase-desktop-v") else {
      continue;
    };
    let Ok(sem) = parse_semver(ver) else {
      continue;
    };
    let take = match &best {
      None => true,
      Some((_, prev, _)) => sem.cmp(prev) == Ordering::Greater,
    };
    if take {
      best = Some((ver.to_string(), sem, rel));
    }
  }

  let (version, _, rel) = best.ok_or_else(|| {
    "Releases API에서 purchase-desktop 태그를 찾지 못했습니다.".to_string()
  })?;

  let setup = rel
    .assets
    .iter()
    .find(|a| a.name.ends_with("-x64-setup.exe") || a.name.ends_with("_x64-setup.exe"))
    .ok_or_else(|| format!("Release {version}에 setup.exe 에셋이 없습니다."))?;

  let notes = rel
    .body
    .as_deref()
    .unwrap_or("")
    .lines()
    .next()
    .unwrap_or(&rel.name)
    .trim()
    .to_string();

  let published_at = rel
    .published_at
    .as_deref()
    .and_then(|s| s.get(..10))
    .map(|s| s.to_string());

  Ok((
    LatestManifest {
      version,
      notes,
      url: setup.browser_download_url.clone(),
      published_at,
      history: Vec::new(),
    },
    RELEASES_API_URL.to_string(),
  ))
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

  // 1) latest.json — GitHub Contents/raw 우선 (jsDelivr는 CDN stale 위험으로 여기서 제외)
  for url in manifest_check_urls() {
    if url.contains("jsdelivr.net") {
      continue;
    }
    let mut req = client.get(&url).header("Cache-Control", "no-cache");
    if url.contains("api.github.com") {
      req = req.header("Accept", "application/vnd.github.raw+json");
    }
    match req.send().await {
      Ok(response) if response.status().is_success() => match response.json::<LatestManifest>().await {
        Ok(m) => {
          used_url = url;
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

  // 2) GitHub Releases API와 교차 — 둘 중 더 높은 버전 채택 (파일/CDN 지연 방어)
  match fetch_manifest_from_releases(&client).await {
    Ok((from_rel, src)) => match &manifest {
      None => {
        used_url = src;
        manifest = Some(from_rel);
      }
      Some(from_json) => {
        if is_newer(&from_rel.version, &from_json.version).unwrap_or(false) {
          let mut merged = from_rel;
          merged.history = from_json.history.clone();
          used_url = src;
          manifest = Some(merged);
        }
      }
    },
    Err(e) => {
      if manifest.is_none() {
        last_err = format!("{last_err} / {e}");
      }
    }
  }

  // 3) 최후: jsDelivr (위가 모두 실패할 때만)
  if manifest.is_none() {
    for url in manifest_check_urls() {
      if !url.contains("jsdelivr.net") {
        continue;
      }
      match client
        .get(&url)
        .header("Cache-Control", "no-cache")
        .send()
        .await
      {
        Ok(response) if response.status().is_success() => {
          match response.json::<LatestManifest>().await {
            Ok(m) => {
              used_url = url;
              manifest = Some(m);
              break;
            }
            Err(e) => last_err = format!("latest.json 파싱 실패 ({url}): {e}"),
          }
        }
        Ok(response) => {
          last_err = format!("업데이트 정보 HTTP {} ({url})", response.status());
        }
        Err(e) => last_err = format!("업데이트 정보 요청 실패 ({url}): {e}"),
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
    // 스케줄/분리 프로세스가 뜬 뒤 종료 → 설치본이 exe를 덮어쓸 수 있음
    std::thread::sleep(Duration::from_millis(1500));
    handle.exit(0);
  });

  Ok(path_str)
}

fn path_to_utf8_hex(path: &std::path::Path) -> Result<String, String> {
  let s = path
    .to_str()
    .ok_or_else(|| format!("경로를 UTF-8로 변환할 수 없습니다: {path:?}"))?;
  Ok(s.as_bytes().iter().map(|b| format!("{b:02x}")).collect())
}

/// 재실행용 PowerShell — **ASCII만**. 경로는 hex(UTF-8)로 넣어 디코딩 (env/리터럴 깨짐·Job 종료 회피).
fn relaunch_ps_script(setup_hex: &str, exe_hex: &str, wait_pid: u32) -> String {
  format!(
    concat!(
      "$ErrorActionPreference = 'Stop'\r\n",
      "function Decode-HexUtf8([string]$hex) {{\r\n",
      "  if ([string]::IsNullOrEmpty($hex)) {{ throw 'empty hex' }}\r\n",
      "  $bytes = New-Object byte[] ($hex.Length / 2)\r\n",
      "  for ($i = 0; $i -lt $hex.Length; $i += 2) {{\r\n",
      "    $bytes[$i/2] = [Convert]::ToByte($hex.Substring($i, 2), 16)\r\n",
      "  }}\r\n",
      "  return [Text.Encoding]::UTF8.GetString($bytes)\r\n",
      "}}\r\n",
      "$log = Join-Path $env:TEMP 'purchase-desktop-update.log'\r\n",
      "function Log([string]$m) {{\r\n",
      "  Add-Content -LiteralPath $log -Value ((Get-Date -Format o) + ' ' + $m) -Encoding UTF8\r\n",
      "}}\r\n",
      "try {{\r\n",
      "  Log 'start'\r\n",
      "  $setup = Decode-HexUtf8 '{setup_hex}'\r\n",
      "  $exe = Decode-HexUtf8 '{exe_hex}'\r\n",
      "  $pidToWait = {wait_pid}\r\n",
      "  Log ('setup=' + $setup)\r\n",
      "  Log ('exe=' + $exe)\r\n",
      "  Log ('waitPid=' + $pidToWait)\r\n",
      "  $deadline = (Get-Date).AddSeconds(120)\r\n",
      "  while ((Get-Date) -lt $deadline) {{\r\n",
      "    $alive = Get-Process -Id $pidToWait -ErrorAction SilentlyContinue\r\n",
      "    if ($null -eq $alive) {{ break }}\r\n",
      "    Start-Sleep -Milliseconds 400\r\n",
      "  }}\r\n",
      "  Start-Sleep -Seconds 1\r\n",
      "  if (-not (Test-Path -LiteralPath $setup)) {{ throw ('installer missing: ' + $setup) }}\r\n",
      "  Log 'running installer /S'\r\n",
      "  $p = Start-Process -FilePath $setup -ArgumentList '/S' -PassThru -Wait\r\n",
      "  Log ('installer exit=' + $p.ExitCode)\r\n",
      "  Start-Sleep -Seconds 2\r\n",
      "  $tries = 0\r\n",
      "  while ($tries -lt 20) {{\r\n",
      "    if (Test-Path -LiteralPath $exe) {{ break }}\r\n",
      "    Start-Sleep -Milliseconds 500\r\n",
      "    $tries++\r\n",
      "  }}\r\n",
      "  if (-not (Test-Path -LiteralPath $exe)) {{ throw ('app exe missing after install: ' + $exe) }}\r\n",
      "  Log 'relaunch'\r\n",
      "  Start-Process -FilePath $exe\r\n",
      "  Remove-Item -LiteralPath $setup -Force -ErrorAction SilentlyContinue\r\n",
      "  Log 'done'\r\n",
      "}} catch {{\r\n",
      "  Log ('ERROR ' + $_.Exception.Message)\r\n",
      "}}\r\n",
      "Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue\r\n",
    ),
    setup_hex = setup_hex,
    exe_hex = exe_hex,
    wait_pid = wait_pid,
  )
}

fn write_ascii_ps1(path: &std::path::Path, content: &str) -> Result<(), String> {
  if !content.is_ascii() {
    return Err("재실행 스크립트에 non-ASCII가 포함되어 있습니다.".into());
  }
  let mut bytes = vec![0xEF, 0xBB, 0xBF];
  bytes.extend_from_slice(content.as_bytes());
  std::fs::write(path, bytes).map_err(|e| format!("재실행 스크립트 작성 실패: {e}"))
}

/// 앱 Job이 자식 프로세스를 같이 죽이는 경우를 피하기 위해 예약 작업으로 1회 실행.
#[cfg(target_os = "windows")]
fn spawn_via_schtasks(script_path: &std::path::Path) -> Result<(), String> {
  let task = format!("PurchaseDesktopUpdate{}", std::process::id());
  let tr = format!(
    "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"{}\"",
    script_path.to_string_lossy()
  );
  // /ST 필수 — 현재+2분으로 등록한 뒤 즉시 /Run (과거 시각 거부 회피)
  let st = {
    let now = std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .map(|d| d.as_secs())
      .unwrap_or(0)
      + 120;
    // 로컬 시각이 아니라 UTC 기반이면 schtasks가 거절할 수 있어, PowerShell로 로컬 HH:mm 산출
    let out = Command::new("powershell")
      .args([
        "-NoProfile",
        "-Command",
        "(Get-Date).AddMinutes(2).ToString('HH:mm')",
      ])
      .output()
      .map_err(|e| format!("시각 계산 실패: {e}"))?;
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s.len() == 5 && s.chars().nth(2) == Some(':') {
      s
    } else {
      let _ = now;
      "23:59".to_string()
    }
  };
  let create = Command::new("schtasks")
    .args([
      "/Create",
      "/TN",
      &task,
      "/TR",
      &tr,
      "/SC",
      "ONCE",
      "/ST",
      &st,
      "/F",
      "/RL",
      "LIMITED",
    ])
    .output()
    .map_err(|e| format!("schtasks create 실패: {e}"))?;
  if !create.status.success() {
    let err = String::from_utf8_lossy(&create.stderr);
    let out = String::from_utf8_lossy(&create.stdout);
    return Err(format!("schtasks create 실패: {err}{out}"));
  }
  let run = Command::new("schtasks")
    .args(["/Run", "/TN", &task])
    .output()
    .map_err(|e| format!("schtasks run 실패: {e}"))?;
  if !run.status.success() {
    let _ = Command::new("schtasks")
      .args(["/Delete", "/TN", &task, "/F"])
      .output();
    let err = String::from_utf8_lossy(&run.stderr);
    return Err(format!("schtasks run 실패: {err}"));
  }
  let task_clone = task.clone();
  std::thread::spawn(move || {
    std::thread::sleep(Duration::from_secs(180));
    let _ = Command::new("schtasks")
      .args(["/Delete", "/TN", &task_clone, "/F"])
      .output();
  });
  Ok(())
}

/// NSIS `/S` 설치 후 재실행. 경로는 hex로 .ps1에 넣고, 실행은 schtasks로 Job 밖 분리.
fn spawn_silent_upgrade_and_relaunch(
  setup_path: &std::path::Path,
  app_exe: &std::path::Path,
) -> Result<(), String> {
  let pid = std::process::id();
  let setup_hex = path_to_utf8_hex(setup_path)?;
  let exe_hex = path_to_utf8_hex(app_exe)?;
  let script = relaunch_ps_script(&setup_hex, &exe_hex, pid);
  let script_path = std::env::temp_dir().join(format!("purchase-desktop-relaunch-{pid}.ps1"));
  write_ascii_ps1(&script_path, &script)?;

  #[cfg(target_os = "windows")]
  {
    use std::os::windows::process::CommandExt;
    // 1순위: 예약 작업 (앱 Job 종료와 무관하게 생존)
    if spawn_via_schtasks(&script_path).is_ok() {
      return Ok(());
    }

    // 2순위: breakaway + start
    const FLAGS: u32 = 0x00000008 | 0x00000200 | 0x08000000 | 0x01000000;
    let script_arg = script_path.to_string_lossy().to_string();
    let mut cmd = Command::new("cmd");
    cmd.args([
      "/C",
      "start",
      "",
      "/MIN",
      "powershell.exe",
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-WindowStyle",
      "Hidden",
      "-File",
      &script_arg,
    ])
    .creation_flags(FLAGS);
    match cmd.spawn() {
      Ok(_) => Ok(()),
      Err(e1) => {
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
          .map_err(|e2| format!("재실행 스크립트 시작 실패: schtasks/start/{e1} / powershell/{e2}"))
          .map(|_| ())
      }
    }
  }

  #[cfg(not(target_os = "windows"))]
  {
    let _ = (setup_path, app_exe, script_path);
    Err("조용한 업데이트+재실행은 Windows에서만 지원됩니다.".into())
  }
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

  #[test]
  fn relaunch_script_is_ascii_only_and_hex_paths() {
    let setup = std::path::Path::new(r"C:\Temp\setup.exe");
    let exe = std::path::Path::new(r"C:\Users\tttt\AppData\Local\구매이력\app.exe");
    let setup_hex = path_to_utf8_hex(setup).unwrap();
    let exe_hex = path_to_utf8_hex(exe).unwrap();
    let s = relaunch_ps_script(&setup_hex, &exe_hex, 12345);
    assert!(s.is_ascii(), "relaunch .ps1 must be ASCII-only");
    assert!(s.contains(&setup_hex));
    assert!(s.contains(&exe_hex));
    assert!(s.contains("Decode-HexUtf8"));
    assert!(!s.contains("구매이력"));
    assert!(!s.contains("$env:PD_SETUP"));
  }

  #[test]
  fn write_ascii_ps1_rejects_non_ascii() {
    let path = std::env::temp_dir().join("purchase-desktop-ascii-reject-test.ps1");
    let err = write_ascii_ps1(&path, "$x = '구매이력'\r\n").unwrap_err();
    assert!(err.contains("non-ASCII"));
    let _ = std::fs::remove_file(&path);
  }

  #[test]
  fn utf8_hex_roundtrip_korean() {
    let p = std::path::Path::new(r"C:\Users\tttt\AppData\Local\구매이력\app.exe");
    let hex = path_to_utf8_hex(p).unwrap();
    assert!(hex.is_ascii());
    let bytes: Vec<u8> = (0..hex.len())
      .step_by(2)
      .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).unwrap())
      .collect();
    let got = String::from_utf8(bytes).unwrap();
    assert_eq!(got, p.to_str().unwrap());
  }
}
