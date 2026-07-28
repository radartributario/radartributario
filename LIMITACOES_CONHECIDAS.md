# Limitações Conhecidas — v1.0.0

## Técnicas

1. **Cookie Secure em Produção**
   - O cookie JWT do Supabase tem `Secure=true`, exigindo HTTPS.
   - E2E local usa interceptação de rota para remover `Secure`.
   - Em produção real (HTTPS), não há impacto.

2. **Popup para PDF**
   - A geração de PDF abre uma pop-up (`window.open`).
   - Pode ser bloqueada por bloqueadores de pop-up.
   - Mensagem de erro orienta o usuário a permitir pop-ups.

3. **Fast Refresh vs Full Reload**
   - Em dev mode, Fast Refresh preserva estado do React mas pode resetar refs do iframe.
   - O mecanismo de enginePing + reload automático (3s) recupera.
   - Testado com 10 ciclos de troca + 50 refreshes sem falhas.

4. **Strict Mode**
   - React Strict Mode (dev) causa dupla montagem/desmontagem.
   - Corrigido via `disposedRef.current = false` no mount.
   - Teste de regressão permanente em `tests/strict-mode-regression.test.mjs`.

## Funcionais

5. **Reforma Tributária (2027)**
   - IBS está implementado com alíquota inicial de 0,10%.
   - Alíquotas definitivas dependem de lei complementar futura.
   - Cenário é estimativo, baseado nas regras atuais da PEC 45/2019.

6. **Cálculo Híbrido**
   - Opt-out do DAS para CBS calculado por dentro do Simples Nacional.
   - Percentual de opt-out é configurável (default 100%).
   - Crédito da CBS usa alíquota própria das compras (independência).

7. **CNAE**
   - Classificação automática por CNAE cobre classes principais.
   - Casos complexos (atividades mistas) podem exigir ajuste manual.
   - Benefícios CBS (Art. 127, 129, 130) aplicados por CNAE.

## Testes

8. **Cobertura E2E**
   - Testes E2E dependem de credenciais reais (`EMAIL_TEST`, `PASSWORD_TEST`).
   - Não executam em CI sem essas variáveis.
   - Testes de stress (100 trocas, 50 refreshes) são opcionais (longa duração).

9. **Testes Unitários**
   - 345 testes, todos no backend (motor + validações).
   - Componentes React não têm testes unitários próprios.
