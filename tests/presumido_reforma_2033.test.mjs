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

const initIdx = code.indexOf("// ===== INIT ===");
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
    "; return { getIbsAliq2027, calcularComparacaoPresumidoReforma, calcularComparacaoPresumidoReforma2033, buildPdfHtmlFromObject };"
);

const engine = fn(mockWindow, mockDoc, console);

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
    cnae: "6201-1/01",
    refReceita: "1200000",
    refAliqCbs: "9.21",
    refPctCbs: "100",
    refPctRed: "0",
    refPctZero: "0",
    refPctRedVal: "40",
    refCredPct: "100",
    refCredMerc: "0",
    refCredServ: "0",
    refCredEnerg: "0",
    refCredAlug: "0",
    refCredAtivo: "0",
    refCredOutras: "0",
    refCredSn: "0",
    refCredManual: "0",
    optOutPct: "100",
    aliqCbsFora: "9.21",
    anoSIM: "2027",
    ...overrides,
  };
}

async function pdfHtmlFor(result, formData) {
  return new Promise(resolve => engine.buildPdfHtmlFromObject(result, formData, resolve));
}

describe("Módulo LP × Reforma 2033 — Alíquotas de referência", () => {
  it("deve usar CBS 9,21% e IBS 18,70% no régimen pleno", () => {
    const result = engine.calcularComparacaoPresumidoReforma2033(fd());
    if (result.error) throw new Error(result.error);
    assert.strictEqual(result.tipoComparacao, "PRESUMIDO_ATUAL_VS_REFORMA_2033");
    assert.strictEqual(result.anoSimulacao, "2033");
    assert.strictEqual(result.CBS.aliq, 9.21, "CBS alíquota = 9,21%");
    assert.strictEqual(result.IBS.aliq, 18.7, "IBS alíquota = 18,70%");
    assert.strictEqual(result.premissas.aliqCbsPadrao, 9.21);
    assert.strictEqual(result.premissas.aliqIbsPadrao, 18.7);
  });

  it("não depende do ano informado no formulário (força 2033)", () => {
    const result = engine.calcularComparacaoPresumidoReforma2033(fd({ anoSIM: "2026" }));
    if (result.error) throw new Error(result.error);
    assert.strictEqual(result.anoSimulacao, "2033");
  });

  it("ISS e ICMS extintos no cenário futuro (0)", () => {
    const result = engine.calcularComparacaoPresumidoReforma2033(fd());
    if (result.error) throw new Error(result.error);
    const fut = result.cenarioFuturo;
    const lp = result.lucroPresumidoAtual;
    assert.ok(lp.iss > 0, "premissa: LP atual mantém ISS");
    assert.strictEqual(fut.iss, 0, "ISS extinto em 2033");
    assert.strictEqual(fut.icms, 0, "ICMS extinto em 2033");
    assert.strictEqual(fut.pisCofins, 0, "PIS/COFINS extintos em 2033");
  });

  it("Total futuro = atual - PIS/COFINS - ISS - ICMS + CBS + IBS", () => {
    const result = engine.calcularComparacaoPresumidoReforma2033(fd());
    if (result.error) throw new Error(result.error);
    const lp = result.lucroPresumidoAtual;
    const fut = result.cenarioFuturo;
    const esperado = lp.total - lp.pisCofins - (lp.ipi || 0) - lp.iss - (lp.icms || 0) + result.CBS.liquida + result.IBS.liquido;
    assert.ok(Math.abs(fut.total - esperado) < 0.02, "Fórmula correta (ISS/ICMS deduzidos)");
    assert.strictEqual(fut.total, 403660, "Total do régime pleno = R$ 403.660,00");
    assert.ok(Math.abs(fut.aliquotaTotal - 33.6383333333) < 0.0001);
  });

  it("CBS e IBS líquidos corretos com créditos nas compras", () => {
    const result = engine.calcularComparacaoPresumidoReforma2033(fd());
    if (result.error) throw new Error(result.error);
    assert.strictEqual(Math.round(result.CBS.debito), Math.round(1200000 * 0.0921)); // 110520
    assert.strictEqual(Math.round(result.CBS.credito), Math.round(200000 * 0.0921)); // 18420
    assert.ok(Math.abs(result.CBS.liquida - 92100) < 0.01);
    assert.ok(Math.abs(result.IBS.liquido - 187000) < 0.01);
  });

  it("aumento de carga registrado na comparação", () => {
    const result = engine.calcularComparacaoPresumidoReforma2033(fd());
    if (result.error) throw new Error(result.error);
    assert.strictEqual(result.comparacao.tipo, "AUMENTO");
    assert.strictEqual(result.comparacao.valorAnual, 205300);
  });

  it("conclusão referencia a implantação definitiva da Reforma Tributária em 2033", () => {
    const result = engine.calcularComparacaoPresumidoReforma2033(fd());
    if (result.error) throw new Error(result.error);
    assert.match(result.conclusao.texto, /Reforma Tributária/);
    assert.match(result.conclusao.texto, /aumento estimado da carga tributária de R\$ 205\.300,00 por ano/);
    assert.doesNotMatch(result.conclusao.texto, /menor carga/);
    assert.doesNotMatch(result.conclusao.texto, /vencedor/);
  });

  it("statusCalculo = OK", () => {
    const result = engine.calcularComparacaoPresumidoReforma2033(fd());
    if (result.error) throw new Error(result.error);
    assert.strictEqual(result.statusCalculo, "OK");
  });
});

describe("Módulo LP × Reforma 2033 — Benefício profissional (30%)", () => {
  it("aplica redução nas alíquotas de CBS e IBS quando confirmado", () => {
    const result = engine.calcularComparacaoPresumidoReforma2033(fd({
      cnae: "6920-6/01",
      benefReqProfissionais: "sim",
      benefReqSemSocioPJ: "sim",
      benefReqNaoParticipaPJ: "sim",
      benefReqExclusiva: "sim",
      benefReqDireta: "sim",
    }));
    if (result.error) throw new Error(result.error);
    assert.strictEqual(result.premissas.beneficioProfissional.status, "APLICADO");
    assert.ok(result.CBS.aliq < 9.21, "CBS reduzida abaixo da alíquota de referência");
    assert.ok(result.IBS.aliq < 18.7, "IBS reduzido abaixo da alíquota de referência");
    assert.ok(Math.abs(result.CBS.aliq - 9.21 * 0.7) < 0.0001, "CBS ~ 6,447%");
    assert.ok(Math.abs(result.IBS.aliq - 18.7 * 0.7) < 0.0001, "IBS ~ 13,09%");
  });
});

describe("Módulo LP × Reforma 2033 — PDF", () => {
it("PDF usa rótulo da Reforma Tributária (2033) e não mostra ISS/ICMS mantidos", async () => {
    const result = engine.calcularComparacaoPresumidoReforma2033(fd());
    if (result.error) throw new Error(result.error);
    const html = await pdfHtmlFor(result, fd({ atividade: "Serviços de tecnologia" }));
    assert.match(html, /Reforma Tributária \(2033\)/);
    assert.match(html, /2033/);
    assert.match(html, /Impacto da Reforma Tributária/);
    assert.doesNotMatch(html, /ISS mantido integralmente em 2027/);
    assert.match(html, /R\$ 403\.660,00/);
  });

  it("mantém contrato usado pelo DashboardResultadosReforma", async () => {
    const result = engine.calcularComparacaoPresumidoReforma2033(fd());
    if (result.error) throw new Error(result.error);
    assert.ok(result.lucroPresumidoAtual.total > 0);
    assert.ok(result.cenarioFuturo.total > 0);
    assert.ok(result.CBS);
    assert.ok(result.IBS);
  });
});

console.log("✅ Reforma 2033 tests passed");