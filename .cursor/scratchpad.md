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

- 모드: **Executor**
- GitHub main: `c53d96a` (푸시 완료)
- 기존 `property-management` / eight-rouge: MCP deploy **403** (권한 없음)
- 최신 main 배포: `property-mgmt-main-c53d` / `dpl_Ezrcj8BgguzizULut1daAVFCcnKA`
  - https://property-mgmt-main-c53d-ckadltmfxhrxhrxhr-5008s-projects.vercel.app
  - Inspector: https://vercel.com/ckadltmfxhrxhrxhr-5008s-projects/property-mgmt-main-c53d/Ezrcj8BgguzizULut1daAVFCcnKA
- eight-rouge에 붙이려면 사용자 Dashboard에서 도메인 이전 또는 Git 연동 Redeploy 필요

## Executor's Feedback or Assistance Requests

(Planner/사용자) GitHub main Redeploy:

1. Vercel Dashboard 로그인 → `property-management` → Settings → Git → `boam79/property_management` 연결 → Deployments Redeploy  
   (브라우저 자동화는 로그인 벽에서 중단됨)
2. 또는 GitHub Actions Secrets 설정 후 Actions → **Vercel Production** 실행  
   - 워크플로: `.github/workflows/vercel-production.yml` (`069c263`)
3. 임시 MCP 배포(main 아카이브): `property-management-main`  
   https://property-management-main-ckadltmfxhrxhrxhr-5008s-projects.vercel.app  
   Inspector: https://vercel.com/ckadltmfxhrxhrxhr-5008s-projects/property-management-main/6g1vnCYNxRetph3kFyzYDEL2i8AS


## Lessons

- storage.objects DELETE 금지
- unpack.cjs 금지
- Vercel MCP 재인증 후에도 기존 프로젝트 deploy 권한 없을 수 있음
- Playwright `getByText`는 route announcer와 중복 → heading role 사용
- Cloud DDL 블로커는 Desktop Supabase MCP로 해소 가능
