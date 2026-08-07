# Scratchpad — QR Asset Manager 고도화

## Background and Motivation

고도화 P0–P2 + main 카드 대시보드 병합 완료.

## Project Status Board

- [x] P0–P2 구현
- [x] main 카드 UI와 merge
- [x] **main 커밋·푸시** (`8c21b43`, `f9c1162`)
- [x] 유저스토리 버그 수정 (scan auth, upload limit, history gate, revalidate, search escape, favicon)
- [x] **프로덕션 Redeploy READY** (`dpl_NXQjvwhPEPUaAKZPdC1LYZuzi4FA` → eight-rouge)
- [x] 배포 후 E2E 재실행 (admin 7/7 PASS)
- [ ] **사용자: Supabase 마이그레이션 적용**
- [ ] **사용자: Vercel에 `SUPABASE_SERVICE_ROLE_KEY` 확인** + Git 연동(선택)

## Current Status / Progress Tracking

- 배포 브랜치: `cursor/vercel-archive-deploy-ad17` (PR #3)
- 프로덕션: `dpl_NXQjvwhPEPUaAKZPdC1LYZuzi4FA` READY → `https://property-management-eight-rouge.vercel.app`
- E2E admin: **7 passed** (2026-08-07)
- 검증: `/manifest.webmanifest` 200, `/scan` → `/login?redirect=%2Fscan`

## Executor's Feedback or Assistance Requests

1. Planner/사용자: PR #3 머지 여부 확인 요청 (deploy-bundle + force-dynamic)
2. Supabase 마이그레이션 2개 적용 필요
3. Vercel Project Env에 `SUPABASE_SERVICE_ROLE_KEY` 존재 여부 확인 (MCP 배포는 public env만 아카이브에 포함)
4. 가능하면 Vercel↔GitHub 연동으로 main 자동 배포 복구

## Lessons

- main 직접 push해도 Vercel Git 미연결이면 프로덕션 미반영.
- Vercel MCP `deploy_to_vercel`은 큰 files 배열이 잘림 → package.json ENOENT. 작은 restore + GitHub raw tarball로 우회.
- raw.githubusercontent.com 브랜치 URL은 CDN 캐시(최대 ~300s) → **커밋 SHA URL** 사용.
- Next 빌드 프리렌더가 Supabase env 없으면 실패 → `.env.production`(public) + `force-dynamic`.
- Next 16 `serverActions.bodySizeLimit`은 `experimental.serverActions`로 타입 통과.
- favicon.ico Turbopack decode 실패 이력 → PNG ICO로 교체.
- audit_logs SELECT는 ADMIN only → REGISTER에게 이력 UI 숨김.
