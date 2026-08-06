# GitHub ↔ Vercel 연동 (스텁 배포 재발 방지)

MCP `deploy_to_vercel`로 파일을 직접 올리면 페이로드 제한 때문에 **간소화 스텁**이 배포될 수 있습니다.  
프로덕션은 **GitHub `main` 푸시 → Vercel 자동 빌드**만 사용하세요.

## 연결 절차 (Dashboard)

1. [Vercel Dashboard](https://vercel.com) → 프로젝트 **property-management**
2. **Settings → Git** → **Connect Git Repository**
3. GitHub 저장소: `boam79/property_management`
4. Production Branch: `main`
5. **Settings → Environment Variables** 에 아래를 Production / Preview 모두 설정:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` (Production: 배포 도메인, Preview: 비워도 됨)
6. **Deployments → Redeploy** (Clear cache 권장) 한 번 실행

## PR 미리보기

- GitHub에서 PR을 열면 Vercel이 Preview Deployment를 생성합니다.
- Preview에도 동일 Supabase env를 쓰려면 Preview 환경에 변수를 넣으세요. (별도 스테이징 DB를 쓰려면 Preview 전용 URL/키 사용)

## 로컬 CLI (선택)

이 환경의 `vercel login`이 깨질 수 있습니다. 본인 PC에서:

```bash
npx vercel login
npx vercel link --project property-management
npx vercel git connect
```

## 스텁 방지 체크

배포 전/CI에서:

```bash
npm run check:no-stub
```

소스에 `간소화 배포본` 문자열이 있으면 실패합니다.
