<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Task State (Updated 2026-07-28)

### Work State
- **Login real + E2E Playwright**: completo
- **Bug módulo híbrido Strict Mode (dev)**: corrigido

### Completed
- **Login real validado via Playwright**: E2E usa `EMAIL_TEST`/`PASSWORD_TEST` (variáveis de ambiente) → 200 success=True, cookie `sb-access-token` JWT setado com `HttpOnly, Secure, SameSite=lax`
- **E2E Playwright**: `tests/e2e/auth-flow.spec.ts` — login → dashboard (3 cards, iframe, sidebar) → preencher CNPJ/CNAE/dados econômicos → calcular → resultado → logout → dashboard bloqueado. Passa em produção e dev mode.
- **Cookie Secure flag**: produção requer HTTPS; E2E local usa `page.route` para remover `Secure` do Set-Cookie
- **IDs nos inputs do formulário**: `id={f.id}` em `SimulacaoForm.tsx` e `CurrencyInput.tsx` para `page.fill()`
- **3 cards funcionam**: SN×LP, SN×Híbrido, LP×Reforma — todos calculam corretamente
- **341/341 testes unitários passam**, lint 0 erros, build compila
- **SN Não Elegível**: DAS Anual = N/A, Total SN = N/A, KPI eco = 0/—, só exibe com Simulação Hipotética
- **% Crédito ICMS editável**: input `#icmsPctCredInput` (0-100%, default 100), recalcula on change
- **IRPJ Adicional**: breakdown completo; quando zero mostra "Não incidente."
- **Fatores consultivos**: texto dinâmico com % ICMS/ISS na carga LP, carga efetiva, sublimite; título "Por que este regime foi recomendado?"
- **CBS fatores**: verbo dinâmico "superar" / "gerar redução" / "neutro"
- **Conferência**: `confTotalSn` = "N/A (Não Elegível)" quando SN bloqueado
- **Terminologia**: landing page "Plataforma profissional para contadores e empresas"
- **Cadastro removido**: página `/auth/register` removida, API route `/api/auth/register` removida, links de cadastro removidos
- **Sublimite**: `checkEligibility()` detecta sublimite (R$3.6M), SN total ajustado (DAS sem ICMS/ISS + tributo fora + encargos), label "Simples Nacional com ICMS/ISS por fora do DAS"
- **✅ Sublimite – rate display fixo**: `snAliquota`/`snAliquotaDisplay` mostra `aliqEfetiva * (1 - allocPct)`
- **✅ getSNParams corrigido**: deduções da 6ª faixa conforme LC 155/2016
- **✅ getSNParcelaIcmsIss corrigido**: 6ª faixa = 0% para todos anexos
- **PDF**: handler 'exportPdf' com try/catch, buildPDFHtml() retorna HTML de erro, safety timeout 10s

### Bug Fix: Módulo Híbrido em DEV MODE (React Strict Mode)
- **Causa raiz**: `disposedRef.current` era setado para `true` no cleanup do Strict Mode mas nunca resetado no remount. `handleMessage` rejeitava todas as mensagens na primeira linha (`if (disposedRef.current) return;`), incluindo `engineReady`.
- **Correção**: `disposedRef.current = false` adicionado ao corpo do `useEffect` (executado no mount/remount), ao lado do cleanup já existente.
- **Arquivo**: `src/app/dashboard/hooks/useComparadorEngine.ts`
- **Verificado**: build, lint, 341/341 testes, E2E auth-flow em dev mode (5.5s), E2E híbrido em dev mode (9.1s)

### Relevant Files
- `public/comparador.html`: motor tributário — `calc()` (~1812), `getSNParcelaIcmsIss()` (~1785), `checkEligibility()` (~1664), message handlers (~3433), `buildPDFHtml()` (~2898), `exportPDF()` (~3194)
- `src/app/dashboard/hooks/useComparadorEngine.ts`: hook do motor — contém `disposedRef` e `handleMessage`
- `src/app/dashboard/components/SimulacaoForm.tsx`: formulário com `id={f.id}` nos inputs
- `src/app/dashboard/components/CurrencyInput.tsx`: input monetário com prop `id`
- `playwright.config.ts`: configuração E2E
- `tests/e2e/auth-flow.spec.ts`: E2E principal (login → cálculo → logout)
- `tests/elegibilidade.test.mjs`: 52+ testes
