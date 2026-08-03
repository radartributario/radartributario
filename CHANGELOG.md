# Changelog

## [1.0.0] — 2026-08-03 — Release de Produção

Release oficial de produção. Nenhuma nova funcionalidade nesta versão: foco em segurança, versionamento e rastreabilidade do que já estava homologado.

### Segurança
- Removida a rota `/api/debug` (exposta em produção, aceitava credenciais de teste).
- Adicionados headers de segurança:
  - `Strict-Transport-Security` (HSTS, 2 anos)
  - `Content-Security-Policy` (`frame-ancestors 'self'`, `default-src 'self'`, `object-src 'none'`, etc.)
  - `X-Frame-Options: SAMEORIGIN`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` (câmera/mic/geolocalização bloqueadas)
- Proteção contra força bruta no login: **5 tentativas → bloqueio de 30 segundos** por IP (`Retry-After`).
- Cache (TTL 6h) + proteção contra abuso (30 consultas/min/IP) no `/api/cnpj`.
- Removidas credenciais reais hardcoded dos testes E2E — agora exigem `EMAIL_TEST`/`PASSWORD_TEST` e pulam se ausentes.
- Removidas dependências e código não utilizados: `@supabase/supabase-js`, `@supabase/ssr` e `src/lib/supabase.ts` (`createBrowserClient` morto).
- Limpeza de scripts de depuração (`audit_hibrido.mjs`, `tests/_check_unicode.mjs`) e `.env.vercel.bak` (continha token).

### Funcionalidades homologadas nesta release
- **PDF Executivo**: relatório resumido com métricas e recomendação de regime.
- **Anexo Técnico**: memória de cálculo completa e composição de tributos no PDF.
- **Reforma Tributária**: módulo Lucro Presumido atual × Reforma (CBS/IBS 2027) com cenários conservador, provável e otimista.
- **Simples Híbrido**: comparação Simples tradicional × Simples híbrido com retirada da CBS do DAS e créditos sobre compras.
- **Novo domínio**: `comparetributo.com.br` (redirect permanente de `www` → domínio principal).
- **Melhorias de UX**: dashboard com 3 módulos, memória de cálculo vertical, estados de benefício, responsividade mobile.
- **Correções de PDF**: paginação, memória resumida dinâmica por tipo de atividade (ICMS/ISS/IPI), estados confirmado/negado/pendente.
- **Auditoria Tributária**: suíte de homologação com 483 testes unitários.

### Autenticação
- Login real via Supabase (JWT em cookie `HttpOnly`, `Secure`, `SameSite=Lax`).
- Proxy protege `/dashboard` (cookie `sb-access-token` validado).
- Logout limpa cookie e dados sensíveis do `localStorage`.

### Testes
- 483/483 testes unitários aprovados.
- Lint sem erros.
- Build de produção compilando.
- Suíte E2E Playwright (15 cenários) pronta, executada com `EMAIL_TEST`/`PASSWORD_TEST`.

## Baseline Anterior

### [v1.0.0-baseline] — 2026-07-28 — Baseline Oficial Homologada
- Login real + E2E Playwright completo.
- Correção do bug crítico do módulo híbrido em React Strict Mode (`disposedRef` no remount).
- Sublimite, faixas do Simples Nacional (LC 155/2016), CBS reduzida por CNAE e IRPJ adicional.
