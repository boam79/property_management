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

## Project Status Board

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
