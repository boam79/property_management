# Scratchpad — QR Asset Manager 고도화

## Background and Motivation

QR 자산관리 MVP 고도화. 사용자 지시: Planner 제안 후 **Executor로 모두 진행**.

## Key Challenges and Analysis

(이전 Planner 분석 유지) P0/P1 구현 완료. P2(일괄변경·PWA·알림)·P3는 후순위.

**필수 운영 작업:** Supabase에 `20260806150000_enhancements.sql` 적용 전까지 사진·unlink/retire·역할 UI RPC가 실패합니다.

## High-level Task Breakdown

P0-1~P0-4, P1-1~P1-4 완료. P2 일부: 수리/폐기 시 비고 필수만 반영.

## Project Status Board

- [x] P0-1 자산 목록 페이지네이션
- [x] P0-2 자산 Excel/CSV 내보내기
- [x] P0-3 QR 폐기/연결 해제
- [x] P0-4 운영 README
- [x] P1-1 사진 첨부
- [x] P1-2 위치·부서·카테고리 자동완성(datalist)
- [x] P1-3 자산 변경 이력(audit asset.update)
- [x] P1-4 사용자/역할 관리 UI
- [x] (경량) 수리·폐기 시 비고 필수
- [ ] **사용자: Supabase 마이그레이션 적용**
- [ ] **사용자: 배포 URL 수동/E2E 검증**
- [ ] Planner: 전체 완료 확정
- [ ] (후순위) P2 일괄변경·PWA·알림 / P3

## Current Status / Progress Tracking

- 모드: **Executor**
- 브랜치/PR: `cursor/assets-list-pagination-ad17` / https://github.com/boam79/property_management/pull/1
- 로컬: `test:assets-pagination`, `test:assets-export`, `check:no-stub`, lint PASS
- Supabase MCP: needsAuth — 에이전트가 원격 마이그레이션 적용 불가

## Executor's Feedback or Assistance Requests

1. **Supabase SQL Editor**에서 `supabase/migrations/20260806150000_enhancements.sql` 실행 부탁드립니다.
2. Vercel Preview/Production 배포 후 `/assets` 페이지네이션·내보내기, `/admin/qr` 해제·폐기, `/admin/users`, 자산 상세 사진·이력 확인.
3. P2(일괄·PWA·알림) 계속 진행 여부 지시 부탁드립니다.

## Lessons

- E2E/스모크는 배포 HTTPS URL만.
- ADMIN 역할 self-escalation 금지; `admin_set_profile_role` + 트리거가 **타인만** 허용하도록 완화.
- `xlsx` npm audit high — fix 없음, 임포트/익스포트에만 사용.
- 「모두 진행」지시 시 Executor는 검증 대기 없이 P0/P1 연속 구현.
- Supabase MCP 미인증 시 마이그레이션은 사용자 적용 필요.
