import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";

const html = readFileSync(
  new URL("../public/comparador.html", import.meta.url),
  "utf-8"
);
const dashboardHibridoSource = readFileSync(
  new URL("../src/app/dashboard/components/DashboardResultadosHibrido.tsx", import.meta.url),
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
    "; return { BENEFICIOS_CBS_IBS, getBeneficioCNAE, getCbsReducao, getCbsAliqEfetiva, normalizeCnae, getCnaeDescricaoTributaria, getAnexoSN, getSNParams, isCnaeContabilidade, getCbsNomenclatura, calcularComparacaoSimplesHibrido, buildPdfHtmlFromObject };"
);

const engine = fn(mockWindow, mockDoc, console);
const moeda = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

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

  it("CNAE contabilidade em diferentes formatações aponta para o mesmo benefício", () => {
    for (const cnae of ["6920-6/01", "6920-6", "6920601", "69206", "6920"]) {
      const b = engine.getBeneficioCNAE(cnae);
      assert.ok(b, `benefício não encontrado para ${cnae}`);
      assert.strictEqual(b.inciso, "VII");
      assert.strictEqual(engine.getCnaeDescricaoTributaria(cnae), "Serviços contábeis");
    }
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
      confirmadoBeneficioArt127: data.confirmadoBeneficioArt127 ?? false,
      benefReqProfissionais: data.benefReqProfissionais,
      benefReqSemSocioPJ: data.benefReqSemSocioPJ,
      benefReqNaoParticipaPJ: data.benefReqNaoParticipaPJ,
      benefReqExclusiva: data.benefReqExclusiva,
      benefReqDireta: data.benefReqDireta
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

  it("Cenário contábil confirmado fecha em CBS 6,16% e total híbrido R$ 187.021,32", () => {
    const r = calc({
      cnae: "6920-6/01",
      rbt12: "1.200.000,00",
      comprasInput: "200.000,00",
      salarios: "50000",
      confirmadoBeneficioArt127: true,
    });
    assert.strictEqual(r.premissas.parametrosHibrido2027.versao, "simples-hibrido-2027-ibs-off-1");
    assert.strictEqual(r.simplesTradicional.anexo, "Anexo III");
    assert.ok(Math.abs(r.simplesTradicional.total - 156360) < 0.02);
    assert.strictEqual(r.CBS.aliqPadrao, 8.8);
    assert.ok(Math.abs(r.CBS.aliq - 6.16) < 0.01);
    assert.ok(Math.abs(r.CBS.debito - 73920) < 0.02);
    assert.ok(Math.abs(r.CBS.credito - 17600) < 0.02);
    assert.ok(Math.abs(r.CBS.liquida - 56320) < 0.02);
    assert.ok(Math.abs(r.simplesHibrido.dasReduzido - moeda(r.simplesHibrido.dasIntegral - r.simplesHibrido.parcelaCbsRetiradaDoDas)) < 0.02);
    assert.ok(Math.abs(r.simplesHibrido.parcelaCbsRetiradaDoDas - 25658.68) < 0.02);
    assert.strictEqual(r.simplesHibrido.parcelaIbsRetiradaDoDas, 0);
    assert.ok(Math.abs(r.simplesHibrido.dasReduzido - 130701.32) < 0.02);
    assert.ok(Math.abs(r.simplesHibrido.total - 187021.32) < 0.02);
    assert.strictEqual(moeda(r.simplesHibrido.total), moeda(r.simplesHibrido.dasReduzido + r.CBS.liquida));
    assert.strictEqual(r.simplesHibrido.ibsLiquido, 0);
    assert.strictEqual(moeda(r.simplesHibrido.total), moeda(r.simplesHibrido.dasReduzido + r.CBS.liquida + r.simplesHibrido.ibsLiquido));
    assert.ok(Math.abs(r.comparacaoFinanceira.valorAnual - 30661.32) < 0.02);
    assert.ok(Math.abs(r.comparacaoFinanceira.percentual - 19.61) < 0.02);
    assert.ok(Math.abs(r.simplesTradicional.aliquota - 13.03) < 0.01);
    assert.ok(Math.abs(r.simplesHibrido.aliquota - 15.59) < 0.01);
    assert.ok(Math.abs(r.simplesHibrido.media - 15585.11) < 0.02);
    assert.strictEqual(r.premissas.cbsNomenclatura.base, "CBS sobre prestação de serviços");
    assert.strictEqual(r.premissas.cbsNomenclatura.debito, "Débito sobre serviços");
    assert.strictEqual(r.cenariosBeneficio, null);
  });

  it("Nomenclatura CBS varia por natureza da atividade", () => {
    assert.strictEqual(engine.getCbsNomenclatura("6920-6/01", "servicos").base, "CBS sobre prestação de serviços");
    assert.strictEqual(engine.getCbsNomenclatura("4711-3/01", "comercio").base, "CBS sobre vendas de mercadorias");
    assert.strictEqual(engine.getCbsNomenclatura("1012-1/00", "industria").base, "CBS sobre vendas de produtos");
    assert.strictEqual(engine.getCbsNomenclatura("0000-0/00", "mista").base, "CBS sobre receitas tributáveis");
  });

  it("Contabilidade com folha zerada nunca cai no Anexo V", () => {
    const r = calc({
      cnae: "6920-6/01",
      rbt12: "1.200.000,00",
      comprasInput: "200.000,00",
      salarios: "0",
      prolabore: "0",
      confirmadoBeneficioArt127: true,
    });
    assert.strictEqual(r.premissas.cnaeNormalizado, "6920601");
    assert.strictEqual(r.premissas.atividadeDescricao, "Serviços contábeis");
    assert.strictEqual(r.premissas.categoriaTributaria, "contabilidade");
    assert.strictEqual(r.premissas.fatorRAplicavel, false);
    assert.strictEqual(r.premissas.fatorRDescricao, "Não utilizado para definição do Anexo nesta atividade.");
    assert.strictEqual(r.simplesTradicional.anexo, "Anexo III");
    assert.strictEqual(r.premissas.faixa, 4);
    assert.ok(Math.abs(r.simplesTradicional.total - 156360) < 0.02);
    assert.ok(Math.abs(r.simplesTradicional.aliquota - 13.03) < 0.01);
    assert.strictEqual(typeof r.simplesTradicional.aliqNominal, "number");
    assert.strictEqual(typeof r.simplesTradicional.deducao, "number");
    const paramsFaixa = engine.getSNParams(r.simplesTradicional.anexo, r.simplesTradicional.rbt12);
    assert.deepStrictEqual(
      { aliq: r.simplesTradicional.aliqNominal, deducao: r.simplesTradicional.deducao },
      paramsFaixa
    );
    assert.notStrictEqual(r.simplesTradicional.total, 228900);
    assert.notStrictEqual(r.simplesTradicional.aliquota, 19.075);
    assert.notStrictEqual(r.simplesTradicional.anexo, "Anexo V");
  });

  it("Todos os formatos de CNAE contábil permanecem no Anexo III independentemente da folha", () => {
    const folhas = ["0", "10000", "28000", "50000"];
    for (const cnae of ["6920-6/01", "6920-6", "6920601", "69206", "6920"]) {
      assert.strictEqual(engine.isCnaeContabilidade(cnae), true, `${cnae} deveria ser contabilidade`);
      for (const salarios of folhas) {
        const r = calc({ cnae, rbt12: "1.200.000,00", comprasInput: "200.000,00", salarios, prolabore: "0", confirmadoBeneficioArt127: true });
        assert.strictEqual(r.simplesTradicional.anexo, "Anexo III", `${cnae} folha ${salarios}`);
        assert.ok(Math.abs(r.simplesTradicional.total - 156360) < 0.02, `${cnae} folha ${salarios}`);
      }
    }
  });

  it("Cenário contábil não confirmado mantém CBS 8,80% e total híbrido R$ 218.701,32", () => {
    const r = calc({
      cnae: "6920-6/01",
      rbt12: "1.200.000,00",
      comprasInput: "200.000,00",
      salarios: "50000",
      confirmadoBeneficioArt127: "nao",
    });
    assert.strictEqual(r.premissas.beneficioProfissional.status, "NAO_APLICADO");
    assert.strictEqual(r.CBS.aliq, 8.8);
    assert.strictEqual(r.CBS.reducao, null);
    assert.ok(Math.abs(r.CBS.liquida - 88000) < 0.02);
    assert.ok(Math.abs(r.simplesHibrido.total - 218701.32) < 0.02);
  });

  it("Cenário contábil sem resposta apresenta os dois resultados", () => {
    const r = engine.calcularComparacaoSimplesHibrido({
      rbt12Input: "1.200.000,00", comprasInput: "200.000,00", salarios: "50000", prolabore: "0",
      inss: "20", rat: "3", terceiros: "3.3", fgts: "8", aliquotaISS: "2.5", aliquotaICMS: "0",
      tipoAtivLP: "servicos", cnae: "6920-6/01", optOutPct: "100", anoSIM: "2027", aliqCbsFora: "8.8", aliqCbsCompras: "8.8"
    });
    assert.strictEqual(r.premissas.beneficioProfissional.status, "PENDENTE");
    assert.strictEqual(r.conclusao.vencedor, "Resultado condicionado");
    assert.strictEqual(r.conclusao.tipoImpacto, "CONDICIONADO");
    assert.ok(r.cenariosBeneficio?.comBeneficioConfirmado);
    assert.ok(r.cenariosBeneficio?.semBeneficioConfirmado);
    assert.ok(Math.abs(r.cenariosBeneficio.comBeneficioConfirmado.simplesHibrido.total - 187021.32) < 0.02);
    assert.ok(Math.abs(r.cenariosBeneficio.semBeneficioConfirmado.simplesHibrido.total - 218701.32) < 0.02);
  });

  it("Confirmação pelos cinco requisitos legais aplica o benefício", () => {
    const r = calc({
      cnae: "6920-6/01", rbt12: "1.200.000,00", comprasInput: "200.000,00", salarios: "50000",
      confirmadoBeneficioArt127: undefined,
      benefReqProfissionais: "sim", benefReqSemSocioPJ: "sim", benefReqNaoParticipaPJ: "sim", benefReqExclusiva: "sim", benefReqDireta: "sim",
    });
    assert.strictEqual(r.premissas.beneficioProfissional.status, "APLICADO");
    assert.ok(Math.abs(r.CBS.aliq - 6.16) < 0.01);
  });

  it("Compras zero zeram o crédito sem alterar o débito reduzido", () => {
    const r = calc({ cnae: "6920-6/01", rbt12: "1.200.000,00", comprasInput: "0", salarios: "50000", confirmadoBeneficioArt127: true });
    assert.ok(Math.abs(r.CBS.debito - 73920) < 0.02);
    assert.strictEqual(r.CBS.credito, 0);
    assert.ok(Math.abs(r.CBS.liquida - 73920) < 0.02);
  });

  it("Detalhamento completo do Simples Tradicional, DAS ajustado e IBS zerado é retornado", () => {
    const r = calc({ cnae: "6920-6/01", rbt12: "1.200.000,00", comprasInput: "200.000,00", salarios: "50000", confirmadoBeneficioArt127: true });
    const tradTributos = r.detalhamento.simplesTradicional.map(x => x.tributo);
    for (const tributo of ["IRPJ", "CSLL", "PIS", "Cofins", "CPP", "ISS", "CBS", "IBS", "Total do DAS"]) {
      assert.ok(tradTributos.includes(tributo), `faltou ${tributo}`);
    }
    const totalAjustado = r.detalhamento.dasAjustado.find(x => x.tributo === "Total do DAS");
    assert.ok(Math.abs(totalAjustado.valorAnual - r.simplesHibrido.dasReduzido) < 0.02);
    assert.strictEqual(r.simplesHibrido.parcelaIbsRetiradaDoDas, 0);
    assert.strictEqual(r.simplesHibrido.ibsLiquido, 0);
    assert.ok(Math.abs(r.simplesHibrido.total - (r.simplesHibrido.dasReduzido + r.CBS.liquida)) < 0.02);
    assert.strictEqual(r.IBS.liquido, 0);
    assert.ok(r.detalhamento.tributosRetirados.some(x => x.tributo === "IBS retirado do DAS"));
  });

  it("PDF gerado contém benefício, memória CBS/IBS e os mesmos valores principais", async () => {
    const r = calc({ cnae: "6920-6/01", rbt12: "1.200.000,00", comprasInput: "200.000,00", salarios: "50000", confirmadoBeneficioArt127: true });
    const html = await new Promise(resolve => engine.buildPdfHtmlFromObject(r, { cnae: "6920-6/01", atividade: "Serviços contábeis", rbt12Input: "1.200.000,00", comprasInput: "200.000,00", salarios: "50000" }, resolve));
    assert.ok(html.includes("Premissas da Simulação"));
    assert.ok(html.includes("Benefício Fiscal"));
    assert.ok(html.includes("LC 214/2025"));
    assert.ok(html.includes("Resultado Executivo"));
    assert.ok(html.includes("Memória Resumida"));
    assert.ok(html.includes("CBS"));
    assert.ok(html.includes("IBS (2027)"));
    assert.ok(html.includes("Não produz impacto financeiro nesta simulação"));
    assert.ok(html.includes("Permanece recolhido dentro do DAS nesta premissa do simulador"));
    assert.ok(html.includes("Simples Tradicional"));
    assert.ok(html.includes("Simples Híbrido"));
    assert.ok(html.includes("R$ 56.320,00"));
    assert.ok(html.includes("R$ 187.021,32"));
    assert.ok(html.includes("15,59%"));
    assert.ok(html.includes("R$ 2.555,11"));
    assert.ok(html.includes("Receita tributável"));
    assert.ok(html.includes("Compras com crédito"));
    assert.ok(!html.includes("DAS reduzido + CBS líquida + IBS"));
    assert.ok(!html.includes("+ IBS líquido"));
    assert.ok(html.includes("Anexo III"));
    assert.ok(!html.includes("R$ 228.900,00"));
    assert.ok(!html.includes("R$ 88.000,00"));
    assert.ok(!html.includes("R$ 218.701,32"));
    assert.ok(!html.includes("Híbrido sem benefício"));
    assert.ok(!html.toLowerCase().includes("pendente"));
    assert.ok(!html.includes("Status"));
  });

  it("PDF sem respostas exibe redução prevista sem usar linguagem de pendência", async () => {
    const r = engine.calcularComparacaoSimplesHibrido({
      rbt12Input: "1.200.000,00", comprasInput: "200.000,00", salarios: "0", prolabore: "0",
      inss: "20", rat: "3", terceiros: "3.3", fgts: "8", aliquotaISS: "2.5", aliquotaICMS: "0",
      tipoAtivLP: "servicos", cnae: "6920-6/01", optOutPct: "100", anoSIM: "2027", aliqCbsFora: "8.8", aliqCbsCompras: "8.8"
    });
    const html = await new Promise(resolve => engine.buildPdfHtmlFromObject(r, { cnae: "6920-6/01", atividade: "Serviços contábeis", rbt12Input: "1.200.000,00", comprasInput: "200.000,00", salarios: "0" }, resolve));
    assert.ok(html.includes("Benefício Fiscal"));
    assert.ok(html.includes("Simples Tradicional") && (html.includes("A carga tributária passará") || html.includes("Não há vencedor")));
    assert.ok(html.includes("Simples Híbrido"));
    assert.ok(html.includes("R$ 187.021,32"));
    assert.ok(!html.includes("R$ 218.701,32"));
    assert.ok(html.includes("Carga Atual"));
    assert.ok(html.includes("Nova Carga"));
    assert.ok(!html.includes("R$ 228.900,00"));
    assert.ok(!html.toLowerCase().includes("pendente"));
    assert.ok(!html.includes("Resultado condicionado"));
    assert.ok(!html.includes("não elege vencedor"));
    assert.ok(!html.includes("Status"));
  });

  it("Interpretação visual Híbrido: tradicional menor gera aumento e vencedor tradicional", async () => {
    const r = calc({ cnae: "6920-6/01", rbt12: "1.200.000,00", comprasInput: "200.000,00", salarios: "0", confirmadoBeneficioArt127: true });
    const html = await new Promise(resolve => engine.buildPdfHtmlFromObject(r, { cnae: "6920-6/01", rbt12Input: "1.200.000,00", comprasInput: "200.000,00", salarios: "0" }, resolve));
    assert.ok(Math.abs(r.simplesTradicional.total - 156360) < 0.02);
    assert.ok(Math.abs(r.simplesHibrido.total - 187021.32) < 0.02);
    assert.ok(html.includes("Aumento de carga"));
    assert.ok(html.includes("Regime recomendado</span><strong>Simples Tradicional"));
    assert.ok(html.includes("A carga tributária passará") || html.includes("A carga tributária será reduzida") || html.includes("pontos percentuais"));
  });

  it("Interpretação visual Híbrido: híbrido menor gera economia e vencedor híbrido", async () => {
    const r = {
      tipoComparacao: "SIMPLES_TRADICIONAL_VS_HIBRIDO",
      simplesTradicional: { total: 156360, aliquota: 13.03, das: 156360, anexo: "Anexo III", rbt12: 1200000 },
      simplesHibrido: { total: 134221.32, aliquota: 11.19, dasIntegral: 156360, parcelaCbsRetiradaDoDas: 25658.68, dasReduzido: 102221.32 },
      CBS: { liquida: 32000, aliq: 6.16, aliqCompras: 8.8, debito: 73920, credito: 41920 },
      premissas: { compras: 476363.64, anexo: "Anexo III", beneficioProfissional: { potencial: true, pctReducao: 30, baseLegal: "LC 214/2025" } },
      detalhamento: { simplesTradicional: [] },
      conclusao: { vencedor: "Simples Tradicional" },
      comparacaoFinanceira: { valorAnual: 999999, tipo: "AUMENTO" }
    };
    const html = await new Promise(resolve => engine.buildPdfHtmlFromObject(r, { cnae: "6920-6/01", rbt12Input: "1.200.000,00", comprasInput: "476.363,64" }, resolve));
    assert.ok(html.includes("Economia anual"));
    assert.ok(html.includes("Regime recomendado</span><strong>Simples Híbrido"));
    assert.ok(html.includes("A carga tributária passará") || html.includes("A carga tributária será reduzida") || html.includes("pontos percentuais"));
    assert.ok(!html.includes("R$ 999.999,00"));
  });

  it("Interpretação visual Híbrido: valores iguais geram empate sem vencedor", async () => {
    const r = {
      tipoComparacao: "SIMPLES_TRADICIONAL_VS_HIBRIDO",
      simplesTradicional: { total: 150000, aliquota: 12.5, das: 150000, anexo: "Anexo III", rbt12: 1200000 },
      simplesHibrido: { total: 150000, aliquota: 12.5, dasIntegral: 150000, parcelaCbsRetiradaDoDas: 0, dasReduzido: 150000 },
      CBS: { liquida: 0, aliq: 8.8, aliqCompras: 8.8, debito: 0, credito: 0 },
      premissas: { compras: 0, anexo: "Anexo III" },
      detalhamento: { simplesTradicional: [] },
      conclusao: { vencedor: "Simples Tradicional" },
      comparacaoFinanceira: { valorAnual: 12345, tipo: "AUMENTO" }
    };
    const html = await new Promise(resolve => engine.buildPdfHtmlFromObject(r, { cnae: "6920-6/01", rbt12Input: "1.200.000,00", comprasInput: "0,00" }, resolve));
    assert.ok(html.includes("Diferença zero"));
    assert.ok(html.includes("Regime recomendado</span><strong>Empate"));
    assert.ok(html.includes("Não há vencedor para esta simulação"));
    assert.ok(html.includes("R$ 0,00"));
    assert.ok(!html.includes("R$ 12.345,00"));
  });

  it("Interpretação visual Híbrido: compras elevadas mantêm CBS, DAS, total, vencedor e PDF consistentes", async () => {
    const r = calc({ cnae: "6920-6/01", rbt12: "1.200.000,00", comprasInput: "800.000,00", salarios: "0", confirmadoBeneficioArt127: true });
    const html = await new Promise(resolve => engine.buildPdfHtmlFromObject(r, { cnae: "6920-6/01", rbt12Input: "1.200.000,00", comprasInput: "800.000,00", salarios: "0" }, resolve));
    assert.ok(Math.abs(r.CBS.liquida - 3520) < 0.02);
    assert.ok(Math.abs(r.simplesHibrido.dasReduzido - 130701.32) < 0.02);
    assert.ok(Math.abs(r.simplesHibrido.total - 134221.32) < 0.02);
    assert.ok(r.simplesHibrido.total < r.simplesTradicional.total);
    assert.ok(html.includes("CBS líquida</td><td class=\"num\">R$ 3.520,00"));
    assert.ok(html.includes("(=) DAS reduzido</td><td class=\"num\">R$ 130.701,32"));
    assert.ok(html.includes("(=) Total Híbrido</td><td class=\"num\">R$ 134.221,32"));
    assert.ok(html.includes("Economia anual"));
    assert.ok(html.includes("Regime recomendado</span><strong>Simples Híbrido"));
    assert.ok(html.includes("A carga tributária passará") || html.includes("A carga tributária será reduzida") || html.includes("pontos percentuais"));
  });
});

describe("DashboardResultadosHibrido — não recalcula Simples Nacional", () => {
  it("não contém tabela de faixas nem fórmula própria do DAS no componente", () => {
    assert.ok(!dashboardHibridoSource.includes("getSNParams"));
    assert.ok(!dashboardHibridoSource.includes("calcularSN"));
    assert.ok(!dashboardHibridoSource.includes("PARAMETROS_SIMPLES"));
    assert.ok(!dashboardHibridoSource.includes("[180000"));
    assert.ok(!dashboardHibridoSource.includes("35640"));
    assert.ok(!dashboardHibridoSource.includes("648000"));
    assert.ok(!/(?:aliqNominal|aliquota|alíquota)[\s\S]{0,80}0\.16/i.test(dashboardHibridoSource));
    assert.ok(!/rbt\w*\s*\*\s*aliq\w*\s*-\s*dedu/i.test(dashboardHibridoSource));
    assert.ok(!/\(\s*[^)]*aliqNominal[^)]*deducao[^)]*\)\s*\/\s*rbt/i.test(dashboardHibridoSource));
    assert.ok(!dashboardHibridoSource.includes("conclusao.vencedor"));
    assert.ok(!dashboardHibridoSource.includes("comparacaoFinanceira"));
  });
});
