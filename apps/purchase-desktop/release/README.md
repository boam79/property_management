# 구매이력 데스크톱 릴리스 매니페스트

앱은 GitHub Contents API → raw(`?t=`) → (최후) jsDelivr 순으로 `latest.json`을 읽고,
GitHub Releases API와 교차해 더 높은 `purchase-desktop-v*` 버전을 채택합니다.

**버전별 변경 이력:** [CHANGELOG.md](./CHANGELOG.md)

## 새 버전 올리는 방법

1. `apps/purchase-desktop`에서 `src-tauri` 버전을 올린 뒤 `npm run tauri:build`
2. NSIS 설치파일: `src-tauri/target/release/bundle/nsis/`
3. 이 폴더의 `latest.json`의 `version` / `url` / `notes` 수정
4. `CHANGELOG.md`에 해당 버전 섹션 추가
5. `main`에 푸시 (raw URL 반영)
6. GitHub Release 태그 `purchase-desktop-vX.Y.Z`에 setup.exe 업로드  
   - 권장 asset 이름(영문): `purchase-desktop-X.Y.Z-x64-setup.exe`  
   - (`latest.json`의 `url`과 동일해야 함)

## 현재

- 최신: **0.1.15** (`purchase-desktop-v0.1.15`)
- Release: https://github.com/boam79/property_management/releases/tag/purchase-desktop-v0.1.15
- 수동 설치: https://github.com/boam79/property_management/releases/download/purchase-desktop-v0.1.15/purchase-desktop-0.1.15-x64-setup.exe
