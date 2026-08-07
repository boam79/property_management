# Scratchpad — QR Asset Manager 고도화

## Background and Motivation

고도화 P0–P2 + main 카드 대시보드 병합 완료.

보안 하드닝 PR #4 진행 중.

신규 요청(2026-08-07): `/admin/qr`에서 생성된 QR 중 **사용(연결됨)** 과 **미사용** 을 분류해서 보여 달라는 UI 개선. 현재는 배치 목록 + 최근 QR 혼합 테이블(상태 컬럼만)이라 한눈에 분류되지 않음. 프로덕션 스크린샷도 배치 테이블 위주.

## Key Challenges and Analysis

- 데이터 모델에 이미 `qr_codes.status`: `unused` | `assigned` | `retired` 있음.
- Admin은 RLS상 전체 QR SELECT 가능(보안 마이그레이션 적용 시에도 admin 정책).
- 배치별로 미사용/사용 수량을 보여 주려면 `batch_id` + `status` 집계 필요 (앱에서 집계로 충분, 마이그레이션 불필요).
- E2E는 `data-testid="qr-lifecycle-table"` 의존 → 유지.

## High-level Task Breakdown

1. [x] `/admin/qr`에 전체 상태 카운트(미사용/사용/폐기) 표시
2. [x] 배치 테이블에 미사용·사용(연결)·폐기 수량 컬럼 추가
3. [x] QR 목록을 상태 필터 + 구역 분류로 표시
4. [ ] 커밋·푸시·PR
5. [ ] 사용자 수동 확인 후 Planner 완료 확정

## Project Status Board

- [x] 브랜치 `cursor/qr-used-unused-classify-ad17` (from main)
- [x] QR 사용/미사용 분류 UI
- [ ] 커밋·푸시·PR
- [ ] 사용자 확인
- [ ] (별도) 보안 PR #4 / 마이그레이션 ops

## Current Status / Progress Tracking

- 모드: Executor
- 브랜치: `cursor/qr-used-unused-classify-ad17`
- `tsc --noEmit` PASS
- UI: 요약 카드 + 배치별 수량 + 미사용/사용/폐기 섹션·필터

## Executor's Feedback or Assistance Requests

- 배포 반영 후 `/admin/qr`에서 미사용·사용 카드/섹션 수동 확인 요청
- Planner에게 본 기능 완료 확정 요청

## Lessons

- main 직접 push해도 Vercel Git 미연결이면 프로덕션 미반영.
- Anon key는 공개 가능하나 RLS가 느슨하면 DB 열람·변조 가능.
- 프로덕션에 E2E 토큰 헬퍼(`ENABLE_E2E_HELPERS`) 절대 켜지 말 것.
- 비밀번호를 레포/스크립트에 하드코딩하지 말 것.
- 기능 검증은 배포 HTTPS URL에서만 (localhost 대체 금지).
