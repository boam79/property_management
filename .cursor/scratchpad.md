# Scratchpad — QR Asset Manager 고도화

## Background and Motivation

사용자: 「전부 진행해」 — Cloud에서 막힌 Supabase 마이그레이션 + classify/보안 브랜치 통합 + 프로덕션 배포·검증을 Desktop에서 일괄 진행.

## Key Challenges and Analysis

- Cloud 에이전트는 Supabase MCP 인증 불가 → Desktop MCP로 DDL 적용.
- `storage.objects` 직접 DELETE 차단 → 사진 제거는 테이블/정책만 drop.
- 프로덕션 검증은 배포 HTTPS만 (localhost 금지).
- unpack.cjs Vercel Install 금지.

### Critical / High (코드로 완화)

1. Open redirect — `isSafeRedirectPath` 강화
2. unused QR 토큰 전수 열람 RLS — admin만 unused SELECT; `/q`는 `get_qr_by_token` RPC
3. assets 임의 INSERT/민감 컬럼 UPDATE — INSERT revoke, UPDATE 컬럼 제한
4. MEDICAL 자산 유형 + QR used/unused 분류 UI
5. 자산 사진 기능 제거 (제품 결정)

### Ops (대시보드 — 사용자 필수)

1. 기본 테스트 계정 비밀번호 교체
2. Supabase public signup 비활성화
3. 프로덕션에 `ENABLE_E2E_HELPERS` 설정 금지

## High-level Task Breakdown

1. [x] origin/main 동기화
2. [x] 원격 DB 마이그레이션 적용 (enhancements → p2 → intrusion → drop_photos → MEDICAL → unused_qr)
3. [x] classify + security 브랜치 통합 (`cursor/integrate-cloud-blocked`)
4. [ ] 푸시 + 프로덕션 배포
5. [ ] 배포 후 Playwright E2E
6. [ ] ops migrate API 제거 (검증 후)

## Project Status Board

- [x] P0–P2 + classify/MEDICAL/사진제거 + 보안 하드닝 통합
- [x] Supabase 원격 마이그레이션 적용 (Desktop MCP)
- [ ] integrate 브랜치 푸시 + 프로덕션 배포
- [ ] 배포 후 Playwright E2E
- [ ] 사용자: signup 비활성 + 시드 비밀번호 교체
- [ ] ops `/api/ops/migrate` 제거

## Current Status / Progress Tracking

- 모드: **Executor**
- 브랜치: `cursor/integrate-cloud-blocked` @ merge `3f17618`
- 프로덕션: https://property-management-eight-rouge.vercel.app
- DB: `get_qr_by_token` / MEDICAL / unused QR RLS 적용, `asset_photos` 제거

## Executor's Feedback or Assistance Requests

1. Auth → public signup OFF
2. 시드 계정 비밀번호 교체
3. 배포·E2E 완료 후 Planner 완료 확정

## Lessons

- 기능 검증은 배포 HTTPS URL에서만.
- Cloud는 Supabase MCP 없으면 DDL 불가 — Desktop MCP로 적용.
- `storage.objects` 직접 DELETE는 차단됨.
- 프로덕션에 E2E 토큰 헬퍼(`ENABLE_E2E_HELPERS`) 절대 켜지 말 것.
- unpack.cjs Vercel Install은 사용 금지.
