# 구매이력 (로컬 설치형)

Tauri 2 + React(Vite) + SQLite. 인터넷 없이 PC에서 동작합니다.

## 실행

### 개발
```powershell
cd apps\purchase-desktop
npm install
npm run tauri:dev
```

### 설치 파일
- 설치본: `src-tauri/target/release/bundle/nsis/구매이력_0.1.0_x64-setup.exe`
- 포터블: `src-tauri/target/release/app.exe`

재빌드: `npm run tauri:build`

## 웹 데이터 이관
1. 앱 실행 → **CSV 가져오기**
2. 저장소의 `web-purchase-export.csv` (웹 DB 스냅샷 39건) 선택

## 기능
- 등록·수정·삭제·검색·필터·페이지네이션
- CSV 내보내기/가져오기
- 통계(한 화면 차트)
- 비밀번호 사용 on/off
- DB 백업/복원
