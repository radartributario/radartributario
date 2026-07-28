import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";

const html = readFileSync(
  new URL("../public/comparador.html", import.meta.url),
  "utf-8"
);

const jsMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!jsMatch) throw new Error("No script found");
const code = jsMatch[1];

const initIdx = code.indexOf("// ===== INIT =====");
const codeToEval = code.substring(0, initIdx !== -1 ? initIdx : code.length);

function mockEl(overrides = {}) {
  return { value: '', innerHTML: '', textContent: '', style: {}, classList: { add: () => {}, remove: () => {} }, disabled: false, checked: false, options: [], selectedIndex: -1, dataset: {}, ...overrides };
}

const mockDoc = {
  getElementById: () => mockEl(),
  querySelector: () => mockEl(),
  querySelectorAll: () => [],
  createElement: () => mockEl(),
  createTextNode: () => ({}),
};
const mockWindow = {
  CNAE_TAX_DATA: {},
  CNAE_ANEXO_IV: new Set(),
  CNAE_FATOR_R: new Set(),
  addEventListener: () => {},
  getCbsTreatment: () => ({}),
  location: { href: "" },
};

const fn = new Function(
  "window",
  "document",
  "console",
  codeToEval +
    "; return { BENEFICIOS_CBS_IBS, getBeneficioCNAE, getCbsReducao, getCbsAliqEfetiva, calcularComparacaoSimplesHibrido };"
);

const engine = fn(mockWindow, mockDoc, console);

function fd(overrides = {}) {
  return {
    rbt12: overrides.rbt12 ?? 1200000,
    cnae: overrides.cnae ?? "6920601",
    optOutPct: "100",
    aliqCbsFora: "8.8",
    credCbsPct: "50",
    comprasInput: "0",
    salarios: "0",
    prolabore: "0",
    inss: "20",
    rat: "3",
    terceiros: "3.3",
    fgts: "8",
    aliquotaISS: "2.5",
    aliquotaICMS: "0",
    tipoAtivLP: "servicos",
    anoSIM: "2027",
    ...overrides
  };
}

// ==========================
// TESTS: Estrutura da tabela
// ==========================
describe("BENEFICIOS_CBS_IBS — Estrutura", () => {
  it("deve existir e ser um Map", () => {
    assert.ok(engine.BENEFICIOS_CBS_IBS instanceof Map, "deve ser um Map");
  });

  it("cada entrada deve ter campos obrigatórios", () => {
    for (const [cnae, b] of engine.BENEFICIOS_CBS_IBS) {
      assert.ok(b.pct !== undefined, `${cnae}: pct obrigatório`);
      assert.ok(b.artigo !== undefined, `${cnae}: artigo obrigatório`);
      assert.ok(b.descricao?.length > 0, `${cnae}: descricao obrigatório`);
      assert.ok(b.baseLegal?.length > 0, `${cnae}: baseLegal obrigatório`);
      assert.ok(b.condicional !== undefined, `${cnae}: condicional obrigatório`);
      assert.ok(b.tipo?.length > 0, `${cnae}: tipo obrigatório`);
    }
  });

  it("não deve conter CNAEs excluídos (cartórios, consultoria, publicidade, design)", () => {
    assert.ok(!engine.BENEFICIOS_CBS_IBS.has("6912-5"), "cartórios não deve estar na tabela");
    assert.ok(!engine.BENEFICIOS_CBS_IBS.has("7020-4"), "consultoria não deve estar na tabela");
    assert.ok(!engine.BENEFICIOS_CBS_IBS.has("7310-0"), "publicidade não deve estar na tabela");
    assert.ok(!engine.BENEFICIOS_CBS_IBS.has("7410-2"), "design não deve estar na tabela");
    assert.ok(!engine.BENEFICIOS_CBS_IBS.has("7490-1"), "serviços profissionais diversos não deve estar");
  });
});

// ==========================
// TESTS: Percentuais corretos
// ==========================
describe("BENEFICIOS_CBS_IBS — Percentuais corretos por tipo", () => {
  it("REDUCAO_30_ART_127 deve ter pct=0.30", () => {
    for (const [cnae, b] of engine.BENEFICIOS_CBS_IBS) {
      if (b.tipo === "REDUCAO_30_ART_127") {
        assert.strictEqual(b.pct, 0.30, `${cnae}: REDUCAO_30_ART_127 deve ser 0.30, obtido ${b.pct}`);
        assert.ok(b.condicional === true, `${cnae}: REDUCAO_30_ART_127 deve ser condicional`);
      }
    }
  });

  it("REDUCAO_60_ART_128 deve ter pct=0.60", () => {
    for (const [cnae, b] of engine.BENEFICIOS_CBS_IBS) {
      if (b.tipo === "REDUCAO_60_ART_128") {
        assert.strictEqual(b.pct, 0.60, `${cnae}: REDUCAO_60_ART_128 deve ser 0.60, obtido ${b.pct}`);
        assert.ok(b.condicional === false, `${cnae}: REDUCAO_60_ART_128 não deve ser condicional`);
      }
    }
  });

  it("nenhum benefício deve ter pct=0.40 (percentual incorreto antigo)", () => {
    for (const [cnae, b] of engine.BENEFICIOS_CBS_IBS) {
      if (b.pct === 0.40) {
        assert.fail(`${cnae}: pct=0.40 encontrado — percentual antigo incorreto ainda presente`);
      }
    }
  });
});

// ==========================
// TESTS: getBeneficioCNAE
// ==========================
describe("getBeneficioCNAE()", () => {
  it("CNAE 6920601 (contabilidade) → Art. 127, 30%, condicional", () => {
    const b = engine.getBeneficioCNAE("6920601");
    assert.ok(b, "deve encontrar benefício");
    assert.strictEqual(b.pct, 0.30, "pct deve ser 0.30");
    assert.strictEqual(b.artigo, 127, "artigo 127");
    assert.strictEqual(b.inciso, "VII", "inciso VII (contabilistas)");
    assert.ok(b.condicional === true, "deve ser condicional");
  });

  it("CNAE 6911701 (advocacia) → Art. 127, 30%, condicional", () => {
    const b = engine.getBeneficioCNAE("6911701");
    assert.ok(b);
    assert.strictEqual(b.pct, 0.30);
    assert.strictEqual(b.artigo, 127);
    assert.strictEqual(b.inciso, "II");
    assert.ok(b.condicional);
  });

  it("CNAE 7111100 (engenharia) → Art. 127, 30%, condicional", () => {
    const b = engine.getBeneficioCNAE("7111100");
    assert.ok(b);
    assert.strictEqual(b.pct, 0.30);
    assert.strictEqual(b.artigo, 127);
    assert.strictEqual(b.inciso, "XI");
    assert.ok(b.condicional);
  });

  it("CNAE 8610100 (hospital) → Art. 130, 60%, não condicional", () => {
    const b = engine.getBeneficioCNAE("8610100");
    assert.ok(b);
    assert.strictEqual(b.pct, 0.60);
    assert.strictEqual(b.artigo, 130);
    assert.ok(!b.condicional);
  });

  it("CNAE 8520100 (ensino médio) → Art. 129, 60%, não condicional", () => {
    const b = engine.getBeneficioCNAE("8520100");
    assert.ok(b);
    assert.strictEqual(b.pct, 0.60);
    assert.strictEqual(b.artigo, 129);
    assert.ok(!b.condicional);
  });

  it("CNAE 4711100 (comércio) → null (sem benefício)", () => {
    assert.strictEqual(engine.getBeneficioCNAE("4711100"), null);
  });

  it("CNAE 6201500 (TI) → null (sem benefício)", () => {
    assert.strictEqual(engine.getBeneficioCNAE("6201500"), null);
  });

  it("CNAE vazio/null → null", () => {
    assert.strictEqual(engine.getBeneficioCNAE(""), null);
    assert.strictEqual(engine.getBeneficioCNAE(null), null);
    assert.strictEqual(engine.getBeneficioCNAE(undefined), null);
  });

  it("CNAE com traço 6911-7/01 funciona", () => {
    const b = engine.getBeneficioCNAE("6911-7/01");
    assert.ok(b);
    assert.strictEqual(b.pct, 0.30);
  });
});

// ==========================
// TESTS: getCbsAliqEfetiva (com e sem confirmação condicional)
// ==========================
describe("getCbsAliqEfetiva()", () => {
  const aliqPadrao = 0.088;

  it("CNAE 6920601 SEM confirmação → alíquota padrão (sem redução)", () => {
    const r = engine.getCbsAliqEfetiva("6920601", aliqPadrao, false);
    assert.strictEqual(r.aliqEfetiva, aliqPadrao, "sem confirmação = alíquota padrão");
    assert.strictEqual(r.reducao, null, "reducao deve ser null sem confirmação");
  });

  it("CNAE 6920601 COM confirmação → alíquota reduzida 6,16% (8,8% * 0,7)", () => {
    const r = engine.getCbsAliqEfetiva("6920601", aliqPadrao, true);
    assert.ok(Math.abs(r.aliqEfetiva - 0.0616) < 0.0001, `esperado ~0.0616, obtido ${r.aliqEfetiva}`);
    assert.ok(r.reducao, "deve ter reducao");
    assert.strictEqual(r.reducao.pct, 0.30);
  });

  it("CNAE 8610100 (hospital, não condicional) → alíquota reduzida 3,52% independente de confirmação", () => {
    const r1 = engine.getCbsAliqEfetiva("8610100", aliqPadrao, false);
    const r2 = engine.getCbsAliqEfetiva("8610100", aliqPadrao, true);
    assert.strictEqual(r1.aliqEfetiva, r2.aliqEfetiva, "deve ser igual com ou sem confirmação");
    assert.ok(Math.abs(r1.aliqEfetiva - 0.0352) < 0.0001, `esperado ~0.0352, obtido ${r1.aliqEfetiva}`);
  });

  it("CNAE sem benefício → alíquota padrão", () => {
    const r = engine.getCbsAliqEfetiva("4711100", aliqPadrao, false);
    assert.strictEqual(r.aliqEfetiva, aliqPadrao);
    assert.strictEqual(r.reducao, null);
  });
});

// ==========================
// TESTS: Integração com calcularComparacaoSimplesHibrido
// ==========================
describe("Integração com calcularComparacaoSimplesHibrido", () => {
  function calc(opts = {}) {
    const data = fd(opts);
    const formData = {
      rbt12Input: String(data.rbt12),
      comprasInput: String(data.comprasInput),
      salarios: data.salarios,
      prolabore: data.prolabore,
      inss: data.inss,
      rat: data.rat,
      terceiros: data.terceiros,
      fgts: data.fgts,
      aliquotaISS: data.aliquotaISS,
      aliquotaICMS: data.aliquotaICMS,
      tipoAtivLP: data.tipoAtivLP,
      cnae: data.cnae,
      optOutPct: data.optOutPct,
      anoSIM: data.anoSIM,
      aliqCbsFora: data.aliqCbsFora,
      aliqCbsCompras: data.aliqCbsCompras ?? "8.8",
      credCbsPct: data.credCbsPct,
      confirmadoBeneficioArt127: data.confirmadoBeneficioArt127 ?? false
    };
    return engine.calcularComparacaoSimplesHibrido(formData);
  }

  it("CNAE 6920601 SEM confirmação → alíquota CBS = 8.80% (padrão)", () => {
    const r = calc({ cnae: "6920601", confirmadoBeneficioArt127: false });
    assert.strictEqual(r.CBS.aliqPadrao, 8.8, "aliqPadrao deve ser 8.80%");
    assert.strictEqual(r.CBS.aliq, 8.8, "aliq efetiva = padrão sem confirmação");
    assert.strictEqual(r.CBS.reducao, null, "reducao null sem confirmação");
  });

  it("CNAE 6920601 COM confirmação → alíquota CBS = 6.16% (8.8% * 0.7)", () => {
    const r = calc({ cnae: "6920601", confirmadoBeneficioArt127: true });
    assert.strictEqual(r.CBS.aliqPadrao, 8.8, "aliqPadrao deve ser 8.80%");
    assert.ok(Math.abs(r.CBS.aliq - 6.16) < 0.01, `aliq efetiva ~6.16%, obtido ${r.CBS.aliq}`);
    assert.ok(r.CBS.reducao, "deve ter reducao");
    assert.strictEqual(r.CBS.reducao.pct, 30, "pct deve ser 30");
    assert.strictEqual(r.CBS.reducao.artigo, 127, "artigo 127");
    assert.ok(r.CBS.reducao.condicional, "deve ser condicional");
  });

  it("CNAE 8610100 (hospital) → alíquota CBS = 3.52% (8.8% * 0.4), incondicional", () => {
    const r = calc({ cnae: "8610100" });
    assert.strictEqual(r.CBS.aliqPadrao, 8.8);
    assert.ok(Math.abs(r.CBS.aliq - 3.52) < 0.01, `aliq efetiva ~3.52%, obtido ${r.CBS.aliq}`);
    assert.ok(r.CBS.reducao, "deve ter reducao");
    assert.strictEqual(r.CBS.reducao.pct, 60, "pct deve ser 60");
    assert.strictEqual(r.CBS.reducao.artigo, 130, "artigo 130");
    assert.ok(!r.CBS.reducao.condicional, "não deve ser condicional");
  });

  it("CNAE 4711100 (comércio) → sem redução, alíquota 8.80%", () => {
    const r = calc({ cnae: "4711100" });
    assert.strictEqual(r.CBS.reducao, null);
    assert.strictEqual(r.CBS.aliq, 8.8);
  });

  it("CNAE 6201500 (TI) → sem redução, alíquota 8.80%", () => {
    const r = calc({ cnae: "6201500" });
    assert.strictEqual(r.CBS.reducao, null);
    assert.strictEqual(r.CBS.aliq, 8.8);
  });

  it("CBS crédito usa alíquota própria das compras (separada da alíquota das vendas)", () => {
    // CNAE contabilidade (Anexo IV), R$ 1.2M receita, R$ 200K compras
    // Vendas: 6.16% (8.8% * 0.7) com confirmação do Art. 127
    // Compras: 8.80% (padrão)
    const r = calc({
      cnae: "6920601",
      confirmadoBeneficioArt127: true,
      comprasInput: "200000"
    });
    // CBS vendas
    assert.strictEqual(r.CBS.aliqPadrao, 8.8, "aliqPadrao deve ser 8.80%");
    assert.ok(Math.abs(r.CBS.aliq - 6.16) < 0.01, `aliq vendas ~6.16%, obtido ${r.CBS.aliq}`);
    assert.strictEqual(r.CBS.aliqCompras, 8.8, "aliq compras deve ser 8.80%");
    // Débito: 1.200.000 × 6.16% = 73.920
    assert.ok(Math.abs(r.CBS.debito - 73920) < 10, `débito ~73920, obtido ${r.CBS.debito}`);
    // Crédito: 200.000 × 8.80% = 17.600
    assert.ok(Math.abs(r.CBS.credito - 17600) < 10, `crédito ~17600, obtido ${r.CBS.credito}`);
    // CBS líquida: 73.920 - 17.600 = 56.320
    assert.ok(Math.abs(r.CBS.liquida - 56320) < 10, `CBS líquida ~56320, obtido ${r.CBS.liquida}`);
    // aliqCompras deve ser diferente de aliq (comprova independência)
    assert.notStrictEqual(r.CBS.aliqCompras, r.CBS.aliq, "aliqCompras deve ser diferente da aliq vendas");
  });

  it("CBS crédito NÃO herda alíquota reduzida das vendas (regra de independência)", () => {
    // Mesmo cenário, mas sem compras: crédito = 0
    const rSemCompra = calc({
      cnae: "6920601",
      confirmadoBeneficioArt127: true,
      comprasInput: "0"
    });
    // Com compras: crédito deve usar aliqCompras (8.80%), NÃO aliq vendas (6.16%)
    const rComCompra = calc({
      cnae: "6920601",
      confirmadoBeneficioArt127: true,
      comprasInput: "200000"
    });
    // Se crédito usasse aliq vendas (6.16%): credito = 200000 * 0.0616 = 12.320
    // Se crédito usa aliq compras (8.80%):  credito = 200000 * 0.088 = 17.600
    // 17.600 ≠ 12.320 → comprova independência
    assert.ok(Math.abs(rComCompra.CBS.credito - 17600) < 10,
      `crédito deve ser 17600 (aliq compras), obtido ${rComCompra.CBS.credito} — se fosse 12320 estaria usando aliq vendas`);
    // Verificar que o débito NÃO mudou com a presença de compras
    assert.ok(Math.abs(rComCompra.CBS.debito - rSemCompra.CBS.debito) < 1,
      "débito não deve mudar com compras");
  });
});
