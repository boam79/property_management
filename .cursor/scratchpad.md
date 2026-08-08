# Scratchpad — QR Asset Manager 고도화

## Background and Motivation

사용자: 기존 QR 자산관리 웹앱에 **ADMIN 전용 구매이력** 모듈 추가 (자산과 완전 별도). Planner 승인 후 Executor 진행.

## Current Status / Progress Tracking

- 모드: **Executor** — 구매이력 모듈 구현 중
- DB: `purchase_histories` 마이그레이션 원격 적용 완료 (`20260808120000`)
- 코드: `/admin/purchases`, `/admin/purchases/statistics`, CSV export, nav 링크 추가
- **다음:** 커밋·푸시(Git 연동 자동 배포) 후 프로덕션 HTTPS 스모크 — 사용자 확인 필요

## Project Status Board

- [x] purchase_histories + ADMIN RLS
- [x] /admin/purchases CRUD·검색·필터
- [x] /admin/purchases/statistics
- [x] CSV export + nav
- [ ] 커밋·푸시·프로덕션 스모크 (사용자 확인 후)

## Executor's Feedback or Assistance Requests

구매이력 코드·DB는 준비됐습니다. **커밋하고 main 푸시(자동 배포)** 해도 될까요?
배포 후 ADMIN으로 구매이력/통계/CSV를 수동 확인해 주세요.

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
7. [x] Vercel Git↔main 연결 + eight-rouge 도메인 이전 + env/Redeploy

## Project Status Board

- [x] DB 마이그레이션 적용
- [x] classify + security → main 푸시
- [x] 프로덕션 E2E 8/8 (eight-rouge; flaky 재시도 통과)
- [x] **Planner: 고도화/Cloud 블로커 과제 완료**
- [x] GitHub ↔ `property-mgmt-main-c53d` 연결
- [x] eight-rouge 도메인 이전 + env + Redeploy
- [ ] 사용자: signup OFF + 시드 비밀번호 교체

## Current Status / Progress Tracking

- 모드: **Executor** (사용자 「그냥 다 해줘」로 운영 마무리 진행)
- GitHub main: `8acc00b` 동기화됨
- **캐논 프로덕션 URL:** https://property-management-eight-rouge.vercel.app  
  (도메인을 `property-mgmt-main-c53d`로 이전 완료)
- Vercel 프로젝트: `property-mgmt-main-c53d`
  - Git: `boam79/property_management` **Connected**
  - Env: `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` / `APP_URL` 등록 + Redeploy `Fzfns8t2G` Ready
  - SSO/Vercel Authentication: OFF
- 기존 `property-management` 프로젝트: Git 미연결(이중 배포 없음)
- E2E: eight-rouge 기준 8/8 (1건 flaky → 재시도 통과)

## Executor's Feedback or Assistance Requests

**사용자에게 남는 수동 1건 (Supabase 대시보드 로그인 필요):**
1. [Auth → Providers](https://supabase.com/dashboard/project/hiwspxrnkuvqkujvwjro/auth/providers)에서 Email signup OFF
2. (권장) 시드 계정 `admin@example.com` / `register@example.com` 비밀번호 교체

그 외 Git 연결·도메인 이전·env·공개 배포는 Executor가 완료함.


## Lessons

- storage.objects DELETE 금지
- unpack.cjs 금지
- Vercel MCP 재인증 후에도 기존 프로젝트 deploy 권한 없을 수 있음
- Playwright `getByText`는 route announcer와 중복 → heading role 사용
- Cloud DDL 블로커는 Desktop Supabase MCP로 해소 가능
- 신규 Hobby 프로젝트는 Vercel Authentication 기본 ON → Dashboard에서 해제 필요
- MCP 배포 프로젝트는 Project Env가 비어 있을 수 있음 → Git 연동 전에 Env 등록 필수
- `*.vercel.app` 도메인은 Add Existing → Move Domain으로 프로젝트 간 이전 가능
