<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### 범위 / 서비스
- **메인 제품 = 루트 Next.js 16 웹앱** (`qr-asset-manager`, QR 자산관리). 개발 환경은 이 웹앱만 대상으로 셋업되어 있습니다.
- `apps/purchase-desktop`(Tauri + Vite 데스크톱 앱)은 **범위 밖**입니다. Rust 툴체인이 필요하며 루트 `npm ci`로 설치되지 않습니다.
- 표준 스크립트는 루트 `package.json`(`dev`/`build`/`lint`/`test:*`/`check:*`)를 참고하세요. 실행/DB 절차는 `README.md`, 보안/배포는 `docs/`를 참고합니다.

### 백엔드(Supabase) — 중요
- 로컬 dev/build는 별도 로컬 DB가 아니라 **공유 원격 Supabase 프로젝트**(client 번들에 인라인된 공개 `NEXT_PUBLIC_*` 값)를 그대로 사용합니다. 즉 localhost에서의 로그인/조회도 실제 프로덕션 백엔드에 붙습니다.
- `next build`는 `/admin` 등 페이지 프리렌더 시 `createClient()`가 실행되어, **`NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_ANON_KEY`가 없으면 빌드가 실패**합니다(`.env.local` 또는 환경변수로 주입 필요). 이 두 값은 공개 값(브라우저에 노출되는 anon/publishable 키)이며, 배포된 사이트 클라이언트 번들이나 Supabase 대시보드 → Project Settings → API에서 얻을 수 있습니다. `next dev`는 이 값이 없어도 홈/로그인은 뜨지만, `createClient()`를 호출하는 인증·데이터 동작에서 오류가 납니다.

### 린트 / 타입체크 주의점
- `npm run lint`(= `eslint`)는 저장소 전체를 검사하므로 **범위 밖** 파일(`apps/purchase-desktop`, `deploy-bundle/`)의 사전 존재 오류로 실패합니다. 웹앱 소스만 볼 때는 `npx eslint src`(현재 clean)를 사용하세요.
- `npx tsc --noEmit` 단독 실행은 Next.js 16이 빌드 시 생성하는 전역 타입(`LayoutProps` 등) 부재로 실패합니다. **타입체크는 `npm run build`로 수행**하세요(빌드가 TypeScript 검사를 포함).

### 테스트 / 검증
- 기능 검증·E2E·스모크는 **배포된 HTTPS URL에서만** 수행합니다(localhost 대체 금지). Playwright `baseURL`은 배포 URL만 사용하며, 기본값은 프로덕션(`property-management-eight-rouge.vercel.app`)입니다.
- Node 유닛/헬퍼 스모크(`npm run test:qr-token`, `test:assets-pagination`, `test:register-errors`, `check:no-stub`, `check:redirect`)는 순수 로컬에서 실행 가능하며 백엔드가 필요 없습니다.
- E2E(`test:e2e:*`)와 일부 스크립트는 `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`/`E2E_REGISTER_*` 등 자격증명 환경변수가 필요합니다(커밋 금지). Secrets로 주입하세요.
- 로그인이 "Invalid login credentials"로 실패하면 Supabase GoTrue 기준 **이메일/비밀번호 불일치 또는 미존재 사용자**입니다(두 경우를 동일 에러로 반환). 미확인 이메일은 별도 `email_not_confirmed`로 구분됩니다. 이 프로젝트는 이메일 확인 필수(`mailer_autoconfirm=false`)이며, 신규 ADMIN은 가입·이메일확인 후 `update public.profiles set role='ADMIN'` SQL로 승격합니다.

### DB 마이그레이션
- `supabase/migrations/`를 원격 Supabase에 순서대로 수동 적용합니다(README 참고).
