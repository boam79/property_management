# 구매이력 데스크톱 — 릴리즈 버전 히스토리

앱 업데이트 확인은 `latest.json`을 사용합니다.  
설치 파일·태그: [GitHub Releases](https://github.com/boam79/property_management/releases?q=purchase-desktop)

현재 최신: **0.1.2** (`purchase-desktop-v0.1.2`)

---

## 0.1.2 — 2026-08-08

- **GitHub Release:** [purchase-desktop-v0.1.2](https://github.com/boam79/property_management/releases/tag/purchase-desktop-v0.1.2)
- **설치파일:** `purchase-desktop-0.1.2-x64-setup.exe`
- **변경 요약**
  - 설정 탭: **업데이트 확인** / **다운로드·설치** (GitHub `latest.json` 기준)
  - 통계 상세화: 전월 대비, 이번 주, 작년 동기, 고유 품목·부서 수, 일평균, 최다 월
  - 차트·표: 월별(선), 분기, 이번 달 일별, 요일별, 부서×월 누적, 품목 Top15, 부서별 최다 품목
  - 웹 구매이력 잔여 라우트·컴포넌트 완전 제거 (코드베이스)

---

## 0.1.1 — 2026-08-08

- **배포:** 로컬 NSIS 빌드 (GitHub Release 태그 없음 — 0.1.2에 통합 게시)
- **설치파일(로컬):** `구매이력_0.1.1_x64-setup.exe`
- **변경 요약**
  - 앱 내 업데이트 확인·설치 기능 최초 도입
  - 버전 표시, `latest.json` 매니페스트 구조 준비

> 이미 0.1.1을 수동 설치한 PC는 설정 → 업데이트 확인으로 **0.1.2**로 올릴 수 있습니다.

---

## 0.1.0 — 2026-08-08

- **배포:** 로컬 NSIS 최초 설치본 (GitHub Release 태그 없음)
- **설치파일(로컬):** `구매이력_0.1.0_x64-setup.exe`
- **변경 요약**
  - 구매이력 완전 로컬 앱 (Tauri + SQLite) 최초 공개
  - CRUD, 검색·필터, CSV 가져오기/내보내기
  - 통계(초기), 선택 비밀번호, DB 백업·복원
  - 웹 구매이력 메뉴 이전 안내 (이후 0.1.2에서 잔여 코드 삭제)

> 0.1.0에는 인앱 업데이트가 없습니다. **0.1.2 setup을 한 번 수동 설치**한 뒤부터 앱 내 업데이트가 가능합니다.

---

## 버전 올리는 절차 (요약)

자세한 단계는 [README.md](./README.md) 참고.

1. `src-tauri` 버전 bump → `npm run tauri:build`
2. `latest.json`의 `version` / `url` / `notes` / `publishedAt` 수정
3. 이 문서에 새 섹션 추가
4. `main` 푸시
5. 태그 `purchase-desktop-vX.Y.Z` Release + `purchase-desktop-X.Y.Z-x64-setup.exe` 업로드
