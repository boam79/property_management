# QR 자산관리 (property_management)

QR 라벨을 미리 생성·부착한 뒤, 스캔으로 일반 비품·IT 자산을 등록·조회하는 Next.js + Supabase 앱입니다.

## 주요 기능

| 영역 | 설명 |
|------|------|
| QR 생성 | 배치 생성, SVG/PNG/PDF 라벨 다운로드 |
| QR 수명주기 | 연결 해제(→미사용), 폐기(retired) |
| 스캔 등록 | `/q/{token}` → 로그인 → 자산 신규 등록 (동시성 안전 RPC) |
| 자산 | 목록(페이지네이션·검색·필터), 상세 수정, 변경 이력 |
| 내보내기 | 현재 필터 기준 Excel/CSV (임포트 헤더 호환) |
| 임포트 | xlsx 템플릿·검증·커밋 |
| 이관 | 자산 상세에서 담당자·부서·위치 이관(사유 필수) |
| 일괄 변경 | 관리자 자산목록에서 상태·위치·부서 일괄 적용 |
| 알림 | 대시보드: 장기 수리·미사용 QR 부족·미연결 자산 |

역할: `REGISTER`(등록/조회) · `ADMIN`(전체 관리). 신규 가입은 항상 `REGISTER`입니다.

## 환경 변수

`.env.example` 참고. Vercel Production/Preview에 동일하게 설정하세요.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

선택(로컬 스크립트·E2E):

```bash
PLAYWRIGHT_BASE_URL=https://your-domain.vercel.app
# 관리자 계정은 e2e/admin.spec.ts 기본값 또는 환경에 맞게 사용
```

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev
```

## DB 마이그레이션

`supabase/migrations/` 순서대로 원격 Supabase에 적용하세요.

1. `20260806000000_init.sql` — 스키마·RPC
2. `20260806130000_security_hardening.sql` — 권한 강화
3. `20260806140000_import_storage_cleanup.sql` — imports 버킷
4. `20260806150000_enhancements.sql` — QR unlink/retire, 역할 RPC
5. `20260806160000_p2_bulk_update.sql` — 일괄 변경 RPC
6. `20260807090000_drop_asset_photos.sql` — 자산 사진 기능 제거 (권장)

Supabase SQL Editor에 붙여 넣거나 CLI로 push합니다. **ADMIN 승격**은 초기 1회 SQL로 하거나, 승격 후 앱의 **사용자** 메뉴를 사용합니다.

```sql
update public.profiles
set role = 'ADMIN'
where id = '<auth.users uuid>';
```

## 배포 (Vercel + GitHub)

프로덕션은 **GitHub `main` 푸시 → Vercel 자동 빌드**만 사용하세요.  
MCP `deploy_to_vercel` 직접 업로드는 스텁 배포 위험이 있습니다. 상세: `docs/VERCEL_GITHUB.md`.

Production URL 예: `https://property-management-eight-rouge.vercel.app`

## 검증·스모크

기능 검증은 **배포 HTTPS URL**에서만 수행합니다 (localhost 대체 금지).

```bash
npm run test:assets-pagination
npm run test:assets-export
npm run test:qr-token
npm run check:no-stub

PLAYWRIGHT_BASE_URL=https://property-management-eight-rouge.vercel.app npm run test:e2e:admin
PLAYWRIGHT_BASE_URL=... npm run test:e2e:qr
```

실기기 카메라 스캔: `docs/DEVICE_QR_SMOKE.md`

## 디렉터리 요약

- `src/app/(app)/` — 로그인 후 앱 (자산·관리)
- `src/app/q/[token]/` — QR 스캔 진입
- `src/app/api/admin/` — 라벨 export, 임포트 템플릿, 자산 export
- `supabase/migrations/` — Postgres RLS·RPC·Storage
- `e2e/` — Playwright (배포 URL)

## 보안 메모

- `profiles.role`은 클라이언트가 스스로 올릴 수 없습니다. ADMIN 변경은 `admin_set_profile_role` RPC만.
- anon에 테이블 DML/민감 RPC 실행 권한이 없습니다.
