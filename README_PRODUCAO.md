# ConsultTax — Guia de Produção

**Versão:** v1.0.0

## Requisitos

- Node.js 18+
- Acesso ao Supabase (project config em `.env.local`)

## Variáveis de Ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=<url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<key>
```

## Deploy

```bash
npm run build
npm run start
```

O build gera os artefatos em `.next/`. A aplicação roda na porta 3000.

## Proxy de Autenticação

O middleware (`src/proxy.ts`) protege todas as rotas `/dashboard/*`. Requer cookie `sb-access-token` JWT válido. Rotas públicas:

- `/auth/login`
- `/auth/login/*`
- `/comparador.html`
- `/_next/*`
- `/api/auth/*`

## Testes em Produção

```bash
# Iniciar servidor de produção
npm run build && npm run start

# Executar E2E (outro terminal)
npx playwright test
```

## Segurança

- Origin/source validation no protocolo iframe ↔ React
- `postMessage` nunca com `"*"`
- `requestId` contra respostas obsoletas
- `disposedRef` contra mensagens pós-unmount
- Logout limpa cookie e redireciona para login

## Manutenção

Ver `CHANGELOG.md` para histórico de versões.
Ver `LIMITACOES_CONHECIDAS.md` para limitações atuais.
