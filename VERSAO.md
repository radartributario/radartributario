# Versão v1.0.0

**Data do congelamento:** 2026-07-28
**Commit:** (tag v1.0.0)
**Branch:** fix/estabilizacao-p0

## Estado da Baseline

- **Status:** Baseline homologada e aprovada
- **Testes unitários:** 345/345 aprovados
- **Testes E2E:** 10 cenários aprovados (dev + produção)
- **Lint:** 0 erros
- **Build:** Compilação bem-sucedida

## Módulos Homologados

1. Simples Nacional × Lucro Presumido
2. Simples Tradicional × Simples Híbrido
3. Lucro Presumido Atual × Reforma Tributária

## Correções nesta Versão

- **Strict Mode Hotfix**: `disposedRef.current = false` adicionado ao `useEffect` em `useComparadorEngine.ts:220`. Corrige travamento do módulo híbrido em React Strict Mode (dev). Causa raiz: ref não resetado após remount do Strict Mode.

## Segurança

- Origin validation ativa
- Source validation ativa
- requestId validado
- Nenhum postMessage com "*"
- Proxy protege /dashboard
- Autenticação via Supabase JWT

## Testes Disponíveis

```bash
npm test                    # 345 testes unitários
npm run lint                # ESLint
npm run build               # Build Next.js
npx playwright test         # E2E (requer servidor rodando)
```

## Política de Versão

- **v1.0.x** — Hotfix: correção de bug sem mudança de regra tributária
- **v1.x.0** — Minor: nova funcionalidade compatível
- **v2.0.0** — Major: mudança de arquitetura ou regra tributária
