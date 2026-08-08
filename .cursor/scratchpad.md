# Scratchpad — QR Asset Manager 고도화

## Background and Motivation

사용자: 「전부 진행해」 + 「Planner」 — Cloud 블로커(마이그레이션·통합·검증) 해소 후 Planner 교차확인·완료 여부 판정.

## Key Challenges and Analysis

### Planner 교차확인 (2026-08-08)

| 기준 | 결과 |
|---|---|
| 원격 DB 마이그레이션 (enhancements~unused_qr) | **통과** — 12개 버전 기록 |
| classify + security → main | **통과** — `fb3b1b7` |
| ops migrate API 제거 | **통과** |
| 프로덕션 HTTPS E2E | **통과** — 8/8 |
| Vercel MCP로 기존 프로젝트 재배포 | **실패(403)** — 앱은 이미 MEDICAL UI·플로우 서빙, DB는 Desktop 맞춤으로 기능 검증 OK |
| Auth signup OFF / 시드 비밀번호 교체 | **미완(사용자 대시보드)** |

### 판정
- **고도화·Cloud 블로커 과제: 완료**로 마킹한다.
- 남은 항목은 제품 기능이 아니라 **운영 보안 수동 조치** 2건(+권장 Redeploy 1건).

## High-level Task Breakdown

1. [x] origin/main 동기화 + classify/security merge
2. [x] 원격 DB 마이그레이션 적용
3. [x] main 푸시 + ops migrate API 제거
4. [x] 프로덕션 Playwright E2E 8/8
5. [x] Planner 교차확인·완료 마킹
6. [ ] (사용자) signup OFF + 시드 비밀번호 교체
7. [ ] (선택) Vercel Git↔main Redeploy

## Project Status Board

- [x] DB 마이그레이션 적용
- [x] classify + security → main 푸시
- [x] 프로덕션 E2E 8/8
- [x] **Planner: 고도화/Cloud 블로커 과제 완료**
- [ ] 사용자: signup OFF + 시드 비밀번호 교체
- [ ] (선택) Vercel Git 연동 Redeploy

## Current Status / Progress Tracking

- 모드: **Executor** (사용자: 커밋하고 배포해)
- GitHub main: `a7ee275` (Planner docs + deploy archive pin)
- 기존 `property-management` MCP Production Deploy: **403**
- 신규 배포: `qr-asset-mgr-20260808` / `dpl_rjnAz5HQhWkhKp7zx5yVKuQ5h663`
  - https://qr-asset-mgr-20260808-ckadltmfxhrxhrxhr-5008s-projects.vercel.app (Vercel SSO 302)
  - Inspector: https://vercel.com/ckadltmfxhrxhrxhr-5008s-projects/qr-asset-mgr-20260808/rjnAz5HQhWkhKp7zx5yVKuQ5h663
- 기존 공개 프로덕션: https://property-management-eight-rouge.vercel.app

## Executor's Feedback or Assistance Requests

(Planner) 사용자께:
1. Supabase Auth → Allow new users to sign up **OFF**
2. `admin@example.com` / `register@example.com` 비밀번호 교체
3. (권장) Vercel `property-management` ← GitHub `main` Redeploy — MCP 403 우회

추가 기능 개발이 필요하면 새 요청 + 모드(Planner/Executor)를 지정해 주세요.

## Lessons

- storage.objects DELETE 금지
- unpack.cjs 금지
- Vercel MCP 재인증 후에도 기존 프로젝트 deploy 권한 없을 수 있음
- Playwright `getByText`는 route announcer와 중복 → heading role 사용
- Cloud DDL 블로커는 Desktop Supabase MCP로 해소 가능
