# Scratchpad — QR Asset Manager 고도화

## Background and Motivation

고도화 P0–P2 + main 카드 대시보드 병합 완료.
보안 하드닝 PR #4 진행 중.
QR 사용/미사용 분류 UI (PR #5) 배포됨.
추가 요청(2026-08-07): 배치표를 **한 화면**에서 볼 수 있게 — 컬럼 압축·상단 축소·뷰포트 높이 내 스크롤.

## Key Challenges and Analysis

- 배치표가 요약 카드·다수 컬럼 때문에 첫 화면에서 잘림 → 칩 요약 + 상태 단일 컬럼 + max-height 스크롤.
- E2E는 `data-testid="qr-lifecycle-table"` 의존 → 유지. 배치표는 `qr-batch-table` 추가.

## High-level Task Breakdown

1. [x] `/admin/qr`에 전체 상태 카운트(미사용/사용/폐기) 표시
2. [x] 배치 테이블에 미사용·사용(연결)·폐기 수량 컬럼 추가
3. [x] QR 목록을 상태 필터 + 구역 분류로 표시
4. [x] 커밋·푸시·PR — PR #5
5. [x] 배치표 한 화면 맞춤 (컬럼 압축·sticky 헤더)
6. [ ] 커밋·푸시·프로덕션 배포
7. [ ] 사용자 수동 확인 후 Planner 완료 확정

## Project Status Board

- [x] QR 사용/미사용 분류 UI
- [x] 배치표 한 화면 레이아웃
- [ ] 커밋·푸시·배포
- [ ] 사용자 확인
- [ ] (별도) 보안 PR #4 / 마이그레이션 ops

## Current Status / Progress Tracking

- 모드: Executor
- 브랜치: `cursor/qr-used-unused-classify-ad17`
- 배치표: 상단 압축, `미사용/사용/폐기` 한 컬럼, `max-h` + sticky 헤더

## Executor's Feedback or Assistance Requests

- 배포 후 `/admin/qr` 배치표가 한 화면에 보이는지 확인 요청

## Lessons

- main 직접 push해도 Vercel Git 미연결이면 프로덕션 미반영.
- Anon key는 공개 가능하나 RLS가 느슨하면 DB 열람·변조 가능.
- 프로덕션에 E2E 토큰 헬퍼(`ENABLE_E2E_HELPERS`) 절대 켜지 말 것.
- 비밀번호를 레포/스크립트에 하드코딩하지 말 것.
- 기능 검증은 배포 HTTPS URL에서만 (localhost 대체 금지).
- MCP 아카이브 배포 시 빌드용 `NEXT_PUBLIC_*`는 restore 단계에서 주입.
