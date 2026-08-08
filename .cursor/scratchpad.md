# Scratchpad — QR Asset Manager 고도화

## Background and Motivation

이미지(자산 사진) 저장 기능 삭제 요청 — Supabase Storage 대안 대신 기능 자체를 제거.

## High-level Task Breakdown

1. [x] 앱 UI/액션/타입/상수에서 사진 기능 제거
2. [x] `20260807090000_drop_asset_photos.sql` 마이그레이션 추가
3. [ ] 커밋·푸시
4. [ ] 사용자: Supabase에 drop 마이그레이션 적용

## Project Status Board

- [x] 사진 기능 코드 제거
- [ ] 커밋·푸시
- [ ] 사용자 DB 마이그레이션 적용
- [ ] (별도) 보안 PR #4

## Current Status / Progress Tracking

- Executor: 등록 UX 한글 메시지 + unused QR SELECT 하드닝 마이그레이션 추가
- 사용자 필수: `20260808020000_unused_qr_select_hardening.sql` (+ MEDICAL 마이그레이션) Supabase 적용

## Executor's Feedback or Assistance Requests

- Supabase에 `20260808020000_unused_qr_select_hardening.sql` 적용 후 `EXPECT_HARDENED=1 npm run test:concurrency:register20` 로 D 검증 요청

## Lessons

- 기능 검증은 배포 HTTPS URL에서만.
- 과거 마이그레이션은 수정하지 말고 drop용 신규 마이그레이션 추가.
