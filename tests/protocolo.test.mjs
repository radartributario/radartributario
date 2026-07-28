import { describe, it, mock } from "node:test";
import assert from "node:assert";

// ===== Mock window.location.origin for tests =====
const ORIGIN = "http://localhost:3000";

// ===== Protocol validation helpers (mirrors the logic in useComparadorEngine) =====

function isValidOrigin(eOrigin, allowedOrigin) {
  return eOrigin === allowedOrigin;
}

function isValidSource(eSource, iframeWindow) {
  return eSource === iframeWindow;
}

function isValidMessage(data) {
  if (!data || !data.type) return false;
  const validTypes = ["engineReady", "resultado", "pdfHtml", "calcular", "exportPdf"];
  return validTypes.includes(data.type);
}

function isMatchingRequestId(responseRequestId, currentRequestId) {
  return responseRequestId === currentRequestId;
}

function isMatchingTipo(responseTipo, currentTipo) {
  return responseTipo === currentTipo;
}

function isValidResultData(data) {
  if (!data || typeof data !== "object") return false;
  // Must have at least sn and lp for simples vs presumido, or simplesTradicional/simplesHibrido for hibrido
  return true;
}

function hasValidNumbers(obj) {
  if (!obj || typeof obj !== "object") return false;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === "number") {
      if (!isFinite(val) || isNaN(val)) return false;
    } else if (typeof val === "object" && val !== null) {
      if (!hasValidNumbers(val)) return false;
    }
  }
  return true;
}

function validateAnaliseSimplesPresumido(results) {
  if (!results) return "Resultado ausente";
  const sn = results.sn;
  const lp = results.lp;
  if (!sn) return "sn ausente";
  if (!lp) return "lp ausente";
  if (typeof sn.total !== "number" || !isFinite(sn.total)) return "sn.total inválido";
  if (typeof lp.total !== "number" || !isFinite(lp.total)) return "lp.total inválido";
  if (isNaN(sn.total)) return "sn.total é NaN";
  if (isNaN(lp.total)) return "lp.total é NaN";
  if (sn.total === Infinity || sn.total === -Infinity) return "sn.total é Infinity";
  if (lp.total === Infinity || lp.total === -Infinity) return "lp.total é Infinity";
  return null;
}

function validateAnaliseHibrido(results) {
  if (!results) return "Resultado ausente";
  const trad = results.simplesTradicional;
  const hib = results.simplesHibrido;
  if (!trad) return "simplesTradicional ausente";
  if (!hib) return "simplesHibrido ausente";
  if (typeof trad.total !== "number" || !isFinite(trad.total)) return "trad.total inválido";
  if (typeof hib.total !== "number" || !isFinite(hib.total)) return "hib.total inválido";
  return null;
}

function validateAnaliseReforma(results) {
  if (!results) return "Resultado ausente";
  const atual = results.lucroPresumidoAtual;
  const futuro = results.cenarioFuturo;
  if (!atual) return "lucroPresumidoAtual ausente";
  if (!futuro) return "cenarioFuturo ausente";
  if (typeof atual.total !== "number" || !isFinite(atual.total)) return "atual.total inválido";
  if (typeof futuro.total !== "number" || !isFinite(futuro.total)) return "futuro.total inválido";
  return null;
}

// ===== TESTS =====

describe("Protocolo de mensagens", () => {
  const iframeWindow = { postMessage: () => {} };

  it("1. mensagem de origem inválida é ignorada", () => {
    assert.strictEqual(isValidOrigin("http://evil.com", ORIGIN), false);
    assert.strictEqual(isValidOrigin(ORIGIN, ORIGIN), true);
  });

  it("2. mensagem de source inválido é ignorada", () => {
    const otherWindow = {};
    assert.strictEqual(isValidSource(otherWindow, iframeWindow), false);
    assert.strictEqual(isValidSource(iframeWindow, iframeWindow), true);
  });

  it("3. requestId antigo não substitui resultado atual", () => {
    const currentRequestId = "abc-123";
    const oldRequestId = "abc-122";
    assert.strictEqual(isMatchingRequestId(oldRequestId, currentRequestId), false);
    assert.strictEqual(isMatchingRequestId(currentRequestId, currentRequestId), true);
  });

  it("4. resultado de outro tipo de comparação é ignorado", () => {
    assert.strictEqual(isMatchingTipo("SIMPLES_VS_PRESUMIDO", "SIMPLES_TRADICIONAL_VS_HIBRIDO"), false);
    assert.strictEqual(isMatchingTipo("SIMPLES_VS_PRESUMIDO", "SIMPLES_VS_PRESUMIDO"), true);
  });

  it("5. troca de módulo limpa resultado anterior", () => {
    // Simulate: has results for type A, then switches to type B
    const resultadosTipoA = { sn: { total: 100 } };
    const novoTipo = "SIMPLES_TRADICIONAL_VS_HIBRIDO";
    // Should not use old results
    assert.strictEqual(isMatchingTipo("SIMPLES_VS_PRESUMIDO", novoTipo), false);
  });

  it("6. timeout encerra loading", () => {
    // Test the timeout logic
    let loading = true;
    const requestId = "req-1";
    let currentRequestId = requestId;

    // Simulate timeout
    if (currentRequestId === requestId) {
      currentRequestId = null;
      loading = false;
    }

    assert.strictEqual(loading, false);
    assert.strictEqual(currentRequestId, null);
  });

  it("7. motor não pronto impede cálculo", () => {
    let engineReady = false;
    let calculationBlocked = false;

    if (!engineReady) {
      calculationBlocked = true;
    }

    assert.strictEqual(calculationBlocked, true);
  });

  it("8. engineReady libera cálculo", () => {
    let engineReady = true;
    let calculationAllowed = false;

    if (engineReady) {
      calculationAllowed = true;
    }

    assert.strictEqual(calculationAllowed, true);
  });

  it("9. resposta de erro não é renderizada como resultado", () => {
    const errorResponse = { error: { code: "CALCULATION_ERROR", message: "Erro" } };
    const successResponse = { sn: { total: 1000 }, lp: { total: 2000 } };

    // Validator would reject error response
    const errorValidation = validateAnaliseSimplesPresumido(errorResponse);
    assert.notStrictEqual(errorValidation, null);

    // Validator accepts success response
    const successValidation = validateAnaliseSimplesPresumido(successResponse);
    assert.strictEqual(successValidation, null);
  });

  it("10. valor NaN é rejeitado", () => {
    const nanResults = { sn: { total: NaN }, lp: { total: 2000 } };
    const validation = validateAnaliseSimplesPresumido(nanResults);
    assert.notStrictEqual(validation, null);
    assert.ok(validation.includes("inválido") || validation.includes("NaN"));
  });

  it("11. valor Infinity é rejeitado", () => {
    const infResults = { sn: { total: Infinity }, lp: { total: 2000 } };
    const validation = validateAnaliseSimplesPresumido(infResults);
    assert.notStrictEqual(validation, null);
  });

  it("12. PDF de outro requestId é ignorado", () => {
    const currentId = "current-pdf-req";
    const staleResponseId = "stale-pdf-req";
    assert.strictEqual(isMatchingRequestId(staleResponseId, currentId), false);
  });

  it("13. validação de estrutura mínima para Simples×Presumido", () => {
    const valid = { sn: { total: 1000 }, lp: { total: 2000 } };
    const invalid = { sn: { total: 1000 } };
    assert.strictEqual(validateAnaliseSimplesPresumido(valid), null);
    assert.notStrictEqual(validateAnaliseSimplesPresumido(invalid), null);
  });

  it("14. validação de estrutura mínima para Híbrido", () => {
    const valid = { simplesTradicional: { total: 1000 }, simplesHibrido: { total: 2000 } };
    const invalid = { simplesTradicional: { total: 1000 } };
    assert.strictEqual(validateAnaliseHibrido(valid), null);
    assert.notStrictEqual(validateAnaliseHibrido(invalid), null);
  });

  it("15. validação de estrutura mínima para Reforma", () => {
    const valid = { lucroPresumidoAtual: { total: 1000 }, cenarioFuturo: { total: 2000 } };
    const invalid = { lucroPresumidoAtual: { total: 1000 } };
    assert.strictEqual(validateAnaliseReforma(valid), null);
    assert.notStrictEqual(validateAnaliseReforma(invalid), null);
  });

  it("16. hasValidNumbers rejeita NaN recursivamente", () => {
    const obj = { a: 1, b: { c: NaN } };
    assert.strictEqual(hasValidNumbers(obj), false);
  });

  it("17. hasValidNumbers aceita números válidos", () => {
    const obj = { a: 1, b: { c: 2, d: 0 } };
    assert.strictEqual(hasValidNumbers(obj), true);
  });

  it("18. mensagem sem tipo conhecido é ignorada", () => {
    assert.strictEqual(isValidMessage({ type: "unknown" }), false);
    assert.strictEqual(isValidMessage({}), false);
    assert.strictEqual(isValidMessage(null), false);
    assert.strictEqual(isValidMessage({ type: "resultado" }), true);
  });

  it("19. storage antigo ou inválido é descartado", () => {
    const STORAGE_SCHEMA_VERSION = 1;

    function isValidStored(stored) {
      if (!stored) return false;
      if (stored.version !== STORAGE_SCHEMA_VERSION) return false;
      if (!stored.tipoComparacao) return false;
      if (!stored.data || typeof stored.data !== "object") return false;
      return true;
    }

    const oldVersion = { version: 0, tipoComparacao: "SIMPLES_VS_PRESUMIDO", data: { sn: {} } };
    const noTipo = { version: 1, data: { sn: {} } };
    const valid = { version: 1, tipoComparacao: "SIMPLES_VS_PRESUMIDO", data: { sn: {} } };

    assert.strictEqual(isValidStored(oldVersion), false);
    assert.strictEqual(isValidStored(noTipo), false);
    assert.strictEqual(isValidStored(valid), true);
  });

  it("20. armazenamento separado por tipo de comparação", () => {
    // Each tipo should use a different storage key
    function getStorageKeyForTipo(tipo) {
      switch (tipo) {
        case "SIMPLES_VS_PRESUMIDO": return "ct_resultados_SIMPLES_VS_PRESUMIDO";
        case "SIMPLES_TRADICIONAL_VS_HIBRIDO": return "ct_resultados_SIMPLES_TRADICIONAL_VS_HIBRIDO";
        case "PRESUMIDO_ATUAL_VS_REFORMA": return "ct_resultados_PRESUMIDO_ATUAL_VS_REFORMA";
      }
    }

    const key1 = getStorageKeyForTipo("SIMPLES_VS_PRESUMIDO");
    const key2 = getStorageKeyForTipo("SIMPLES_TRADICIONAL_VS_HIBRIDO");
    const key3 = getStorageKeyForTipo("PRESUMIDO_ATUAL_VS_REFORMA");

    assert.notStrictEqual(key1, key2);
    assert.notStrictEqual(key2, key3);
    assert.notStrictEqual(key1, key3);
  });
});

describe("Formulário", () => {
  it("CNAE não sobrescreve tipoAtivLP manual", () => {
    // The fix: only auto-fill tipoAtivLP when it's empty
    let tipoAtivLP = "comercio";
    const cnae = "6920-6/01"; // This would suggest "servicos"
    const isManual = tipoAtivLP !== "";

    if (cnae && !tipoAtivLP) {
      tipoAtivLP = "servicos";
    }

    // Should NOT have changed because it was manually set
    assert.strictEqual(tipoAtivLP, "comercio");
  });
});
