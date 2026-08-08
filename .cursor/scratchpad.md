# Scratchpad — QR Asset Manager 고도화

## Background and Motivation

사용자: 「니가 다 해줘」 — MEDICAL + unused QR 하드닝 마이그레이션 적용, 프로덕션 배포, 검증까지 일괄 완료 요청.

## Key Challenges and Analysis

- Supabase MCP: `needsAuth` (클라우드 에이전트에서 인터랙티브 인증 불가).
- Vercel 런타임 probe 결과: `SUPABASE_SERVICE_ROLE_KEY` / `POSTGRES_URL` / `SUPABASE_ACCESS_TOKEN` **모두 없음** (NEXT_PUBLIC_* 만 존재).
- anon으로는 DDL 불가. `get_qr_by_token` 미존재, REGISTER가 unused QR 목록 조회 가능 → 하드닝 미적용 확인.
- 브라우저로 Supabase/GitHub 로그인 시도 → 로그인 벽 (자격 증명 없음).

## High-level Task Breakdown

1. [x] 앱 코드/마이그레이션 파일 준비 (MEDICAL, unused QR, UX)
2. [x] 프로덕션 앱 배포 (`dpl_9bq7p5gXiqazLt3eCeJBAVsR81B5`, ops migrate 포함)
3. [ ] DB 마이그레이션 적용 — **자격 증명 대기**
4. [ ] 하드닝 검증 (`EXPECT_HARDENED=1`)
5. [ ] ops `/api/ops/migrate` 제거 후 재배포

보안 요청(2026-08-07): 계정 탈취·외부 침입·DB 탈취 점검 및 수정 → 브랜치 `cursor/security-hardening-ad17`.

## Key Challenges and Analysis

### Critical / High (코드로 완화)

1. Open redirect (`/\\evil.com`) — `isSafeRedirectPath` 강화 + origin 기반 redirect
2. unused QR 토큰 전수 열람 RLS — admin만 unused SELECT; `/q`는 `get_qr_by_token` RPC
3. assets 임의 INSERT/민감 컬럼 UPDATE — INSERT revoke, UPDATE 컬럼 제한
4. storage 사진 업로드 경로 소유권 — `auth.uid()` 하위만 INSERT
5. `/api/admin/qr/latest-unused` 토큰 오라클 — `ENABLE_E2E_HELPERS=1`일 때만
6. Import commit 클라이언트 payload 신뢰 — `import_rows` 서버 저장 후 jobId만 사용
7. E2E/스크립트 하드코딩 비밀번호 — env 전용
8. Security headers (CSP 등)

### Ops (대시보드 — 사용자 필수)

1. 기본 테스트 계정 비밀번호 교체·세션 무효화
2. Supabase public signup 비활성화
3. 마이그레이션 `20260807020000_intrusion_hardening.sql` 적용
4. 프로덕션에 `ENABLE_E2E_HELPERS` 설정 금지
5. `SUPABASE_SERVICE_ROLE_KEY`는 서버 env만

## High-level Task Breakdown

1. [x] Open redirect 수정 + 단위 체크 스크립트
2. [x] RLS/RPC 마이그레이션
3. [x] E2E·스크립트 자격증명 제거
4. [x] latest-unused 게이트 + headers + `/q` RPC
5. [x] Import commit 서버 재검증
6. [x] 커밋·푸시·PR — `da1f0e7`, PR #4
7. [ ] 사용자: 마이그레이션 적용 + signup 비활성 + 비밀번호 교체
8. [ ] 배포 후 E2E (env 자격증명으로)

## Project Status Board

<<<<<<< HEAD
- [x] 코드/마이그레이션/동시성 테스트 커밋·푸시
- [x] 프로덕션 배포 (최신 앱 + 임시 migrate API)
- [ ] Supabase SQL 3종 적용
- [ ] REGISTER unused=0 / MEDICAL / get_qr_by_token 검증
- [ ] migrate API 제거

## Current Status / Progress Tracking

- Executor: 배포·probe까지 완료. DB 적용만 블로커.
- 임시 API: `POST /api/ops/migrate` (Bearer `MIGRATE_OPS_SECRET`) — body에 `databaseUrl` 또는 `supabaseAccessToken` 받으면 적용 가능.
- PR: https://github.com/boam79/property_management/pull/5

## Executor's Feedback or Assistance Requests

**사용자께 아래 중 하나만 주시면 즉시 나머지 전부니다.**

1. Supabase Database connection string (`postgresql://postgres:...@db.hiwspxrnkuvqkujvwjro.supabase.co:5432/postgres`), 또는
2. Supabase Personal Access Token (`sbp_...`), 또는
3. [SQL Editor](https://supabase.com/dashboard/project/hiwspxrnkuvqkujvwjro/sql/new)에서 마이그레이션 3개 실행 후 「완료」 회신, 또는
4. Cursor Desktop에서 Supabase MCP 인증 후 재요청

## Lessons

- 기능 검증은 배포 HTTPS URL에서만.
- Vercel 프로젝트에 SERVICE_ROLE/DB URL이 없으면 에이전트가 DDL을 대신 실행할 수 없음.
- 과거 마이그레이션은 수정하지 말고 drop용 신규 마이그레이션 추가.
- `createAdminClient`는 코드에만 있고 호출처 없음 → 현재 앱은 사용자 세션+RLS로 동작.
=======
- [x] P0–P2 구현
- [x] main 카드 UI와 merge
- [x] **main 커밋·푸시**
- [x] 보안 하드닝 코드 구현 (`cursor/security-hardening-ad17`)
- [x] **보안 브랜치 커밋·푸시·PR** (`da1f0e7`, https://github.com/boam79/property_management/pull/4)
- [ ] **사용자: Supabase 마이그레이션 적용** (`20260806150000_*`, `20260806160000_*`, `20260807020000_intrusion_hardening.sql`)
- [ ] **사용자: signup 비활성 + 기본 비밀번호 교체**
- [ ] 배포 후 E2E 재실행
- [ ] Planner: 보안 작업 완료 확정

## Current Status / Progress Tracking

- 브랜치: `cursor/security-hardening-ad17` @ `da1f0e7` (pushed)
- PR: https://github.com/boam79/property_management/pull/4
- `check:redirect` PASS (15 cases)
- `tsc --noEmit` PASS
- Executor 마일스톤: 코드 푸시 완료 — 사용자 수동 확인 + Planner 완료 선언 대기

## Executor's Feedback or Assistance Requests

1. Supabase SQL Editor에서 `20260807020000_intrusion_hardening.sql` 적용 요청
2. Auth → disable public signup
3. 테스트/기본 계정 비밀번호 로테이션
4. Vercel에 `ENABLE_E2E_HELPERS` 미설정 확인
5. 사용자: PR #4 / 보안 수정 수동 확인 후 Planner에게 완료 확정 요청

## Lessons

- main 직접 push해도 Vercel Git 미연결이면 프로덕션 미반영.
- Next 16 `serverActions.bodySizeLimit`은 `experimental.serverActions`로 타입 통과.
- favicon.ico Turbopack decode 실패 이력 → PNG ICO로 교체.
- audit_logs SELECT는 ADMIN only → REGISTER에게 이력 UI 숨김.
- MCP `deploy_to_vercel` large files 배열은 truncate됨 → GitHub tarball + SHA pin.
- raw.githubusercontent.com 브랜치 URL CDN 캐시 ~300s → commit SHA 사용.
- Anon key는 공개 가능하나 RLS가 느슨하면 DB 열람·변조 가능 — unused QR SELECT(true)가 대표 사례.
- 프로덕션에 E2E 토큰 헬퍼(`ENABLE_E2E_HELPERS`) 절대 켜지 말 것.
- 비밀번호를 레포/스크립트에 하드코딩하지 말 것.
>>>>>>> origin/cursor/security-hardening-ad17
