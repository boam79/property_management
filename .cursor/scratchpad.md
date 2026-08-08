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

- Executor: 자산구분 MEDICAL(의료장비) 추가 → 커밋·푸시
- 사용자: `20260808010000_add_medical_asset_type.sql` Supabase 적용 필요

## Executor's Feedback or Assistance Requests

- DB 마이그레이션 미적용 시 MEDICAL 저장이 check constraint에서 거부됨

## Lessons

- 기능 검증은 배포 HTTPS URL에서만.
- 과거 마이그레이션은 수정하지 말고 drop용 신규 마이그레이션 추가.
