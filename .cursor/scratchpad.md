# Scratchpad — QR Asset Manager 고도화

## Background and Motivation

사용자: 「전부 진행해」 — Cloud에서 막힌 Supabase 마이그레이션 + classify/보안 통합 + 배포·검증을 Desktop에서 일괄 진행.

## Key Challenges and Analysis

- Cloud는 Supabase MCP 인증 불가 → Desktop MCP로 DDL 적용 완료.
- `storage.objects` 직접 DELETE 차단 → 사진 제거는 테이블/정책만 drop.
- 기존 Vercel 프로젝트 `property-management`는 MCP Production Deploy 403.
- E2E는 배포 HTTPS만.

## High-level Task Breakdown

1. [x] origin/main 동기화 + classify/security merge
2. [x] 원격 DB 마이그레이션 적용
3. [x] main 푸시 + ops migrate API 제거
4. [~] Vercel 기존 프로젝트 재배포 — 권한 부족 (Dashboard 필요)
5. [~] 프로덕션 E2E — 7/8 후 QR 생성 assertion 수정 중

## Project Status Board

- [x] DB 마이그레이션 (enhancements/p2/intrusion/drop_photos/MEDICAL/unused_qr)
- [x] 코드 통합 → `main` `0f645ce`+
- [ ] Vercel `property-management` Redeploy (사용자)
- [ ] E2E QR 배치 테스트 안정화
- [ ] signup OFF + 시드 비밀번호 교체 (사용자)

## Current Status / Progress Tracking

- Executor 진행 중
- 프로덕션: https://property-management-eight-rouge.vercel.app
- QR 현장 플로우 E2E 통과 (DB hardning + get_qr_by_token 동작 확인)

## Executor's Feedback or Assistance Requests

1. Vercel Dashboard → property-management → Git 연결/`main` Redeploy
2. Auth signup 비활성 + 비밀번호 교체
3. Planner 완료 확정

## Lessons

- storage.objects DELETE 금지
- unpack.cjs 금지
- Vercel MCP 재인증 후에도 기존 프로젝트 deploy 권한 없을 수 있음
- Playwright `getByText`는 route announcer와 중복될 수 있음 → heading role 사용
