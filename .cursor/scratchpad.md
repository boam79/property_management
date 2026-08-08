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

- Executor: REGISTER 동시 20건 등록 테스트 완료 (프로덕션 Supabase)
- 스크립트: `scripts/register-concurrency-20.mjs`

## Executor's Feedback or Assistance Requests

### 동시성 테스트 결과 (register@example.com, CONCURRENCY=20)

| 시나리오 | 결과 | 비고 |
|---------|------|------|
| A 동일 QR 20경합 | PASS | ok=1, already=19, 자산 1개 |
| B 서로 다른 QR 20병렬 | PASS | ok=20 / 617ms |
| C 동일 자산번호 20병렬(다른 QR) | 무결성 OK | ok=1, DUPLICATE_VALUE=19, 실패 QR은 unused로 롤백 |
| D REGISTER unused QR SELECT | **이슈** | unused 토큰 목록 조회 가능(보안 하드닝 미적용 시) |

### 파악된 문제점
1. **UX:** `DUPLICATE_VALUE`가 사용자에게 그대로 노출 (`registerAssetOnQr`)
2. **보안:** REGISTER가 unused QR 토큰을 나열할 수 있음 → `20260807020000_intrusion_hardening.sql` 미적용 상태
3. **운영:** 등록 계정은 QR 배치 생성 불가(설계) — 동시 등록 전 ADMIN이 unused QR을 충분히 만들어 둬야 함
4. **경합 자체(동일 QR / 병렬 등록):** RPC 레벨에서는 문제 없음 (중복 자산·이중 연결 없음)

## Lessons

- 기능 검증은 배포 HTTPS URL에서만.
- 과거 마이그레이션은 수정하지 말고 drop용 신규 마이그레이션 추가.
