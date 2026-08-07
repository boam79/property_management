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

- Executor: 사진 기능 제거 후 커밋·푸시 진행

## Executor's Feedback or Assistance Requests

- Supabase SQL Editor에서 `20260807090000_drop_asset_photos.sql` 적용 요청 (기존 사진 파일·테이블 삭제)

## Lessons

- 기능 검증은 배포 HTTPS URL에서만.
- 과거 마이그레이션은 수정하지 말고 drop용 신규 마이그레이션 추가.
