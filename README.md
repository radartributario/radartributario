# ConsultTax

Aplicação Next.js para simulação tributária comparativa. A UI em React funciona como camada de entrada, autenticação e apresentação; o motor de cálculo fiscal fica em `public/comparador.html` e é executado em um iframe oculto.

## Arquitetura

- `src/app`: rotas Next.js, dashboard, autenticação e APIs.
- `src/app/dashboard/page.tsx`: controla etapas, formulário, resultado e geração de PDF.
- `src/app/dashboard/components/SimulacaoForm.tsx`: coleta dados da empresa, dados econômicos e parâmetros tributários.
- `src/app/dashboard/hooks/useComparadorEngine.ts`: ponte `postMessage` entre React e o iframe do motor.
- `public/comparador.html`: motor tributário, cálculo, geração de HTML para PDF e handler de mensagens.
- `tests/*.test.mjs`: testes unitários e de homologação do motor/protocolo.
- `tests/e2e/*.spec.ts`: testes Playwright de fluxo completo.

## Fluxo De Cálculo

1. O usuário seleciona o tipo de análise no dashboard.
2. O formulário monta `formData` com os campos informados.
3. `useComparadorEngine.calculate()` envia `{ type: "calcular", requestId, tipoComparacao, data }` ao iframe `/comparador.html`.
4. O iframe valida a origem e executa a função do motor correspondente ao `tipoComparacao`.
5. O iframe retorna `{ type: "resultado", requestId, tipoComparacao, success, data }`.
6. O hook aceita a resposta somente se `requestId` e `tipoComparacao` coincidirem com a solicitação ativa.
7. O resultado é salvo em `localStorage` e renderizado por `DashboardResultados`.

## Fluxo De PDF

1. Após confirmação das premissas, o dashboard envia `{ type: "exportPdf", requestId, tipoComparacao, data, resultadoAtual }` ao iframe.
2. O motor recalcula o cenário e monta o HTML do relatório.
3. O iframe retorna `{ type: "pdfHtml", requestId, tipoComparacao, success: true, html }`.
4. O hook abre uma nova janela e chama `print()`.

## Autenticação

- Login: `POST /api/auth/login` autentica via Supabase e grava cookies HttpOnly.
- Sessão atual: `GET /api/auth/me` valida o token e retorna o usuário real.
- Logout: `POST /api/auth/logout` remove cookies e limpa dados sensíveis locais.
- Proteção de rota: `src/proxy.ts` protege `/dashboard` usando o cookie `sb-access-token`.

## Comandos

```bash
npm run dev
npm run build
npm run lint
npm test
npm run test:protocol
npx playwright test
```

## Observações

- A baseline oficial está descrita em `VERSAO.md` e `HOMOLOGACAO_TRIBUTARIA_FINAL.md`.
- Limitações conhecidas estão em `LIMITACOES_CONHECIDAS.md`.
- Mudanças em regras tributárias devem ser feitas separadamente de correções técnicas e acompanhadas de testes de homologação.
