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
    "; return { calcularComparacaoPresumidoReforma2033, buildPdfHtmlFromObject };"
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
    refReceita: undefined,
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
    anoSIM: "2033",
    ...overrides,
  };
}

async function pdfHtmlFor(result, formData) {
  return new Promise(resolve => engine.buildPdfHtmlFromObject(result, formData, resolve));
}

const SCENARIOS = {
  base: { rbt12Input: "1.200.000,00", comprasInput: "200.000,00" },
  comprasZero: { rbt12Input: "1.200.000,00", comprasInput: "0,00" },
  comprasIgualReceita: { rbt12Input: "1.200.000,00", comprasInput: "1.200.000,00" },
  receitaBaixa: { rbt12Input: "100.000,00", comprasInput: "200.000,00" },
  receitaAlta: { rbt12Input: "50.000.000,00", comprasInput: "30.000.000,00" },
  comprasMaiorQueReceita: { rbt12Input: "500.000,00", comprasInput: "800.000,00" },
  receitaMinima: { rbt12Input: "1,00", comprasInput: "0,00" },
};

function runAll() {
  const out = {};
  for (const [name, ov] of Object.entries(SCENARIOS)) {
    const filled = fd(ov);
    const r = engine.calcularComparacaoPresumidoReforma2033(filled);
    if (r.error) throw new Error(name + ': ' + r.error);
    out[name] = { r, filled };
  }
  return out;
}

describe("Auditoria Funcional 2033 — Item 1: mesmo regime, sem vencedor/menor carga", () => {
  it("conclusão do motor não cita 'menor carga'/'vencedor'", () => {
    const out = runAll();
    for (const [n, { r }] of Object.entries(out)) {
      assert.doesNotMatch(r.conclusao.texto, /menor carga/i, n);
      assert.doesNotMatch(r.conclusao.texto, /vencedor/i, n);
      assert.match(r.conclusao.texto, /Reforma Tributária/i, n);
    }
  });
  it("PDF executivo não contém 'menor carga'/'vencedor'", async () => {
    for (const [n, { r, filled }] of Object.entries(runAll())) {
      const htmlP = await pdfHtmlFor(r, filled);
      assert.doesNotMatch(htmlP, /menor carga/i, n);
      assert.doesNotMatch(htmlP, /vencedor/i, n);
    }
  });
});

describe("Auditoria Funcional 2033 — Item 2: tributos substituídos extintos", () => {
  it("cenário futuro: PIS/COFINS, ISS, ICMS, IPI = 0", () => {
    for (const [n, { r }] of Object.entries(runAll())) {
      const fut = r.cenarioFuturo;
      assert.strictEqual(fut.pisCofins, 0, n);
      assert.strictEqual(fut.iss, 0, n);
      assert.strictEqual(fut.icms, 0, n);
      assert.strictEqual(fut.ipi, 0, n);
    }
  });
  it("PDF futuro não exibe ISS/ICMS/PIS mantidos", async () => {
    for (const [n, { r, filled }] of Object.entries(runAll())) {
      const htmlP = await pdfHtmlFor(r, filled);
      assert.doesNotMatch(htmlP, /ISS mantido integralmente em 2027/, n);
    }
  });
});

describe("Auditoria Funcional 2033 — Item 3: Total = soma dos tributos", () => {
  it("total LP = IRPJ15 + Adic + CSLL + PIS/COFINS + ISS", () => {
    for (const [n, { r }] of Object.entries(runAll())) {
      const lp = r.lucroPresumidoAtual;
      const soma = lp.irpj15 + lp.irpjAdic + lp.csll + lp.pisCofins + lp.iss;
      assert.ok(Math.abs(lp.total - soma) < 0.02, n + " soma=" + soma + " total=" + lp.total);
    }
  });
  it("total futuro = IRPJ15 + Adic + CSLL + CBS.liquida + IBS.liquido", () => {
    for (const [n, { r }] of Object.entries(runAll())) {
      const fut = r.cenarioFuturo;
      const soma = fut.irpj15 + fut.irpjAdic + fut.csll + r.CBS.liquida + r.IBS.liquido;
      assert.ok(Math.abs(fut.total - soma) < 0.02, n + " soma=" + soma + " total=" + fut.total);
    }
  });
});

describe("Auditoria Funcional 2033 — Item 4: alíquota efetiva = total / receita", () => {
  it("LP e futuro: alíquota efetiva correta", () => {
    for (const [n, { r }] of Object.entries(runAll())) {
      const receita = r.premissas.rbt12;
      assert.ok(Math.abs(r.lucroPresumidoAtual.aliquota - r.lucroPresumidoAtual.total / receita * 100) < 0.02, n);
      assert.ok(Math.abs(r.cenarioFuturo.aliquotaTotal - r.cenarioFuturo.total / receita * 100) < 0.02, n);
    }
  });
});

describe("Auditoria Funcional 2033 — Itens 5/6: memória CBS/IBS fecha", () => {
  it("CBS: debito >= 0, credito >= 0, liquida = max(0, debito - credito)", () => {
    for (const [n, { r }] of Object.entries(runAll())) {
      assert.ok(r.CBS.debito >= 0, n);
      assert.ok(r.CBS.credito >= 0, n);
      assert.ok(r.CBS.liquida >= 0, n);
      assert.ok(Math.abs(r.CBS.liquida - Math.max(0, r.CBS.debito - r.CBS.credito)) < 0.01, n);
    }
  });
  it("IBS: debito >= 0, credito >= 0, liquido = max(0, debito - credito)", () => {
    for (const [n, { r }] of Object.entries(runAll())) {
      assert.ok(r.IBS.debito >= 0, n);
      assert.ok(r.IBS.credito >= 0, n);
      assert.ok(r.IBS.liquido >= 0, n);
      assert.ok(Math.abs(r.IBS.liquido - Math.max(0, r.IBS.debito - r.IBS.credito)) < 0.01, n);
    }
  });
});

describe("Auditoria Funcional 2033 — Item 9: cenários extremos sem NaN/Infinity/negativos", () => {
  it("todos os valores numéricos finitos", () => {
    for (const [n, { r }] of Object.entries(runAll())) {
      const vals = [
        r.lucroPresumidoAtual.total, r.lucroPresumidoAtual.aliquota,
        r.cenarioFuturo.total, r.cenarioFuturo.aliquotaTotal,
        r.CBS.debito, r.CBS.credito, r.CBS.liquida,
        r.IBS.debito, r.IBS.credito, r.IBS.liquido,
        r.comparacao.diferenca, r.comparacao.valorAnual, r.comparacao.valorMensal, r.comparacao.percentual,
      ];
      vals.forEach((v, i) => assert.ok(Number.isFinite(v), n + " campo " + i + " não-finito: " + v));
    }
  });
  it("percentual de variação é magnitude >= 0", () => {
    for (const [n, { r }] of Object.entries(runAll())) {
      assert.ok(Number.isFinite(r.comparacao.percentual) && r.comparacao.percentual >= 0, n);
    }
  });
  it("PDF gera sem erro nos extremos", async () => {
    for (const [n, { r, filled }] of Object.entries(runAll())) {
      const htmlP = await pdfHtmlFor(r, filled);
      assert.ok(htmlP && htmlP.length > 1000, n);
      assert.doesNotMatch(htmlP, /NaN|Infinity|undefined/i, n);
    }
  });
});

describe("Auditoria Funcional 2033 — Item 7: PDF == Dashboard (totais e conclusão)", () => {
  it("conclusão do PDF idêntica à do motor (que reflete o Dashboard)", async () => {
    const { r, filled } = runAll().base;
    const htmlP = await pdfHtmlFor(r, filled);
    const dashText = r.conclusao.texto;
    assert.match(htmlP, new RegExp(dashText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
  it("valores-chave do PDF batem com o motor (dashboard)", async () => {
    const { r, filled } = runAll().base;
    const htmlP = await pdfHtmlFor(r, filled);
    assert.match(htmlP, /R\$ 403\.660,00/);
    assert.match(htmlP, /R\$ 205\.300,00/);
    assert.match(htmlP, /Carga tributária atual/);
    assert.match(htmlP, /Carga tributária projetada para 2033/);
    assert.match(htmlP, /Reforma Tributária \(2033\)/);
  });
  it("PDF 2033 exibe o card informativo 'Importante' no topo (antes do Resultado Executivo)", async () => {
    const { r, filled } = runAll().base;
    const htmlP = await pdfHtmlFor(r, filled);
    assert.match(htmlP, /📌 Importante/);
    assert.match(htmlP, /Esta simulação é baseada nas informações fornecidas pelo usuário/);
    assert.match(htmlP, /projeção do cenário tributário/);
    assert.ok(htmlP.indexOf("📌 Importante") < htmlP.indexOf("Premissas da Simulação"), "card antes das premissas");
  });
});
