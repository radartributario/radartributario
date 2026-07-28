# Changelog

## [v1.0.0] — 2026-07-28 — Baseline Oficial

### Adicionado
- Login real com Supabase (JWT, cookie `sb-access-token`)
- Logout funcional (limpa cookie, redireciona)
- E2E Playwright (`tests/e2e/auth-flow.spec.ts`)
- Hotfix validation E2E (`tests/e2e/hotfix-validation.spec.ts`)
- Strict Mode regression test (`tests/strict-mode-regression.test.mjs`)
- IDs nos inputs do formulário para testes automatizados
- `playwright.config.ts`

### Corrigido
- **BUG CRÍTICO (dev mode):** Módulo "Simples Tradicional × Simples Híbrido" travava em "Preparando motor de cálculo..." no React Strict Mode.
  - **Causa:** `disposedRef.current` setado como `true` no cleanup do Strict Mode, nunca resetado no remount.
  - **Correção:** `disposedRef.current = false` no corpo do `useEffect` em `useComparadorEngine.ts:220`.

### Segurança
- Origin validation em todas as mensagens do iframe
- Source validation (apenas iframe oficial pode comunicar)
- `postMessage` sempre com `targetOrigin` explícito (nunca `"*"`)
- `requestId` validado em respostas de cálculo e PDF
- Proxy de autenticação protege `/dashboard`
- Dashboard redireciona para login após logout

### Removido
- Página `/auth/register` (cadastro desativado)
- `README.md` (duplicava AGENTS.md com info desatualizada)

### Testes
- 345 testes unitários (341 originais + 4 Strict Mode regression)
- 10 cenários E2E (3 módulos, trocas, retry, refresh, logout)
- Validação em dev mode (React Strict Mode) e produção
