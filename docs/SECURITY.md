# Security checklist (account takeover / intrusion / DB theft)

## Immediate ops (Dashboard — do now)

1. **Rotate production passwords** for any accounts that used repo defaults  
   (`admin@example.com`, `register@example.com`, etc.). Invalidate sessions.
2. **Disable public signup** in Supabase → Authentication → Providers / settings  
   (`disable_signup = true`). Provision users by invite only.
3. Apply migration `supabase/migrations/20260807020000_intrusion_hardening.sql`.
4. Confirm Vercel env has `SUPABASE_SERVICE_ROLE_KEY` (server-only).  
   Never put it in client or Git.
5. Do **not** set `ENABLE_E2E_HELPERS=1` on production.

## App protections (this branch)

| Area | Mitigation |
|------|------------|
| Open redirect | Hardened `isSafeRedirectPath` + allowlist + origin-based redirect |
| Unused QR token harvest | RLS: unused tokens admin-only; `/q/[token]` via `get_qr_by_token` |
| Asset IDOR write | No client INSERT; UPDATE columns exclude `qr_code_id` / `created_by` |
| Photo storage abuse | INSERT path must start with `auth.uid()` |
| Token oracle API | `/api/admin/qr/latest-unused` off unless `ENABLE_E2E_HELPERS=1` |
| Import tampering | Commit reads server-stored `import_rows`, not client payload |
| E2E credentials | Env-only (`E2E_*` / `TEST_*`); no passwords in repo |
| Headers | CSP / XFO / nosniff / Referrer-Policy / Permissions-Policy |

## E2E env

```bash
export E2E_ADMIN_EMAIL=...
export E2E_ADMIN_PASSWORD=...
export E2E_REGISTER_EMAIL=...
export E2E_REGISTER_PASSWORD=...
PLAYWRIGHT_BASE_URL=https://your-prod.example npm run test:e2e:admin
```
