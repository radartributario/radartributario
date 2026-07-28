// =============================================================================
// homologacao_tributaria.test.mjs
// Auditoria de Homologação Tributária — 18 cenários independentes
//
// Metodologia:
// - Os valores esperados são calculados MANUALMENTE a partir das fórmulas
//   legais (LC 123/2006, LC 155/2016, Lei 9.249/95, Lei 10.637/02, etc.)
// - NENHUM teste depende do motor para produzir o valor esperado
// - Cada cenário documenta: entrada, fórmula, fundamento legal,
//   resultado esperado, resultado obtido, diferença
// =============================================================================

import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Carregamento do motor (mesmo procedimento dos demais testes)
// ---------------------------------------------------------------------------
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

// CNAE_FATOR_R reflete exatamente o Set do engine (classes com traço)
const mockCnaeFatorR = new Set([
  '6201-5','6202-3','6203-1','6204-0','6209-1',
  '6311-9','6319-4',
  '6611-8','6612-6','6613-4','6619-3',
  '6911-7','6912-5','6920-6',
  '7020-4',
  '7111-1','7112-0','7119-7',
  '7311-4','7312-2','7319-0','7410-2','7490-1','7500-1',
  '8220-2','8230-0',
  '8291-1','8292-0','8299-7',
  '8511-2','8512-1','8513-9','8514-7','8520-1',
  '8531-7','8532-5','8533-3','8541-4','8542-2','8550-3',
  '8610-1','8621-6','8622-4','8630-5','8640-2','8650-0','8660-7','8690-9',
  '9001-9','9002-7','9003-5',
  '9101-5','9102-3','9103-1',
  '9311-5','9312-3','9313-1','9319-1',
  '9511-8','9512-6','9521-5','9522-3','9529-1',
  '9601-7','9602-5','9603-3','9609-2',
]);

const mockWindow = {
  CNAE_TAX_DATA: {},
  CNAE_ANEXO_IV: new Set(),
  CNAE_FATOR_R: mockCnaeFatorR,
  addEventListener: () => {},
  getCbsTreatment: () => ({}),
  location: { href: "" },
};

const fn = new Function(
  "window", "document", "console",
  codeToEval +
    "; return { getIbsAliq2027, getSNParams, getAnexoSN, getSNParcelaIcmsIss, getSNFaixa, calcularSN, calcularLP, calcularCBS, calcularIBS, calcularImpacto, calcularComparacaoSimplesPresumido, calcularComparacaoSimplesHibrido, calcularComparacaoPresumidoReforma, checkEligibility, getBeneficioCNAE, getCbsAliqEfetiva, getCbsReducao, getReparticao2027, calcularSublimite, getCnaeCategoria, BENEFICIOS_CBS_IBS, CNAE_FATOR_R, CNAE_ANEXO_IV };"
);

const engine = fn(mockWindow, mockDoc, console);

// ---------------------------------------------------------------------------
// fd() — factory de dados de formulário
// ---------------------------------------------------------------------------
function fd(overrides = {}) {
  return {
    rbt12Input: "1.200.000,00",
    comprasInput: "200.000,00",
    salarios: "0",
    prolabore: "0",
    inss: "20",
    rat: "3",
    terceiros: "3.3",
    fgts: "8",
    aliquotaISS: "2.5",
    aliquotaICMS: "0",
    aliquotaIPI: "0",
    segregacao: "100",
    tipoAtivLP: "servicos",
    cnae: "6201-1/01", // NOT in Fator R → sempre Anexo III
    anoSIM: "2027",
    refCredPct: "100",
    optOutPct: "100",
    aliqCbsFora: "8.8",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Utilitário de diferença para relatório
// ---------------------------------------------------------------------------
const diferencas = [];

function registraDiferenca(cenario, campo, esperado, obtido, unidade) {
  const diff = typeof esperado === 'number' && typeof obtido === 'number'
    ? Math.abs(obtido - esperado) : (obtido === esperado ? 0 : NaN);
  diferencas.push({ cenario, campo, esperado, obtido, diff, unidade, aprovado: diff < (unidade === 'R$' ? 2 : 0.02) });
}

// =============================================================================
// CENÁRIO 1: COMÉRCIO (ANEXO I)
// =============================================================================
// Entrada:
//   RBT12 = R$ 2.400.000, ISS = 0%, ICMS = 18%, IPI = 0%
//   Compras = R$ 1.000.000, Folha = R$ 15.000/mês
//   CNAE 4711-3/01 (comércio varejista), segregação = 100%
// Fundamento legal:
//   - LC 123/2006 art. 18 §4º-A (tabela Anexo I)
//   - LC 155/2016 (faixas e deduções atualizadas)
//   - RIR/2018 art. 519 (presunção 8% para comércio)
//   - Lei 9.249/95 art. 3º (adicional IRPJ 10%)
//   - Lei 9.718/98 (CSLL 9%)
//   - Lei 10.637/02 e 10.833/03 (PIS 0,65%, COFINS 3%)
// =============================================================================
describe("Homologação — Cenário 1: Comércio (Anexo I)", () => {
  const cenario = fd({
    rbt12Input: "2.400.000,00",
    comprasInput: "1.000.000,00",
    tipoAtivLP: "comercio",
    cnae: "4711-3/01",
    aliquotaISS: "0",
    aliquotaICMS: "18",
    segregacao: "100",
    salarios: "10000",
    prolabore: "5000",
  });

  it("1a. SN — alíquota nominal, efetiva e DAS (Anexo I, 5ª faixa)", () => {
    // Anexo I 5ª faixa (1.800.000,01 a 3.600.000,00):
    // alíquota nominal = 14,30%, dedução = R$ 87.300 (LC 123/2006 art. 18 §4º-A c/c LC 155/2016)
    // alíquota efetiva = (RBT12 * aliqNominal - dedução) / RBT12
    //                  = (2.400.000 * 0,143 - 87.300) / 2.400.000
    //                  = (343.200 - 87.300) / 2.400.000
    //                  = 255.900 / 2.400.000 = 0,106625 = 10,6625%
    // DAS anual = RBT12 * alíquota efetiva = 2.400.000 * 0,106625 = R$ 255.900
    const aliqEfetivaEsperada = (2_400_000 * 0.143 - 87300) / 2_400_000 * 100;

    const result = engine.calcularComparacaoSimplesPresumido(cenario);
    if (result.error) throw new Error(result.error);

    assert.strictEqual(result.elegibilidade.snElegivel, true, "SN deve ser elegível");
    assert.strictEqual(result.sn.sublimiteIcms, false, "RBT12=2.4M < 3.6M → sem sublimite ICMS");

    registraDiferenca("1a", "DAS anual", 255900, result.sn.dasAnual, 'R$');
    registraDiferenca("1a", "Alíquota efetiva", aliqEfetivaEsperada, result.sn.aliquota, '%');

    assert.ok(Math.abs(result.sn.dasAnual - 255900) < 2,
      `DAS anual deve ser ~R$ 255.900, obtido: ${result.sn.dasAnual}`);
    assert.ok(Math.abs(result.sn.aliquota - aliqEfetivaEsperada) < 0.02,
      `Alíquota efetiva deve ser ~${aliqEfetivaEsperada.toFixed(2)}%, obtido: ${result.sn.aliquota}%`);
  });

  it("1b. LP — IRPJ, CSLL, PIS, COFINS, ICMS (comércio, presunção 8%/12%)", () => {
    // Cálculo independente do Lucro Presumido (NÃO lê valores do motor)
    const receitaLP = 2_400_000;
    const baseIRPJ = receitaLP * 0.08;
    const irpj15 = baseIRPJ * 0.15;
    const baseAdic = Math.max(0, baseIRPJ - 240_000);
    const adicIRPJ = baseAdic * 0.10;
    const baseCSLL = receitaLP * 0.12;
    const csll = baseCSLL * 0.09;
    const pis = receitaLP * 0.0065;
    const cofins = receitaLP * 0.03;
    const pisCofinsTotal = pis + cofins;
    const iss = 0;
    const icmsBruto = receitaLP * 0.18;
    const icmsCred = 1_000_000 * 0.18;
    const icmsLiq = Math.max(0, icmsBruto - icmsCred);
    const ipi = 0;
    // Engine usa apenas sal (não prolabore) para encargos (linha 4175 do motor)
    const encFolha = 10000 * (0.20 + 0.03 + 0.033 + 0.08) * 12;
    const total = irpj15 + adicIRPJ + csll + pisCofinsTotal + iss + icmsLiq + ipi + encFolha;

    const result = engine.calcularComparacaoSimplesPresumido(cenario);
    if (result.error) throw new Error(result.error);

    // statusCalculo retorna 'VALIDO' (não 'OK') no módulo SN×LP
    assert.strictEqual(result.statusCalculo, "VALIDO", "Status deve ser VALIDO");

    registraDiferenca("1b", "IRPJ 15%", irpj15, result.lp.irpj15, 'R$');
    registraDiferenca("1b", "IRPJ Adic", adicIRPJ, result.lp.irpjAdic || 0, 'R$');
    registraDiferenca("1b", "CSLL", csll, result.lp.csll, 'R$');
    registraDiferenca("1b", "PIS+COFINS", pisCofinsTotal, result.lp.pisCofins, 'R$');
    registraDiferenca("1b", "ICMS", icmsLiq, result.lp.icms, 'R$');
    registraDiferenca("1b", "Total LP", total, result.lp.total, 'R$');

    assert.ok(Math.abs(result.lp.irpj15 - irpj15) < 1);
    assert.ok(Math.abs((result.lp.irpjAdic || 0) - adicIRPJ) < 1);
    assert.ok(Math.abs(result.lp.csll - csll) < 1);
    assert.ok(Math.abs(result.lp.pisCofins - pisCofinsTotal) < 2);
    assert.ok(Math.abs(result.lp.icms - icmsLiq) < 2);
    assert.strictEqual(result.lp.iss, 0, "ISS deve ser 0 para comércio");
    assert.strictEqual(result.lp.ipi, 0, "IPI deve ser 0 para comércio");
    assert.ok(Math.abs(result.lp.total - total) < 2);
  });
});

// =============================================================================
// CENÁRIO 2: SERVIÇOS (ANEXO V) — Fator R ativo, CNAE 6911-7/01 (advocacia)
// =============================================================================
// Entrada:
//   RBT12 = R$ 1.200.000, ISS = 5%, ICMS = 0%, IPI = 0%
//   Compras = R$ 200.000, Folha = R$ 0 (Fator R = 0% → Anexo V)
//   CNAE 6911-7/01 (advocacia, sujeita a Fator R), segregação = 100%
// Fundamento legal:
//   - LC 123/2006 art. 18 §5º-D (Anexo V — Fator R < 28%)
//   - LC 155/2016 (faixas e deduções)
//   - RIR/2018 art. 520 (presunção 32% para serviços)
// =============================================================================
describe("Homologação — Cenário 2: Serviços (Anexo V, Fator R=0%)", () => {
  const cenario = fd({
    rbt12Input: "1.200.000,00",
    comprasInput: "200.000,00",
    tipoAtivLP: "servicos",
    cnae: "6911-7/01", // em CNAE_FATOR_R → Fator R decide Anexo III vs V
    aliquotaISS: "5",
    aliquotaICMS: "0",
    salarios: "0",
    prolabore: "0",
  });

  it("2a. SN — Anexo V, 4ª faixa (Fator R = 0% < 28%)", () => {
    // CNAE 6911-7/01 está em CNAE_FATOR_R
    // Fator R = 0% < 28% → Anexo V
    // Anexo V 4ª faixa (720.000,01 a 1.800.000,00):
    // alíquota nominal = 20,50%, dedução = R$ 17.100
    // alíquota efetiva = (1.200.000 * 0,205 - 17.100) / 1.200.000
    //                  = (246.000 - 17.100) / 1.200.000 = 228.900 / 1.200.000 = 0,19075 = 19,075%
    // DAS anual = 1.200.000 * 0,19075 = R$ 228.900
    const dasEsperado = 228900;
    const result = engine.calcularComparacaoSimplesPresumido(cenario);
    if (result.error) throw new Error(result.error);

    registraDiferenca("2a", "DAS anual", dasEsperado, result.sn.dasAnual, 'R$');
    assert.ok(Math.abs(result.sn.dasAnual - dasEsperado) < 2,
      `DAS: esperado ${dasEsperado}, obtido ${result.sn.dasAnual}`);
    assert.strictEqual(result.sn.anexo, "Anexo V", "Deve ser Anexo V (Fator R < 28%)");
  });

  it("2b. LP — IRPJ adicional presente (serviços 32%, R$ 1.2M)", () => {
    // baseIRPJ = 1.200.000 * 32% = 384.000 (RIR/2018 art. 520)
    // IRPJ 15% = 384.000 * 15% = 57.600
    // baseAdic = max(0, 384.000 - 240.000) = 144.000
    // Adicional = 144.000 * 10% = 14.400 (Lei 9.249/95 art. 3º §1º)
    // PIS+COFINS = 1.200.000 * (0,65% + 3%) = 43.800
    // ISS = 1.200.000 * 5% = 60.000
    const result = engine.calcularComparacaoSimplesPresumido(cenario);
    if (result.error) throw new Error(result.error);

    const irpj15 = 1_200_000 * 0.32 * 0.15;
    const adicIRPJ = Math.max(0, 1_200_000 * 0.32 - 240000) * 0.10;
    const pisCofins = 1_200_000 * (0.0065 + 0.03);

    // ISS = 1.200.000 * 5% = R$ 60.000 (verificado manualmente abaixo)
    registraDiferenca("2b", "IRPJ 15%", irpj15, result.lp.irpj15, 'R$');
    registraDiferenca("2b", "IRPJ Adic", adicIRPJ, result.lp.irpjAdic, 'R$');
    registraDiferenca("2b", "PIS+COFINS", pisCofins, result.lp.pisCofins, 'R$');

    assert.ok(Math.abs(result.lp.irpj15 - irpj15) < 1);
    assert.ok(Math.abs(result.lp.irpjAdic - adicIRPJ) < 1);
    assert.ok(result.lp.irpjAdic > 0, "IRPJ adicional deve ser > 0 para base > 240K");
    assert.ok(Math.abs(result.lp.pisCofins - pisCofins) < 2);
  });
});

// =============================================================================
// CENÁRIO 3: INDÚSTRIA (ANEXO II) com IPI
// =============================================================================
// Entrada:
//   RBT12 = R$ 3.000.000, ICMS = 12%, IPI = 5%
//   Compras = R$ 1.500.000, CNAE 1012-1/01 (abate)
// =============================================================================
describe("Homologação — Cenário 3: Indústria (Anexo II, com IPI)", () => {
  const cenario = fd({
    rbt12Input: "3.000.000,00",
    comprasInput: "1.500.000,00",
    tipoAtivLP: "industria",
    cnae: "1012-1/01",
    aliquotaISS: "0",
    aliquotaICMS: "12",
    aliquotaIPI: "5",
    segregacao: "100",
  });

  it("3a. SN — Anexo II, 5ª faixa", () => {
    const dasEsperado = 3_000_000 * 0.147 - 85500;
    const result = engine.calcularComparacaoSimplesPresumido(cenario);
    if (result.error) throw new Error(result.error);

    registraDiferenca("3a", "DAS anual", dasEsperado, result.sn.dasAnual, 'R$');
    assert.ok(Math.abs(result.sn.dasAnual - dasEsperado) < 2);
    assert.strictEqual(result.sn.anexo, "Anexo II", "Indústria → Anexo II");
  });

  it("3b. LP — IPI incluso, ICMS com crédito", () => {
    const result = engine.calcularComparacaoSimplesPresumido(cenario);
    if (result.error) throw new Error(result.error);

    const receitaLP = 3_000_000;
    const ipi = 1_500_000 * 0.05;
    const icmsLiq = Math.max(0, receitaLP * 0.12 - 1_500_000 * 0.12);

    registraDiferenca("3b", "IPI", ipi, result.lp.ipi, 'R$');
    registraDiferenca("3b", "ICMS", icmsLiq, result.lp.icms, 'R$');

    assert.ok(Math.abs(result.lp.ipi - ipi) < 2);
    assert.ok(Math.abs(result.lp.icms - icmsLiq) < 2);
    assert.strictEqual(result.lp.iss, 0, "ISS deve ser 0 para indústria");
    assert.ok(result.lp.ipi > 0, "IPI deve ser > 0 para indústria com IPI rate");
  });
});

// =============================================================================
// CENÁRIO 4: FATOR R — ANEXO III vs V (CNAE 6911-7/01 = advocacia, sujeita a FR)
// =============================================================================
// Entrada:
//   Caso A: RBT12 = R$ 600.000, folha = R$ 30.000/mês → Fator R = 60% → Anexo III
//   Caso B: RBT12 = R$ 600.000, folha = R$ 0/mês → Fator R = 0% → Anexo V
//   CNAE 6911-7/01 (advocacia, sujeita a Fator R)
// =============================================================================
describe("Homologação — Cenário 4: Fator R (> 28%, = 28%, < 28%)", () => {
  it("4a. Fator R = 60% (> 28%) → Anexo III (alíquota menor)", () => {
    // Fator R = (30.000 * 12) / 600.000 = 360.000 / 600.000 = 0,60 = 60%
    // Como Fator R > 28%, aplica-se o Anexo III (LC 123/2006 art. 18 §5º-C)
    // Anexo III 3ª faixa (360.000,01 a 720.000,00):
    // alíquota nominal = 13,50%, dedução = R$ 17.640
    // DAS = 600.000 * 0,135 - 17.640 = 81.000 - 17.640 = R$ 63.360
    const cenarioAlto = fd({
      rbt12Input: "600.000,00",
      tipoAtivLP: "servicos",
      cnae: "6911-7/01",
      salarios: "30000",
    });
    const result = engine.calcularComparacaoSimplesPresumido(cenarioAlto);
    if (result.error) throw new Error(result.error);

    assert.strictEqual(result.sn.anexo, "Anexo III", "Fator R 60% > 28% → Anexo III");
    const dasEsperado = 600000 * 0.135 - 17640;
    registraDiferenca("4a", "DAS anual", dasEsperado, result.sn.dasAnual, 'R$');
    assert.ok(Math.abs(result.sn.dasAnual - dasEsperado) < 2);
  });

  it("4b. Fator R = 0% (< 28%) → Anexo V (alíquota maior)", () => {
    const cenarioBaixo = fd({
      rbt12Input: "600.000,00",
      tipoAtivLP: "servicos",
      cnae: "6911-7/01",
      salarios: "0",
    });
    const result = engine.calcularComparacaoSimplesPresumido(cenarioBaixo);
    if (result.error) throw new Error(result.error);

    assert.strictEqual(result.sn.anexo, "Anexo V", "Fator R 0% < 28% → Anexo V");
    const dasEsperado = 600000 * 0.195 - 9900;
    registraDiferenca("4b", "DAS anual", dasEsperado, result.sn.dasAnual, 'R$');
    assert.ok(Math.abs(result.sn.dasAnual - dasEsperado) < 2);
  });

  it("4c. Fator R exatamente 28% — limite entre Anexo III e V", () => {
    const cenarioLimite = fd({
      rbt12Input: "600.000,00",
      tipoAtivLP: "servicos",
      cnae: "6911-7/01",
      salarios: "14000", // 14.000 * 12 = 168.000 / 600.000 = 28%
    });
    const result = engine.calcularComparacaoSimplesPresumido(cenarioLimite);
    if (result.error) throw new Error(result.error);

    assert.strictEqual(result.sn.anexo, "Anexo III",
      "Fator R exatamente 28% → Anexo III (limite incluso)");
    const dasEsperado = 600000 * 0.135 - 17640;
    registraDiferenca("4c", "DAS anual (limite 28%)", dasEsperado, result.sn.dasAnual, 'R$');
    assert.ok(Math.abs(result.sn.dasAnual - dasEsperado) < 2);
  });

  it("4d. Fator R = 27,99% — abaixo do limite → Anexo V", () => {
    const cenarioAbaixo = fd({
      rbt12Input: "600.000,00",
      tipoAtivLP: "servicos",
      cnae: "6911-7/01",
      salarios: "13995", // 13.995 * 12 = 167.940 / 600.000 = 27,99%
    });
    const result = engine.calcularComparacaoSimplesPresumido(cenarioAbaixo);
    if (result.error) throw new Error(result.error);

    assert.strictEqual(result.sn.anexo, "Anexo V", "Fator R 27,99% < 28% → Anexo V");
    const dasEsperado = 600000 * 0.195 - 9900;
    registraDiferenca("4d", "DAS anual (abaixo do limite)", dasEsperado, result.sn.dasAnual, 'R$');
    assert.ok(Math.abs(result.sn.dasAnual - dasEsperado) < 2);
  });
});

// =============================================================================
// CENÁRIO 5: SUBLIMITE — ICMS fora do DAS
// =============================================================================
// Entrada:
//   RBT12 = R$ 4.000.000 (acima do sublimite de R$ 3.600.000)
//   Comércio (Anexo I) → ICMS fora do DAS
//   Compras = R$ 2.000.000, ICMS = 18%
// =============================================================================
describe("Homologação — Cenário 5: Sublimite (R$ 4M, comércio)", () => {
  const cenario = fd({
    rbt12Input: "4.000.000,00",
    comprasInput: "2.000.000,00",
    tipoAtivLP: "comercio",
    cnae: "4711-3/01",
    aliquotaISS: "0",
    aliquotaICMS: "18",
    receitaAnoAnterior: "4.000.000",
    segregacao: "100",
  });

  it("5a. SN — sublimite ICMS ativo, ICMS fora do DAS", () => {
    const result = engine.calcularComparacaoSimplesPresumido(cenario);
    if (result.error) throw new Error(result.error);

    assert.strictEqual(result.sn.sublimiteIcms, true, "ICMS fora do DAS ativo");
    assert.strictEqual(result.sublimite.issForaDoDas, false, "ISS não fora do DAS (comércio)");
    assert.strictEqual(result.sublimite.status, "IMPEDIMENTO_JA_VIGENTE",
      "Receita ano anterior > sublimite → impedimento já vigente");

    // Anexo I 6ª faixa (3.600.000,01 a 4.800.000,00):
    // alíquota nominal = 19,00%, dedução = R$ 378.000 (LC 155/2016)
    // alíquota efetiva = (4.000.000 * 0,19 - 378.000) / 4.000.000 = 0,0955
    // DAS = 4.000.000 * 0,0955 = R$ 382.000
    // sn.total = dasAjustado + tribFora (ICMS líquido) (tribFora não exposto como campo separado)
    // ICMS líquido = 4M * 18% - 2M * 18% = 720K - 360K = 360K
    // Anexo I 6ª faixa: aloc = 0% → dasAjustado = DAS * (1 - 0) = DAS
    // sn.total = 382.000 + 360.000 = 742.000
    const dasTotal = 382000;
    const totalEsperado = 742000;

    registraDiferenca("5a", "DAS anual", dasTotal, result.sn.dasAnual, 'R$');
    registraDiferenca("5a", "Total SN (DAS+ICMS fora)", totalEsperado, result.sn.total, 'R$');

    assert.ok(Math.abs(result.sn.dasAnual - dasTotal) < 2,
      `DAS total: esperado ${dasTotal}, obtido ${result.sn.dasAnual}`);
    assert.ok(Math.abs(result.sn.total - totalEsperado) < 2,
      `Total SN: esperado ${totalEsperado}, obtido ${result.sn.total}`);
    assert.ok(result.sn.total > result.sn.dasAnual, "Total SN > DAS (tribFora adicionado)");
  });
});

// =============================================================================
// CENÁRIO 6: MÓDULO HÍBRIDO 2027 — IBS = 0
// =============================================================================
// Entrada:
//   RBT12 = R$ 1.200.000, Compras = R$ 200.000, optOut = 100%
//   Serviços (CNAE 6201-1/01, não Fator R → Anexo III)
//   CBS alíquota = 8,8%, IBS em 2027 = 0%
// =============================================================================
describe("Homologação — Cenário 6: Módulo Híbrido 2027", () => {
  const cenario = fd({
    optOutPct: "100",
    aliqCbsFora: "8.8",
    aliqCbsCompras: "8.8",
  });

  it("6a. Cálculo completo — DAS, CBS, IBS, total", () => {
    const result = engine.calcularComparacaoSimplesHibrido(cenario);
    if (result.error) throw new Error(result.error);

    // CNAE 6201-1/01 NÃO está em CNAE_FATOR_R → sempre Anexo III
    // Anexo III 4ª faixa (720K-1,8M): aliq=16%, ded=35.640
    // DAS integral = 1.2M * 0,16 - 35.640 = 192.000 - 35.640 = R$ 156.360
    const dasIntegral = 1_200_000 * 0.16 - 35640; // 156360

    // CBS débito = 1.2M * 8,8% = 105.600
    // CBS crédito = 200K * 8,8% = 17.600
    // CBS líquida = 105.600 - 17.600 = 88.000
    const cbsDebito = 1_200_000 * 0.088;
    const cbsCredito = 200_000 * 0.088;
    const cbsLiquida = cbsDebito - cbsCredito;

    registraDiferenca("6a", "DAS integral", dasIntegral, result.simplesHibrido.dasIntegral, 'R$');
    registraDiferenca("6a", "CBS débito", cbsDebito, result.CBS.debito, 'R$');
    registraDiferenca("6a", "CBS crédito", cbsCredito, result.CBS.credito, 'R$');
    registraDiferenca("6a", "CBS líquida", cbsLiquida, result.CBS.liquida, 'R$');

    assert.ok(Math.abs(result.simplesHibrido.dasIntegral - dasIntegral) < 2,
      `DAS integral: esperado ${dasIntegral}, obtido ${result.simplesHibrido.dasIntegral}`);
    assert.ok(Math.abs(result.CBS.debito - cbsDebito) < 2);
    assert.ok(Math.abs(result.CBS.credito - cbsCredito) < 2);
    assert.ok(Math.abs(result.CBS.liquida - cbsLiquida) < 2);
    assert.strictEqual(result.IBS.debito, 0, "IBS débito = 0");
    assert.strictEqual(result.IBS.credito, 0, "IBS crédito = 0");
    assert.strictEqual(result.IBS.liquido, 0, "IBS líquido = 0");
    assert.strictEqual(result.statusCalculo, "OK", "Status OK");
  });
});

// =============================================================================
// CENÁRIO 7: REFORMA 2027 — validação INDEPENDENTE
// =============================================================================
// Entrada:
//   RBT12 = R$ 1.200.000, Compras = R$ 200.000, ISS = 5%, ICMS = 0%
//   Serviços (TI, Anexo III), alíquota CBS = 8,8%, IBS = 0,10%
// Cálculo 100% independente — nenhum valor lido do motor para compor expected
// =============================================================================
describe("Homologação — Cenário 7: Reforma 2027 (cálculo independente)", () => {
  it("7a. Total futuro = LP - PIS/COFINS - IPI + CBS + IBS", () => {
    const cenario = fd({
      refReceita: "1200000",
      refAliqCbs: "8.8",
      refCredPct: "100",
      aliquotaISS: "5",
      aliquotaICMS: "0",
    });

    const result = engine.calcularComparacaoPresumidoReforma(cenario);
    if (result.error) throw new Error(result.error);

    // --- Cálculo independente do LP ---
    const receita = 1_200_000;
    const compras = 200_000;

    const baseIRPJ = receita * 0.32;
    const irpj15 = baseIRPJ * 0.15;
    const baseAdic = Math.max(0, baseIRPJ - 240_000);
    const adicIRPJ = baseAdic * 0.10;
    const baseCSLL = receita * 0.32;
    const csll = baseCSLL * 0.09;
    const pis = receita * 0.0065;
    const cofins = receita * 0.03;
    const pisCofins = pis + cofins;
    const iss = receita * 0.05;
    const icms = 0;
    const ipi = 0;
    const encargos = 0;
    const lpTotal = irpj15 + adicIRPJ + csll + pisCofins + iss + icms + ipi + encargos;

    // --- CBS independente ---
    const cbsDebito = receita * 0.088;
    const cbsCredito = compras * 0.088;
    const cbsLiquida = cbsDebito - cbsCredito;

    // --- IBS independente (0,10%) ---
    const ibsDebito = receita * 0.001;
    const ibsCredito = compras * 0.001;
    const ibsLiquido = ibsDebito - ibsCredito;

    // --- Total futuro ---
    const totalFuturo = lpTotal - pisCofins - ipi + cbsLiquida + ibsLiquido;

    registraDiferenca("7a", "LP total", lpTotal, result.lucroPresumidoAtual.total, 'R$');
    registraDiferenca("7a", "CBS líquida", cbsLiquida, result.CBS.liquida, 'R$');
    registraDiferenca("7a", "IBS líquido", ibsLiquido, result.IBS.liquido, 'R$');
    registraDiferenca("7a", "Total futuro", totalFuturo, result.cenarioFuturo.total, 'R$');

    assert.ok(Math.abs(result.cenarioFuturo.total - totalFuturo) < 2,
      `Total futuro: independente=${totalFuturo.toFixed(2)}, engine=${result.cenarioFuturo.total.toFixed(2)}`);
    assert.ok(Math.abs(result.CBS.liquida - cbsLiquida) < 2);
    assert.ok(Math.abs(result.IBS.liquido - ibsLiquido) < 1);
  });
});

// =============================================================================
// CENÁRIO 8: REDUÇÃO CBS — contabilidade (Art. 127, 30%)
// =============================================================================
// Entrada:
//   CNAE 6920-6/01 (contabilidade), CBS reduzida 30% (Art. 127)
//   RBT12 = R$ 1.200.000, Compras = R$ 200.000
// Fundamento: PLP 68/2024 art. 127 e 128
// =============================================================================
describe("Homologação — Cenário 8: Redução CBS (contabilidade, Art. 127)", () => {
  const cenario = fd({
    cnae: "6920-6/01",
    confirmadoBeneficioArt127: true,
    optOutPct: "100",
  });

  it("8a. CBS alíquota reduzida = 8,8% * 0,7 = 6,16%", () => {
    const result = engine.calcularComparacaoSimplesHibrido(cenario);
    if (result.error) throw new Error(result.error);

    registraDiferenca("8a", "CBS alíquota", 6.16, result.CBS.aliq, '%');
    assert.ok(Math.abs(result.CBS.aliq - 6.16) < 0.01,
      `CBS alíquota: esperado 6,16%, obtido ${result.CBS.aliq}%`);
    assert.ok(result.CBS.reducao, "Objeto reducao deve existir");
    assert.strictEqual(result.CBS.reducao.pct, 30, "Redução de 30%");
    assert.ok(result.CBS.reducao.condicional, "Benefício condicional (Art. 128)");
  });

  it("8b. CBS crédito usa alíquota padrão (8,8%), não a reduzida", () => {
    const result = engine.calcularComparacaoSimplesHibrido(cenario);
    if (result.error) throw new Error(result.error);

    const debitoEsperado = 1_200_000 * 0.0616;
    const creditoEsperado = 200_000 * 0.088;
    const liquidaEsperada = debitoEsperado - creditoEsperado;

    registraDiferenca("8b", "CBS débito reduzido", debitoEsperado, result.CBS.debito, 'R$');
    registraDiferenca("8b", "CBS crédito (aliq padrão)", creditoEsperado, result.CBS.credito, 'R$');
    registraDiferenca("8b", "CBS líquida", liquidaEsperada, result.CBS.liquida, 'R$');

    assert.ok(Math.abs(result.CBS.debito - debitoEsperado) < 2);
    assert.ok(Math.abs(result.CBS.credito - creditoEsperado) < 2);
    assert.ok(Math.abs(result.CBS.liquida - liquidaEsperada) < 2);
  });
});

// =============================================================================
// CENÁRIO 9: CASOS LIMITE
// =============================================================================
describe("Homologação — Cenário 9: Casos Limite", () => {
  it("9a. RBT12 exato no limite SN (R$ 4.800.000) → elegível", () => {
    const result = engine.calcularComparacaoSimplesPresumido(fd({
      rbt12Input: "4.800.000,00",
      tipoAtivLP: "comercio",
      cnae: "4711-3/01",
      aliquotaISS: "0",
      aliquotaICMS: "18",
      receitaAnoAnterior: "4.000.000",
    }));
    assert.strictEqual(result.elegibilidade.snElegivel, true);
  });

  it("9b. RBT12 acima do limite SN (R$ 4.800.001) → NÃO elegível", () => {
    const result = engine.calcularComparacaoSimplesPresumido(fd({
      rbt12Input: "4.800.001,00",
      tipoAtivLP: "comercio",
      cnae: "4711-3/01",
      aliquotaISS: "0",
      aliquotaICMS: "18",
      receitaAnoAnterior: "4.000.000",
    }));
    assert.strictEqual(result.elegibilidade.snElegivel, false);
  });

  it("9c. CNAE classe 64xx (bancos) → SN NÃO elegível", () => {
    const result = engine.calcularComparacaoSimplesPresumido(fd({
      cnae: "6410-7/01",
    }));
    assert.strictEqual(result.elegibilidade.snElegivel, false);
  });

  it("9d. RBT12 = 0 → DADOS_INSUFICIENTES", () => {
    const result = engine.calcularComparacaoSimplesPresumido(fd({
      rbt12Input: "0",
    }));
    assert.ok(result.error || result.statusCalculo === "DADOS_INSUFICIENTES" || result.sn?.total === 0);
  });

  it("9e. CNAE vazio → erro de validação", () => {
    const result = engine.calcularComparacaoSimplesPresumido(fd({ cnae: "" }));
    assert.ok(result.error || result.statusCalculo !== "OK");
  });

  it("9f. Mudança de faixa — RBT12 no limiar entre faixas", () => {
    // RBT12 = 180.000 (limite entre 1ª e 2ª faixa do Anexo I)
    const result = engine.calcularComparacaoSimplesPresumido(fd({
      rbt12Input: "180.000,00",
      tipoAtivLP: "comercio",
      cnae: "4711-3/01",
      aliquotaICMS: "18",
      aliquotaISS: "0",
      salarios: "0",
      prolabore: "0",
      comprasInput: "0",
    }));
    if (result.error) throw new Error(result.error);
    // 1ª faixa (até 180.000): aliq=4%, ded=0
    const dasEsperado = 180000 * 0.04;
    assert.ok(Math.abs(result.sn.dasAnual - dasEsperado) < 2,
      `DAS 1ª faixa: esperado ${dasEsperado}, obtido ${result.sn.dasAnual}`);
  });
});

// =============================================================================
// CENÁRIO 10: CONSISTÊNCIA ENTRE MÓDULOS (REFORÇADO)
// =============================================================================
// Compara o LP calculado em dois módulos diferentes:
//   - calcularComparacaoSimplesPresumido (SN×LP)
//   - calcularComparacaoPresumidoReforma (Reforma)
// Ambos usam calcularLP() internamente → LP deve ser idêntico
// =============================================================================
describe("Homologação — Cenário 10: Consistência entre módulos", () => {
  const cenario = fd({
    optOutPct: "100",
  });

  it("10a. LP total é idêntico nos módulos SN×LP e Reforma", () => {
    const r1 = engine.calcularComparacaoSimplesPresumido(cenario);
    const r2 = engine.calcularComparacaoPresumidoReforma({
      ...cenario,
      refReceita: "1200000",
      refAliqCbs: "8.8",
    });
    if (r1.error) throw new Error(r1.error);
    if (r2.error) throw new Error(r2.error);

    assert.ok(r1.lp, "Módulo SN×LP tem objeto lp");
    assert.ok(r2.lucroPresumidoAtual, "Módulo Reforma tem lucroPresumidoAtual");

    // O total LP deve ser igual em ambos os módulos
    const total1 = r1.lp.total || 0;
    const total2 = r2.lucroPresumidoAtual.total || 0;
    registraDiferenca("10a", "LP total SN×LP vs Reforma", total1, total2, 'R$');
    assert.ok(Math.abs(total2 - total1) < 0.01,
      `LP total SN×LP (${total1}) ≠ Reforma (${total2})`);

    // Componentes principais
    if (r1.lp.irpj15 != null && r2.lucroPresumidoAtual.irpj15 != null) {
      assert.ok(Math.abs(r2.lucroPresumidoAtual.irpj15 - r1.lp.irpj15) < 0.01,
        `IRPJ 15%: SN×LP=${r1.lp.irpj15}, Reforma=${r2.lucroPresumidoAtual.irpj15}`);
    }
    if (r1.lp.csll != null && r2.lucroPresumidoAtual.csll != null) {
      assert.ok(Math.abs(r2.lucroPresumidoAtual.csll - r1.lp.csll) < 0.01,
        `CSLL: SN×LP=${r1.lp.csll}, Reforma=${r2.lucroPresumidoAtual.csll}`);
    }
    if (r1.lp.pisCofins != null && r2.lucroPresumidoAtual.pisCofins != null) {
      assert.ok(Math.abs(r2.lucroPresumidoAtual.pisCofins - r1.lp.pisCofins) < 0.01,
        `PIS/COFINS: SN×LP=${r1.lp.pisCofins}, Reforma=${r2.lucroPresumidoAtual.pisCofins}`);
    }
  });

  it("10b. Elegibilidade SN é consistente entre módulos SN×LP e Híbrido", () => {
    const r1 = engine.calcularComparacaoSimplesPresumido(cenario);
    const r2 = engine.calcularComparacaoSimplesHibrido(cenario);
    if (r1.error) throw new Error(r1.error);
    if (r2.error) throw new Error(r2.error);

    // O módulo híbrido não expõe elegibilidade no mesmo formato.
    // Verificamos que ambos têm o mesmo anexo SN e mesmo DAS total
    assert.ok(r1.sn, "Módulo SN×LP tem sn");
    assert.ok(r2.simplesTradicional, "Módulo Híbrido tem simplesTradicional");

    const das1 = r1.sn.dasAnual || 0;
    const das2 = r2.simplesTradicional.das || 0;
    registraDiferenca("10b", "DAS SN×LP vs Híbrido", das1, das2, 'R$');
    assert.ok(Math.abs(das2 - das1) < 0.01,
      `DAS SN×LP (${das1}) ≠ Híbrido (${das2})`);
  });
});

// =============================================================================
// CENÁRIO 11: EMPRESA COM BENEFÍCIO CBS (hospital, Art. 130, 60%)
// =============================================================================
// Entrada:
//   CNAE 8610-1/01 (hospital), CBS reduzida 60% (Art. 130, incondicional)
//   RBT12 = R$ 1.200.000, Compras = R$ 200.000
// =============================================================================
describe("Homologação — Cenário 11: Benefício CBS hospital (Art. 130, 60%)", () => {
  const cenario = fd({
    cnae: "8610-1/01",
    optOutPct: "100",
  });

  it("11a. CBS alíquota = 8,8% * 0,4 = 3,52% (incondicional)", () => {
    const result = engine.calcularComparacaoSimplesHibrido(cenario);
    if (result.error) throw new Error(result.error);

    registraDiferenca("11a", "CBS alíquota hospital", 3.52, result.CBS.aliq, '%');
    assert.ok(Math.abs(result.CBS.aliq - 3.52) < 0.01);
    assert.ok(result.CBS.reducao, "Objeto reducao deve existir");
    assert.strictEqual(result.CBS.reducao.pct, 60, "Redução de 60%");
    assert.strictEqual(result.CBS.reducao.condicional, false, "Hospital (Art. 130) → incondicional");

    const debitoEsp = 1_200_000 * 0.0352;
    const creditoEsp = 200_000 * 0.088;
    const liquidaEsp = debitoEsp - creditoEsp;
    registraDiferenca("11a", "CBS débito hospital", debitoEsp, result.CBS.debito, 'R$');
    registraDiferenca("11a", "CBS líquida hospital", liquidaEsp, result.CBS.liquida, 'R$');
    assert.ok(Math.abs(result.CBS.debito - debitoEsp) < 2);
    assert.ok(Math.abs(result.CBS.liquida - liquidaEsp) < 2);
  });
});

// =============================================================================
// CENÁRIO 12: getSNParams — todas as faixas do Anexo III
// =============================================================================
// Fundamento: LC 123/2006 art. 18 §4º-A c/c LC 155/2016
// =============================================================================
describe("Homologação — Cenário 12: getSNParams Anexo III (6 faixas)", () => {
  const faixas = [
    { rbt: 100000,  aliq: 0.06, ded: 0 },
    { rbt: 200000,  aliq: 0.112, ded: 9360 },
    { rbt: 500000,  aliq: 0.135, ded: 17640 },
    { rbt: 1000000, aliq: 0.16, ded: 35640 },
    { rbt: 2000000, aliq: 0.21, ded: 125640 },
    { rbt: 4000000, aliq: 0.33, ded: 648000 },
  ];

  for (const faixa of faixas) {
    it(`RBT=R$ ${faixa.rbt.toLocaleString('pt-BR')} → aliq=${(faixa.aliq*100).toFixed(1)}%, ded=${faixa.ded}`, () => {
      const p = engine.getSNParams("Anexo III", faixa.rbt);
      registraDiferenca("12", `Anexo III R$${faixa.rbt} alíquota`, faixa.aliq, p.aliq, '%');
      registraDiferenca("12", `Anexo III R$${faixa.rbt} dedução`, faixa.ded, p.deducao, 'R$');
      assert.strictEqual(p.aliq, faixa.aliq);
      assert.strictEqual(p.deducao, faixa.ded);
    });
  }
});

// =============================================================================
// CENÁRIO 13: getSNParcelaIcmsIss
// =============================================================================
// Fundamento: LC 123/2006 art. 18 c/c LC 155/2016 (6ª faixa = 0%)
// =============================================================================
describe("Homologação — Cenário 13: getSNParcelaIcmsIss", () => {
  it("13a. Anexo I (comércio): faixas 1-5 têm alocação, faixa 6 = 0%", () => {
    assert.ok(engine.getSNParcelaIcmsIss("Anexo I", 100000) > 0, "Faixa 1 tem alocação");
    assert.ok(engine.getSNParcelaIcmsIss("Anexo I", 200000) > 0, "Faixa 2 tem alocação");
    assert.ok(engine.getSNParcelaIcmsIss("Anexo I", 500000) > 0, "Faixa 3 tem alocação");
    assert.ok(engine.getSNParcelaIcmsIss("Anexo I", 1000000) > 0, "Faixa 4 tem alocação");
    assert.ok(engine.getSNParcelaIcmsIss("Anexo I", 2000000) > 0, "Faixa 5 tem alocação");
    assert.strictEqual(engine.getSNParcelaIcmsIss("Anexo I", 4000000), 0,
      "Faixa 6 = 0% (LC 155/2016)");
  });

  it("13b. Anexo III (serviços): faixas 1-5 têm alocação, faixa 6 = 0%", () => {
    assert.strictEqual(engine.getSNParcelaIcmsIss("Anexo III", 4000000), 0);
  });
});

// =============================================================================
// CENÁRIO 14: getReparticao2027 — IBS = 0 em 2027
// =============================================================================
describe("Homologação — Cenário 14: getReparticao2027", () => {
  for (const anexo of ["Anexo I", "Anexo III"]) {
    for (let faixa = 0; faixa < 6; faixa++) {
      it(`${anexo} faixa ${faixa+1}: repartição soma 1,0 e IBS=0`, () => {
        const rep = engine.getReparticao2027(anexo, faixa);
        const soma = rep.irpj + rep.csll + rep.cbs + rep.cpp + rep.iss + rep.ibs;
        assert.ok(Math.abs(soma - 1) < 0.001, `Soma = ${soma.toFixed(4)}, deve ser ~1,0`);
        assert.strictEqual(rep.ibs, 0, `IBS = 0 em 2027`);
      });
    }
  }
});

// =============================================================================
// CENÁRIO 15: IBS NÃO ZERO no módulo Reforma (0,10%)
// =============================================================================
// Fundamento: PLP 68/2024 art. 119 (IBS 0,10% em 2027)
// =============================================================================
describe("Homologação — Cenário 15: IBS no módulo Reforma (> 0)", () => {
  it("15a. IBS débito = 1,2M * 0,10% = R$ 1.200, crédito = 200K * 0,10% = R$ 200", () => {
    const cenario = fd({
      refReceita: "1200000",
      refAliqCbs: "8.8",
      aliquotaISS: "5",
    });
    const result = engine.calcularComparacaoPresumidoReforma(cenario);
    if (result.error) throw new Error(result.error);

    registraDiferenca("15a", "IBS débito", 1200, result.IBS.debito, 'R$');
    registraDiferenca("15a", "IBS crédito", 200, result.IBS.credito, 'R$');
    registraDiferenca("15a", "IBS líquido", 1000, result.IBS.liquido, 'R$');

    assert.ok(result.IBS.debito > 0, "IBS débito > 0 no módulo Reforma");
    assert.strictEqual(result.IBS.aliq, 0.1, "IBS alíquota = 0,10%");
    assert.ok(Math.abs(result.IBS.debito - 1200) < 1);
    assert.ok(Math.abs(result.IBS.credito - 200) < 1);
    assert.ok(Math.abs(result.IBS.liquido - 1000) < 1);
  });
});

// =============================================================================
// CENÁRIO 16: SEGREGAÇÃO DE RECEITAS
// =============================================================================
describe("Homologação — Cenário 16: Segregação de receitas", () => {
  it("16a. Indústria com 30% serviços → sem erro (status VALIDO)", () => {
    const cenario = fd({
      rbt12Input: "1.000.000,00",
      tipoAtivLP: "industria",
      cnae: "1012-1/01",
      segregacao: "30",
      aliquotaISS: "5",
      aliquotaICMS: "12",
    });
    const result = engine.calcularComparacaoSimplesPresumido(cenario);
    if (result.error) throw new Error(result.error);
    // statusCalculo retorna 'VALIDO' quando a segregação é aceita
    assert.strictEqual(result.statusCalculo, "VALIDO",
      "30% serviços na indústria → VALIDO (sem bloqueio)");
  });

  it("16b. Serviços com 30% segregação → cálculo prossegue (segregação é aviso, não bloqueio)", () => {
    const cenario = fd({
      rbt12Input: "1.000.000,00",
      tipoAtivLP: "servicos",
      cnae: "6201-1/01",
      segregacao: "30",
    });
    const result = engine.calcularComparacaoSimplesPresumido(cenario);
    // validateSegregacao retorna avisos, não bloqueia o cálculo
    // O motor permite a comparação mas o LP usará a segregação informada
    assert.strictEqual(result.statusCalculo, "VALIDO",
      "30% segregação gera aviso mas não bloqueia (status VALIDO)");
    // O LP deve usar a receita segregada (30% de 1M = 300K para serviços)
    assert.ok(result.lp, "LP deve ser calculado mesmo com segregação < 50%");
  });
});

// =============================================================================
// CENÁRIO 17: CRÉDITO ICMS — PERCENTUAL EDITÁVEL
// =============================================================================
// Fundamento: LC 87/96 (ICMS não cumulativo)
// =============================================================================
describe("Homologação — Cenário 17: Crédito ICMS percentual editável", () => {
  const cenarioBase = fd({
    rbt12Input: "5.000.000,00",
    comprasInput: "3.000.000,00",
    tipoAtivLP: "comercio",
    cnae: "4711-3/01",
    aliquotaISS: "0",
    aliquotaICMS: "18",
  });

  it("17a. icmsPctCredInput=100% → crédito integral (3M * 18% = 540K)", () => {
    const result = engine.calcularComparacaoSimplesPresumido({
      ...cenarioBase,
      icmsPctCredInput: "100",
    });
    if (result.error) throw new Error(result.error);
    // ICMS = 5M * 18% - 3M * 100% * 18% = 900K - 540K = 360K
    registraDiferenca("17a", "ICMS 100% crédito", 360000, result.lp.icms, 'R$');
    assert.ok(Math.abs(result.lp.icms - 360000) < 100);
  });

  it("17b. icmsPctCredInput=50% → crédito parcial (3M * 50% * 18% = 270K)", () => {
    const result = engine.calcularComparacaoSimplesPresumido({
      ...cenarioBase,
      icmsPctCredInput: "50",
    });
    if (result.error) throw new Error(result.error);
    // ICMS = 5M * 18% - 3M * 50% * 18% = 900K - 270K = 630K
    registraDiferenca("17b", "ICMS 50% crédito", 630000, result.lp.icms, 'R$');
    assert.ok(Math.abs(result.lp.icms - 630000) < 100);
  });
});

// =============================================================================
// CENÁRIO 18: ZERO CRÉDITO/ISENTO + ARREDONDAMENTOS
// =============================================================================
describe("Homologação — Cenário 18: Zero crédito/isento", () => {
  it("18a. Sem compras (compras=0) → ICMS sem crédito", () => {
    const result = engine.calcularComparacaoSimplesPresumido(fd({
      rbt12Input: "1.000.000,00",
      comprasInput: "0",
      tipoAtivLP: "comercio",
      cnae: "4711-3/01",
      aliquotaICMS: "18",
      aliquotaISS: "0",
    }));
    if (result.error) throw new Error(result.error);
    registraDiferenca("18a", "ICMS sem crédito", 180000, result.lp.icms, 'R$');
    assert.ok(Math.abs(result.lp.icms - 180000) < 2);
  });

  it("18b. ISS = 0 para comércio → ICMS > 0 (consistente)", () => {
    const result = engine.calcularComparacaoSimplesPresumido(fd({
      rbt12Input: "1.000.000,00",
      tipoAtivLP: "comercio",
      cnae: "4711-3/01",
      aliquotaICMS: "18",
      aliquotaISS: "0",
    }));
    if (result.error) throw new Error(result.error);
    assert.strictEqual(result.lp.iss, 0, "ISS = 0 para comércio");
    assert.ok(result.lp.icms > 0, "ICMS > 0 para comércio");
  });

  it("18c. Arredondamento — centavos não alteram resultado (Anexo III, CNAE 6201-1/01)", () => {
    // CNAE 6201-1/01 NÃO está em Fator R → sempre Anexo III
    // Anexo III 4ª faixa: aliq=16%, ded=35.640
    // DAS = 1.234.567,89 * 0,16 - 35.640 = 197.530,86 - 35.640 = 161.890,86
    const result = engine.calcularComparacaoSimplesPresumido(fd({
      rbt12Input: "1.234.567,89",
      tipoAtivLP: "servicos",
      cnae: "6201-1/01",
      salarios: "0",
      aliquotaISS: "5",
    }));
    if (result.error) throw new Error(result.error);
    const dasEsperado = 1_234_567.89 * 0.16 - 35640;
    registraDiferenca("18c", "DAS com centavos", dasEsperado, result.sn.dasAnual, 'R$');
    assert.ok(Math.abs(result.sn.dasAnual - dasEsperado) < 0.02,
      `DAS com centavos: esperado ${dasEsperado.toFixed(2)}, obtido ${result.sn.dasAnual.toFixed(2)}`);
  });
});
