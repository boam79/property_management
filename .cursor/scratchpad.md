# Scratchpad — QR Asset Manager 고도화

## Background and Motivation

QR 자산관리 MVP 고도화. 사용자 지시: Planner 제안 후 **Executor로 모두 진행**.

## Key Challenges and Analysis

(이전 Planner 분석 유지) P0/P1 구현 완료. P2(일괄변경·PWA·알림)·P3는 후순위.

**필수 운영 작업:** Supabase에 `20260806150000_enhancements.sql` 적용 전까지 사진·unlink/retire·역할 UI RPC가 실패합니다.

## High-level Task Breakdown

P0-1~P0-4, P1-1~P1-4 완료. P2 일부: 수리/폐기 시 비고 필수만 반영.

## Project Status Board

- [x] P0-1 ~ P1-4 (이전)
- [ ] P2-1 이관 워크플로 (담당자·부서·위치 + 사유)
- [ ] P2-2 자산 일괄 상태/위치 변경
- [ ] P2-3 앱내 QR 스캐너 (+ 설치용 manifest)
- [ ] P2-4 대시보드 알림 배지
- [ ] 커밋·푸시·PR 업데이트
- [ ] 사용자: Supabase 마이그레이션 적용 (150000 + 160000)
- [ ] 사용자: 배포 URL 검증

## Current Status / Progress Tracking

- 모드: **Executor**
- 사용자 지시: **계속 진행** → P2 착수
- 브랜치: `cursor/assets-list-pagination-ad17`

## Executor's Feedback or Assistance Requests

- P2 구현 중. 완료 후 마이그레이션 적용·배포 검증 요청 예정.

## Lessons

- E2E/스모크는 배포 HTTPS URL만.
- ADMIN 역할 self-escalation 금지; `admin_set_profile_role` + 트리거가 **타인만** 허용하도록 완화.
- `xlsx` npm audit high — fix 없음, 임포트/익스포트에만 사용.
- 「모두 진행」지시 시 Executor는 검증 대기 없이 P0/P1 연속 구현.
- Supabase MCP 미인증 시 마이그레이션은 사용자 적용 필요.
