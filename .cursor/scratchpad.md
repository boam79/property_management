# Scratchpad — QR Asset Manager 고도화

## Background and Motivation

**구매이력 — 품목 등록 갯수·비고 (Executor, 2026-08-11)**  
사용자 요청: 품목 등록 시 **갯수**·**비고** 칸 추가. schema_version 2 마이그레이션, 버전 **0.1.17** 빌드·커밋·Release.

구매이력 로컬화·웹 구매 잔여 삭제(W1)·데스크톱 업데이트(U1~U3)는 별도 트랙.

**구매이력 UI — 품목·부서 드롭다운 (Planner, 2026-08-08)**  
사용자 요청: 목록 탭의 **등록(품목·사용부서)** 과 **검색·필터(품목·부서)** 텍스트 입력을 드롭다운으로 변경.  
(스크린샷 기준, 약 8000건 · 부서 예: 약국/원무과 등)

**자산관리 설치형 검토 (Planner, 2026-08-08)**  
사용자 확정 답변:
1. **PC 1대만** 사용
2. **이미 등록된 QR**을 폰으로 찍으면 **폰에도 자산 정보가 보여야** 함
3. 클라우드를 **비우는 것이 목적** (비용 절감)

## Key Challenges and Analysis

### 품목·부서 드롭다운 (Planner 분석)

**현황**
- `App.tsx` 등록/수정·검색 모두 `<input>` 자유 텍스트
- 검색은 `LIKE %…%` 부분일치 (`purchases.rs` `list_inner`)
- 마스터 테이블 없음 — 값은 `purchase_histories.item_name` / `department`에만 존재
- 더미 기준 부서는 소수, 품목은 상대적으로 많을 수 있음

**핵심 선택**
1. **옵션 출처** — DB `DISTINCT` (기존 이력에서 수집). 별도 마스터 테이블은 과함 → **비권장**
2. **등록/수정** — 순수 `<select>`만 쓰면 **신규 품목·부서 등록 불가**. → **콤보(선택+직접입력)** 권장 (`<input list>` + `<datalist>`)
3. **검색**  
   - A) 콤보(datalist) + 기존 부분일치 유지  
   - B) `<select>` + «전체» + **정확 일치** (필터 SQL을 `=` 로 바꾸거나, 선택 시 전체 문자열 전달)  
   - **권장:** 부서= B(소수·정확), 품목= A(다수·부분일치 유지) 또는 둘 다 A로 단순화
4. **목록 길이** — 고유값이 수백~수천이면 네이티브 select/datalist가 무거움. 우선 DISTINCT 전체, 느리면 이후 검색형 콤보로 개선
5. **갱신 시점** — 앱 로드·등록/수정/삭제·CSV 가져오기 성공 후 옵션 재조회

**권장 설계 (최소 변경)**
```
[Rust] list_purchase_options → { items: string[], departments: string[] }
       SELECT DISTINCT item_name … ORDER BY item_name
       SELECT DISTINCT department … ORDER BY department

[UI] 등록·수정 품목/부서: <input list="…" /> + datalist (기존 값 선택 + 새 값 입력)
     검색 품목/부서: 동일 datalist (부분일치 유지) 
     또는 검색 부서만 <select><option value="">전체</option>…
```
버전 범프·Release는 Executor 시 기존 패턴(0.1.12) 따름.

### 충돌 한 줄

**“클라우드를 완전히 비움”** 과 **“폰에서 자산 정보 표시”** 는 동시에 성립하기 어렵다.  
폰은 PC 하드디스크를 직접 볼 수 없고, QR은 인터넷 URL로 열리기 때문이다.

→ “완전 0원·완전 빈 DB”가 아니라, **본문은 PC / 클라우드에는 조회용 최소만** 두는 쪽이 비용 절감과 요구를 같이 만족한다.

### 확정 전제

| 항목 | 결정 |
|---|---|
| 관리 UI·본 DB | PC 설치형 1대 (SQLite 등) |
| QR 스캔 UX | 지금과 동일 (HTTPS `/q/[token]`) |
| 다중 PC | 없음 → 동기 충돌 단순 |
| 비용 목표 | Supabase 저장·트래픽 최소화 (가능하면 Free 유지) |

### 권장 아키텍처: **H1-Lite (수신함 + 조회 카드)**

```
[폰 QR] → [얇은 웹 /q] ─┬─ 미등록: 입력 → inbox(임시)에만 저장
                          └─ 등록됨: lookup_card(최소 필드)만 읽어 표시

[PC 앱 1대] ──매일(또는 수동)──► inbox pull → 로컬 본DB merge
              ──성공 후──► inbox 삭제
              ──변경 시──► lookup_card upsert (토큰·표시용 요약만)
              ──본문 전체는 클라우드에 두지 않음──
```

**클라우드에 남는 것 (작음)**  
- `qr_lookup` (또는 동등): `token`, `display_code`, 자산명, 상태, 위치, 부서 등 **화면 표시용 소수 컬럼**  
- `inbox` (짧음): 신규 등록·현장 수정 대기열 — 싱크 후 비움  
- 인증(로그인)용 Auth 사용자 — 필요 시 최소 유지  

**클라우드에서 비우는 것 (비용·본문)**  
- 자산 전문 테이블 대량 보관, 감사로그 장기 보관, 통계용 히스토리, 대용량 임포트 원본 등  
- 일일 싱크 후 **inbox 비우기** + 기존 `assets` 등 **본문을 로컬로 이관 후 클라우드에서 DROP/비우기**

**PC에만 있는 것**  
- 자산 전체 필드, 수정 이력, 임포트, 대시보드 집계, QR 배치 원장, 백업

### 대안 (비권장·참고)

| 안 | 내용 | 평가 |
|---|---|---|
| PC 터널 (Tailscale/Cloudflare)로 폰→PC 직접 조회 | 클라우드 DB 거의 불필요 | 회선·PC 꺼짐·보안·유지보수 부담. 병원/사무실망에서 깨지기 쉬움 |
| 클라우드 완전 삭제 + 폰은 “PC에서 보세요”만 | 비용↓ | **요구 2번 위반** |
| 지금처럼 전부 Supabase | UX 유지 | **비용 절감 목표와 반대** |

### 비용 절감이 실제로 되는 지점

- Supabase Free는 DB 크기·Egress·Auth에 민감.  
- **행 수·컬럼 많은 assets 본문**을 PC로 옮기고 클라우드에는 **QR당 짧은 lookup 1행**만 두면 저장·백업 부담이 크게 줄 수 있음.  
- “DB를 끄고 완전 0”은 Auth+QR URL 호스팅이 남으면 Vercel/정적 호스팅 등은 소액·무료 티어로 가능하나, **lookup 저장소는 어딘가에 필요**.

### 리스크·필수 안전장치

1. **조회 카드와 로컬 본문 불일치** — PC 저장 성공 후에만 lookup upsert  
2. **inbox 삭제 타이밍** — pull·검증·로컬 커밋 성공 후에만 DELETE  
3. **PC 장애** — 로컬 DB 자동 백업(구매이력 앱과 동일 패턴). 클라우드 lookup만으로는 복구 부족  
4. **초기 이관** — 현재 Supabase → 1회 PC로 이전 → 본문 테이블 축소/삭제  
5. **작업량** — 구매이력 이전보다 **훨씬 큰** 프로젝트 (단계 PoC 필수)

### 단계 제안 (승인 후 Executor)

1. **PoC**: inbox 1건 등록 → PC pull → 로컬 저장 → inbox 삭제 → lookup으로 폰 재조회  
2. 자산 목록/수정 PC 앱  
3. 웹 관리 UI 축소(QR만 남김)  
4. 본문 클라우드 비우기·비용 확인  

## High-level Task Breakdown

### 품목 등록 갯수·비고 (0.1.17)

- [ ] **Q1.** `db.rs` schema_version 2 — quantity/notes 컬럼 + ALTER 마이그레이션
- [ ] **Q2.** `purchases.rs` struct/CRUD/validate/CSV
- [ ] **Q3.** `App.tsx`/`App.css` 등록·수정·목록 UI
- [ ] **Q4.** 버전 0.1.17 범프 · tauri:build · 커밋·push · GitHub Release

### 품목·부서 드롭다운

- [x] **D0. 사용자 확정** — 등록·검색 datalist 콤보 + DISTINCT (승인·Executor)
- [x] **D1.** Rust `list_purchase_options`
- [x] **D2.** 목록 탭 UI datalist 4필드
- [x] **D3.** 등록·수정·삭제·CSV·복원 후 옵션 새로고침
- [x] **D4.** 버전 0.1.12 · 커밋·Release

### 자산관리 H1-Lite (기존)

- [x] **A1. 사용자 확인** — lookup 최소 유지 방향으로 진행 의사 확인됨  
- [x] **A2. 폰에 보여줄 필드 목록** — **기본 6개만** 확정 (2026-08-08)  
- [ ] **A3. PoC 범위·일정** 확정 후 Executor 전환  

### 조회용 요약 확정 (6개)

1. QR 표시코드  
2. 자산번호  
3. 자산명  
4. 구분 (일반 / IT / 의료)  
5. 상태 (사용중 / 재고 / 수리 / 폐기)  
6. 위치  

부서·담당자·카테고리·시리얼·구매정보·메모 등은 요약에 **미포함** (PC 본문만).

## Project Status Board

- [ ] 구매이력 0.1.17 — 품목 등록 갯수·비고 (진행 중)
- [x] 구매이력 0.1.16 — 목록 전체 삭제 (커밋·Release)
- [x] 웹 자산등록 메뉴 + 신규 QR 배정 (`/admin/register`)
- [x] W2 웹 구매이력·구매통계 제거 배포 (코드 제거됨·빌드 수정 push `18e76ce`+tsconfig)
- [x] 구매이력 0.1.15 — 검색 필터 초기화 (커밋·Release)
- [x] 구매이력 0.1.14 — 통계 이미지 초고화질(4x) (커밋·Release)
- [x] 구매이력 0.1.13 — 조용한 업데이트 schtasks+hex 경로 (커밋·Release)
- [x] 구매이력 — 품목·부서 드롭다운 (Executor D1~D4 · 0.1.12)
- [x] 구매이력 0.1.11 — 재실행 env 전달(한글 경로 리터럴 제거) (커밋 `7eb0dc9` · Release)
- [x] 구매이력 0.1.10 — 업데이트 확인 jsDelivr stale(0.1.5) 수정 (커밋 `df39bef` · Release)
- [x] 구매이력 0.1.9 — 조용한 업데이트 재실행(한글 경로) 수정 (커밋·Release)
- [x] 구매이력 0.1.8 — 통계 PNG 내보내기 (커밋·Release)
- [ ] U4 데스크톱 Release (대기)
- [ ] W2 웹 구매 삭제 커밋·배포 (대기)
- [x] 자산관리 H1-Lite — 요약 필드 6개 확정
- [ ] 자산관리 H1-Lite — PoC 계획 승인
- [x] W1 웹 구매 잔여 삭제(로컬)
- [x] 구매이력 로컬 앱 / U1~U3

## Executor's Feedback or Assistance Requests

**Executor (2026-08-11) — 0.1.17 갯수·비고**
- 작업 시작: schema v2 마이그레이션 + UI + CSV + Release
- `purchases.rs`/`db.rs`는 전체 재작성 금지(외과적 수정만)

**Executor (2026-08-10) — 웹 구매이력/구매통계 제거·배포**
- 메뉴/라우트는 이미 제거됨. 잔여 `purchase-statistics-charts.tsx` 삭제 (`18e76ce`)
- 프로덕션 빌드 실패 원인: `apps/purchase-desktop`이 root tsconfig에 포함 + lockfile. `tsconfig` exclude 수정 (`ace55d9`)
- Vercel Production 성공: https://property-mgmt-main-c53d.vercel.app
- 수동 확인: 내비에 구매이력/구매통계 없는지

**Executor (2026-08-08) — 0.1.14 통계 이미지 초고화질**
- `toPng` pixelRatio 2 → 4
- 커밋·Release `purchase-desktop-v0.1.14`

**Executor (2026-08-08) — 0.1.13 조용한 업데이트 재수정**
- 원인 추정: Tauri/WebView Job이 앱 종료 시 자식 PowerShell을 같이 종료 + env/경로 전달 취약
- 수정: 경로를 UTF-8 hex로 ASCII `.ps1`에 기록, **schtasks**로 Job 밖 실행, 로그 `%TEMP%\purchase-desktop-update.log`
- 커밋·Release `purchase-desktop-v0.1.13` — **수동 설치 1회 후** 인앱 업데이트 확인 요청

**Executor (2026-08-08) — 0.1.12 품목·부서 드롭다운**
- `list_purchase_options` DISTINCT + 등록/검색 datalist 콤보
- 커밋 `e2ab00c`, Release `purchase-desktop-v0.1.12`
- 설치: https://github.com/boam79/property_management/releases/download/purchase-desktop-v0.1.12/purchase-desktop-0.1.12-x64-setup.exe
- 수동 확인 요청 후 완료 확정

**Executor (2026-08-08) — 0.1.11 재실행 한글 경로 모지바케**
- 증거: `File not found` for `AppData\Local\授ɰℓ?대젯\app.exe` (= `구매이력` 폴더 깨짐). binary는 Tauri `app.exe`
- 원인: 0.1.9 UTF-8 BOM `.ps1`에 `$exe = '...구매이력\app.exe'` **리터럴 삽입** → 일부 환경에서 여전히 디코딩 깨짐
- 수정: 스크립트는 ASCII만 (`$env:PD_SETUP`/`PD_EXE`/`PD_WAIT_PID`). 경로는 `Command.env()` → CreateProcessW 유니코드 env
- 테스트: `relaunch_script_is_ascii_only`, `env_passes_korean_path_to_powershell` 통과
- productName(`구매이력`)은 유지(기존 설치 경로 호환). 버전 **0.1.11**
- 커밋 `7eb0dc9`, Release `purchase-desktop-v0.1.11`
- **0.1.10 이하는 수동 설치 1회 필요** (옛 재실행 스크립트는 계속 깨짐)
- 수동 설치: https://github.com/boam79/property_management/releases/download/purchase-desktop-v0.1.11/purchase-desktop-0.1.11-x64-setup.exe
- Planner/사용자 수동 확인 후 완료 확정 요청

**Executor (2026-08-08) — 0.1.10 업데이트 확인 stale**
- 원인: 앱이 **jsDelivr를 첫 URL**로 조회 → CDN이 `latest.json` **0.1.5**를 캐시. main/GitHub API/Release는 이미 0.1.9였음. 첫 성공에서 break → “최신(서버 0.1.5)”로 오판
- 수정: GitHub Contents API → raw(`?t=`) 우선, Releases API 교차, jsDelivr 최후. 버전 **0.1.10**
- 커밋 `df39bef`, Release `purchase-desktop-v0.1.10`
- **0.1.7 클라이언트는 수동 설치 1회 필요** (옛 바이너리는 여전히 jsDelivr 우선)
- 수동 설치: https://github.com/boam79/property_management/releases/download/purchase-desktop-v0.1.10/purchase-desktop-0.1.10-x64-setup.exe
- Planner/사용자 수동 확인 후 완료 확정 요청

**Executor (2026-08-08) — 0.1.9**
- 재실행 실패 = UTF-8(무BOM) `.cmd`가 `구매이력` 경로를 깨뜨림. PowerShell UTF-8 BOM + ASCII 설치 임시경로 + PID 대기로 수정
- 커밋 `c1290be`, Release `purchase-desktop-v0.1.9`

**Planner (2026-08-08) — 품목·부서 드롭다운**
- 계획 승인·Executor 완료 (0.1.12)

**Planner (기존)**
- 요약 필드 6개 확정
- 설계 문서를 `docs/ASSET_LOCAL_HYBRID_PLAN.md` 로 커밋·push (구현 보류)
- PoC는 나중에 이 문서 기준으로 재개

## Lessons

- PC 1대여도 “폰 조회”가 있으면 클라우드(또는 동등 원격 저장) 최소 조각은 필요
- 비용 절감 = 본문 이전 + inbox 비우기 + lookup 최소화 (완전 삭제과 구분)
- pull 성공 전 cloud DELETE 금지
- 조회 요약 필드 기본안은 현행 `/q` assigned 화면과 맞추는 것이 UX 일관성에 좋음
- 사용자 확정: lookup은 6개만 (표시코드·자산번호·자산명·구분·상태·위치)
- 자산관리 하이브리드 정식 문서는 `docs/ASSET_LOCAL_HYBRID_PLAN.md`
- Windows `.cmd`를 UTF-8(무BOM)으로 쓰면 한글 경로(productName `구매이력`)가 깨짐 → PowerShell `-File` + UTF-8 BOM 사용
- **UTF-8 BOM `.ps1`에 한글 경로 리터럴을 넣어도 깨질 수 있음** → `.cmd`/`.ps1` 텍스트에 한글 경로를 절대 넣지 말 것. `Command.env()`(CreateProcessW) 또는 8.3 short path 사용
- jsDelivr `gh/...@main` 은 강하게 캐시됨 → 업데이트 매니페스트는 GitHub Contents/Releases API 우선, jsDelivr는 최후. 배포 후 `purge.jsdelivr.net`로 퍼지 가능하나 클라이언트 순서 수정이 근본 해결
- 옛 클라이언트(jsDelivr 우선)는 CDN이 고쳐져도 코드 수정 빌드를 한 번 수동 설치해야 이후 인앱 업데이트가 안전
- 재실행 버그 수정본도 **한 번 수동 설치**해야 이후 인앱 업데이트의 자동 재실행이 새 로직을 씀
