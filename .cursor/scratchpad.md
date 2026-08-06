# Scratchpad — QR Asset Manager 고도화

## Background and Motivation

고도화 P0–P2 + main 카드 대시보드 병합 완료.

## Project Status Board

- [x] P0–P2 구현
- [x] main 카드 UI와 merge
- [x] **main 커밋·푸시** (`8c21b43`, `f9c1162`)
- [x] 유저스토리 버그 수정 (scan auth, upload limit, history gate, revalidate, search escape, favicon)
- [ ] **사용자: Supabase 마이그레이션 적용**
- [ ] **사용자: Vercel Git 연동/Redeploy** (현재 main 푸시가 자동 배포를 안 탐 — E2E가 구버전에서 실패)
- [ ] 배포 후 E2E 재실행

## Current Status / Progress Tracking

- 브랜치: `main` @ `f9c1162`
- 로컬: lint/tsc/unit PASS
- 프로덕션 `property-management-eight-rouge.vercel.app`: 아직 구기능(QR스캔 등 없음) → GitHub Deployments 비어 있음

## Executor's Feedback or Assistance Requests

1. Vercel Dashboard → property-management → Settings → Git 연결 확인 후 Redeploy
2. Supabase에 `20260806150000_enhancements.sql`, `20260806160000_p2_bulk_update.sql` 적용
3. 배포 후 `PLAYWRIGHT_BASE_URL=https://property-management-eight-rouge.vercel.app npm run test:e2e:admin` 재실행 요청

## Lessons

- main 직접 push해도 Vercel Git 미연결이면 프로덕션 미반영.
- Next 16 `serverActions.bodySizeLimit`은 `experimental.serverActions`로 타입 통과.
- favicon.ico Turbopack decode 실패 이력 → PNG ICO로 교체.
- audit_logs SELECT는 ADMIN only → REGISTER에게 이력 UI 숨김.
