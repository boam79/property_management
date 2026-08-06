# 실기기 QR 스모크 체크리스트

대상: iPhone(Safari) / Galaxy(Chrome) 기본 카메라

## 사전 준비

1. 관리자 로그인 → **QR생성** → 수량 1~2 → 배치 생성
2. PNG 또는 라벨 PDF 출력 후 화면에 표시(또는 인쇄)
3. Production URL: `https://property-management-eight-rouge.vercel.app`  
   (GitHub 연동 후 도메인이 바뀌면 그 URL 사용)

## 시나리오 A — 빈 QR 신규 등록

| # | 단계 | 기대 |
|---|---|---|
| 1 | 카메라로 QR 스캔 | 브라우저가 `/q/{token}` 연다 |
| 2 | 비로그인 | `/login?redirect=/q/{token}` 이동 |
| 3 | 공용 계정 로그인 | **원래 `/q/{token}`으로 복귀** |
| 4 | 자산 정보 입력 후 저장 | 성공 → 자산 상세 |
| 5 | 같은 QR 재스캔 | 등록 폼이 아니라 **기존 자산** 표시 |

## 시나리오 B — 동시 등록 (2대)

| # | 단계 | 기대 |
|---|---|---|
| 1 | 미사용 QR 하나 준비 | status=unused |
| 2 | 기기 2대에서 로그인 후 같은 `/q/{token}` 연다 | 둘 다 폼 표시 가능 |
| 3 | 거의 동시에 저장 | **1대만 성공**, 다른 대는 `QR_ALREADY_ASSIGNED` / 기존 자산 안내 |

## 시나리오 C — 폐기/없는 QR

| # | 단계 | 기대 |
|---|---|---|
| 1 | 잘못된 token URL | 안내 문구, 등록 차단 |

## 자동화

로컬/CI에서 URL 플로우는 Playwright로 검증:

```bash
npm run test:e2e:qr
npm run test:concurrency
npm run test:dashboard-counts
```

실기기 카메라 스캔 자체는 OS/하드웨어 영역이라 수동 체크가 필요합니다.
