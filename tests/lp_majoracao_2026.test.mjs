import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../public/comparador.html", import.meta.url), "utf-8");
const jsMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!jsMatch) throw new Error("No script found");
const code = jsMatch[1];
const initIdx = code.indexOf("// ===== INIT =====");
const codeToEval = code.substring(0, initIdx !== -1 ? initIdx : code.length);

function mockEl(overrides = {}) {
  return { value: "", innerHTML: "", textContent: "", style: {}, classList: { add: () => {}, remove: () => {} }, disabled: false, checked: false, options: [], selectedIndex: -1, dataset: {}, ...overrides };
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
  "window", "document", "console",
  codeToEval + "; return { calcularLP, calcularComparacaoSimplesPresumido, calcularComparacaoPresumidoReforma, buildPdfHtmlFromObject };"
);

const engine = fn(mockWindow, mockDoc, console);

function lp(overrides = {}) {
  return engine.calcularLP({
    rbt12: 0,
    tipoAtiv: "comercio",
    presIRPJ: 0.08,
    presCSLL: 0.12,
    issPct: 0,
    icmsPct: 0,
    ipiPct: 0,
    segregPct: 1,
    comprasAnual: 0,
    sal: 0,
    prol: 0,
    inssP: 0,
    ratP: 0,
    tercP: 0,
    fgtsP: 0,
    anoSIM: "2027",
    ...overrides,
  });
}

function pdfFor(results, formData) {
  return new Promise((resolve) => engine.buildPdfHtmlFromObject(results, formData, resolve));
}

describe("Lucro Presumido - majoracao da base presumida 2026", () => {
  it("receita abaixo do limite nao aplica majoracao", () => {
    const result = lp({ rbt12: 4_000_000, anoSIM: "2027" });
    assert.strictEqual(result.basePresumidaIRPJDetalhe.receitaExcedente, 0);
    assert.strictEqual(result.baseIRPJ, 320_000);
    assert.strictEqual(result.irpj15, 48_000);
    assert.strictEqual(result.baseCSLL, 480_000);
    assert.strictEqual(result.csll, 43_200);
  });

  it("receita exatamente no limite nao aplica majoracao", () => {
    const result = lp({ rbt12: 5_000_000, anoSIM: "2027" });
    assert.strictEqual(result.basePresumidaIRPJDetalhe.receitaExcedente, 0);
    assert.strictEqual(result.baseIRPJ, 400_000);
    assert.strictEqual(result.irpj15, 60_000);
    assert.strictEqual(result.baseCSLL, 600_000);
    assert.strictEqual(result.csll, 54_000);
  });

  it("comercio acima do limite aplica majoracao apenas no excedente", () => {
    const result = lp({ rbt12: 6_000_000, tipoAtiv: "comercio", presIRPJ: 0.08, presCSLL: 0.12, anoSIM: "2027" });
    assert.strictEqual(result.basePresumidaIRPJDetalhe.receitaNormal, 5_000_000);
    assert.strictEqual(result.basePresumidaIRPJDetalhe.receitaExcedente, 1_000_000);
    assert.strictEqual(result.basePresumidaIRPJDetalhe.presuncaoMajorada, 0.088);
    assert.strictEqual(result.baseIRPJ, 488_000);
    assert.strictEqual(result.irpj15, 73_200);
    assert.strictEqual(result.adicionalIRPJ, 42_800);
    assert.strictEqual(result.baseCSLL, 732_000);
    assert.strictEqual(result.csll, 65_880);
  });

  it("servicos acima do limite usa presuncao majorada de 35,2% no excedente", () => {
    const result = lp({ rbt12: 6_000_000, tipoAtiv: "servicos", presIRPJ: 0.32, presCSLL: 0.32, anoSIM: "2027" });
    assert.strictEqual(result.basePresumidaIRPJDetalhe.presuncaoMajorada, 0.352);
    assert.strictEqual(result.baseIRPJ, 1_952_000);
    assert.strictEqual(result.irpj15, 292_800);
    assert.strictEqual(result.adicionalIRPJ, 189_200);
    assert.strictEqual(result.baseCSLL, 1_952_000);
    assert.strictEqual(result.csll, 175_680);
  });

  it("industria acima do limite aplica a mesma regra de faixa", () => {
    const result = lp({ rbt12: 6_000_000, tipoAtiv: "industria", presIRPJ: 0.08, presCSLL: 0.12, anoSIM: "2027" });
    assert.strictEqual(result.baseIRPJ, 488_000);
    assert.strictEqual(result.baseCSLL, 732_000);
  });

  it("CSLL em 2026 observa limite transitorio anual de 3.750.000", () => {
    const result = lp({ rbt12: 4_000_000, tipoAtiv: "servicos", presIRPJ: 0.32, presCSLL: 0.32, anoSIM: "2026" });
    assert.strictEqual(result.basePresumidaIRPJDetalhe.receitaExcedente, 0);
    assert.strictEqual(result.baseIRPJ, 1_280_000);
    assert.strictEqual(result.basePresumidaCSLLDetalhe.limite, 3_750_000);
    assert.strictEqual(result.basePresumidaCSLLDetalhe.receitaExcedente, 250_000);
    assert.strictEqual(result.baseCSLL, 1_288_000);
    assert.strictEqual(result.csll, 115_920);
  });

  it("memoria de calculo retorna faixas normal e majorada", () => {
    const result = lp({ rbt12: 6_000_000, anoSIM: "2027" });
    assert.strictEqual(result.basePresumidaIRPJDetalhe.baseNormal, 400_000);
    assert.strictEqual(result.basePresumidaIRPJDetalhe.baseMajorada, 88_000);
    assert.strictEqual(result.basePresumidaIRPJDetalhe.baseTotal, 488_000);
    assert.strictEqual(result.basePresumidaCSLLDetalhe.baseNormal, 600_000);
    assert.strictEqual(result.basePresumidaCSLLDetalhe.baseMajorada, 132_000);
    assert.strictEqual(result.basePresumidaCSLLDetalhe.baseTotal, 732_000);
  });

  it("PDF contem memoria das faixas de IRPJ e CSLL", async () => {
    const formData = { rbt12Input: "6.000.000,00", comprasInput: "0,00", tipoAtivLP: "comercio", cnae: "4711-3/00", anoSIM: "2027", segregacao: "100" };
    const result = engine.calcularComparacaoSimplesPresumido(formData);
    const pdf = await pdfFor(result, formData);
    assert.ok(pdf.includes("IRPJ - Receita excedente"));
    assert.ok(pdf.includes("IRPJ - Presuncao majorada"));
    assert.ok(pdf.includes("CSLL - Receita excedente"));
    assert.ok(pdf.includes("CSLL - Presuncao majorada"));
    assert.ok(pdf.includes("R$ 488.000,00"));
    assert.ok(pdf.includes("R$ 732.000,00"));
  });
});
