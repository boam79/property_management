# Scratchpad — QR Asset Manager 고도화

## Background and Motivation

고도화 P0–P2 + main 카드 대시보드 병합 완료.

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
6. [ ] 커밋·푸시·PR (진행 중)
7. [ ] 사용자: 마이그레이션 적용 + signup 비활성 + 비밀번호 교체
8. [ ] 배포 후 E2E (env 자격증명으로)

## Project Status Board

- [x] P0–P2 구현
- [x] main 카드 UI와 merge
- [x] **main 커밋·푸시**
- [x] 보안 하드닝 코드 구현 (`cursor/security-hardening-ad17`)
- [ ] **보안 브랜치 커밋·푸시·PR**
- [ ] **사용자: Supabase 마이그레이션 적용** (`20260806150000_*`, `20260806160000_*`, `20260807020000_intrusion_hardening.sql`)
- [ ] **사용자: signup 비활성 + 기본 비밀번호 교체**
- [ ] 배포 후 E2E 재실행

## Current Status / Progress Tracking

- 브랜치: `cursor/security-hardening-ad17`
- `check:redirect` PASS (15 cases)
- `tsc --noEmit` PASS
- 커밋·푸시 대기

## Executor's Feedback or Assistance Requests

1. Supabase SQL Editor에서 `20260807020000_intrusion_hardening.sql` 적용 요청
2. Auth → disable public signup
3. 테스트/기본 계정 비밀번호 로테이션
4. Vercel에 `ENABLE_E2E_HELPERS` 미설정 확인
5. Planner: 본 마일스톤(보안 코드 푸시) 완료 확인 요청

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
