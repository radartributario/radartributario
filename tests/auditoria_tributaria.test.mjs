import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../public/comparador.html", import.meta.url), "utf-8");
const jsMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!jsMatch) throw new Error("No script found");
const code = jsMatch[1];
const initIdx = code.indexOf("// ===== INIT =====");
const codeToEval = code.substring(0, initIdx !== -1 ? initIdx : code.length);

const mockCnaeFatorR = new Set([
  "6201-5", "6202-3", "6203-1", "6204-0", "6209-1",
  "6911-7", "6920-6", "7020-4", "7111-1", "7311-4",
]);

function mockEl(overrides = {}) {
  return {
    value: "",
    innerHTML: "",
    textContent: "",
    style: {},
    classList: { add: () => {}, remove: () => {} },
    disabled: false,
    checked: false,
    options: [],
    selectedIndex: -1,
    dataset: {},
    ...overrides,
  };
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
  CNAE_FATOR_R: mockCnaeFatorR,
  addEventListener: () => {},
  getCbsTreatment: () => ({}),
  location: { href: "" },
};

const fn = new Function(
  "window", "document", "console",
  codeToEval + "; return { getSNParams, getSNParcelaIcmsIss, getAnexoSN, getSNFaixa, calcularSN, calcularLP, calcularCBS, calcularIBS, calcularComparacaoSimplesPresumido, calcularComparacaoSimplesHibrido, calcularComparacaoPresumidoReforma, buildPdfHtmlFromObject };"
);

const engine = fn(mockWindow, mockDoc, console);

const cents = 0.01;
const pctTol = 0.000001;

function close(actual, expected, tolerance = cents, label = "value") {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function money(value) {
  return `R$ ${round2(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function manualSn(rbt12, anexo, encargosForaDAS = 0) {
  const table = {
    "Anexo I": [[180000, 0.04, 0], [360000, 0.073, 5940], [720000, 0.095, 13860], [1800000, 0.107, 22500], [3600000, 0.143, 87300], [Infinity, 0.19, 378000]],
    "Anexo II": [[180000, 0.045, 0], [360000, 0.078, 5940], [720000, 0.10, 13860], [1800000, 0.112, 22500], [3600000, 0.147, 85500], [Infinity, 0.30, 720000]],
    "Anexo III": [[180000, 0.06, 0], [360000, 0.112, 9360], [720000, 0.135, 17640], [1800000, 0.16, 35640], [3600000, 0.21, 125640], [Infinity, 0.33, 648000]],
    "Anexo IV": [[180000, 0.045, 0], [360000, 0.09, 8100], [720000, 0.102, 12420], [1800000, 0.14, 39780], [3600000, 0.22, 183780], [Infinity, 0.33, 828000]],
    "Anexo V": [[180000, 0.155, 0], [360000, 0.18, 4500], [720000, 0.195, 9900], [1800000, 0.205, 17100], [3600000, 0.23, 62100], [Infinity, 0.305, 540000]],
  };
  const [, aliqNominal, deducao] = table[anexo].find(([limit]) => rbt12 <= limit);
  const aliqEfetiva = (rbt12 * aliqNominal - deducao) / rbt12;
  const das = rbt12 * aliqEfetiva;
  return { aliqNominal, deducao, aliqEfetivaPct: Math.round((aliqEfetiva * 100 + 1e-9) * 100) / 100, das, total: das + encargosForaDAS };
}

function manualLp({ rbt12, tipoAtiv = "comercio", presIRPJ = 0.08, presCSLL = 0.12, issPct = 0, icmsPct = 0, ipiPct = 0, compras = 0, ano = 2027 }) {
  function baseMajorada(pres, tributo) {
    const limite = tributo === "CSLL" && ano === 2026 ? 3_750_000 : ano >= 2026 ? 5_000_000 : Infinity;
    const normalRevenue = Math.min(rbt12, limite);
    const excessRevenue = Math.max(0, rbt12 - limite);
    const majorPres = round2(pres * 1.1 * 100) / 100;
    const normalBase = round2(normalRevenue * pres);
    const majorBase = round2(excessRevenue * majorPres);
    return { limite, normalRevenue, excessRevenue, majorPres, normalBase, majorBase, total: round2(normalBase + majorBase) };
  }
  const baseIRPJ = baseMajorada(presIRPJ, "IRPJ");
  const baseCSLL = baseMajorada(presCSLL, "CSLL");
  const irpj15 = baseIRPJ.total * 0.15;
  const adicionalIRPJ = Math.max(0, baseIRPJ.total - 60_000) * 0.10;
  const csll = baseCSLL.total * 0.09;
  const pis = rbt12 * 0.0065;
  const cofins = rbt12 * 0.03;
  const icms = Math.max(0, rbt12 * icmsPct - compras * icmsPct);
  const iss = tipoAtiv === "servicos" ? rbt12 * issPct : 0;
  const ipi = tipoAtiv === "industria" ? compras * ipiPct : 0;
  const total = irpj15 + adicionalIRPJ + csll + pis + cofins + icms + iss + ipi;
  return { baseIRPJ, baseCSLL, irpj15, adicionalIRPJ, csll, pis, cofins, pisCofins: pis + cofins, icms, iss, ipi, total, aliquota: total / rbt12 * 100 };
}

function commercialForm(overrides = {}) {
  return {
    rbt12Input: "2.000.000,00",
    comprasInput: "800.000,00",
    salarios: "0,00",
    prolabore: "0,00",
    inss: "20",
    rat: "3",
    terceiros: "3.3",
    fgts: "8",
    aliquotaISS: "0",
    aliquotaICMS: "18",
    aliquotaIPI: "0",
    segregacao: "100",
    tipoAtivLP: "comercio",
    cnae: "4711-3/00",
    anoSIM: "2027",
    refCredPct: "100",
    optOutPct: "100",
    aliqCbsFora: "8.8",
    aliqCbsCompras: "8.8",
    refAliqCbs: "8.8",
    aliqIbsCompras: "0.1",
    ...overrides,
  };
}

function pdfFor(results, formData) {
  return new Promise((resolve) => engine.buildPdfHtmlFromObject(results, formData, resolve));
}

function snapshotSnLp(result) {
  return {
    tipo: result.tipoComparacao,
    sn: {
      anexo: result.sn.anexo,
      das: round2(result.sn.dasAnual),
      aliquota: round2(result.sn.aliquota),
      deducao: round2(result.memoriaCalculo.sn.deducao),
    },
    lp: {
      total: round2(result.lp.total),
      baseIRPJ: round2(result.lp.baseIRPJ),
      baseCSLL: round2(result.lp.baseCSLL),
      irpj15: round2(result.lp.irpj15),
      irpjAdic: round2(result.lp.irpjAdic),
      csll: round2(result.lp.csll),
      pisCofins: round2(result.lp.pisCofins),
      icms: round2(result.lp.icms),
    },
    vencedor: result.conclusao.vencedor,
    economia: round2(result.kpi.economia),
  };
}

describe("Auditoria tributaria - Simples Nacional", () => {
  it("valida tabelas, DAS, aliquota efetiva e parcela a deduzir por anexo", () => {
    const cases = [
      { anexo: "Anexo I", rbt12: 2_000_000 },
      { anexo: "Anexo II", rbt12: 2_000_000 },
      { anexo: "Anexo III", rbt12: 1_200_000 },
      { anexo: "Anexo V", rbt12: 1_200_000 },
    ];

    for (const c of cases) {
      const expected = manualSn(c.rbt12, c.anexo);
      const params = engine.getSNParams(c.anexo, c.rbt12);
      const result = engine.calcularSN({ rbt12: c.rbt12, anexo: c.anexo, encargosForaDAS: 0 });
      close(params.aliq, expected.aliqNominal, pctTol, `${c.anexo} aliquota nominal`);
      close(params.deducao, expected.deducao, cents, `${c.anexo} deducao`);
      close(result.aliqEfetiva, expected.aliqEfetivaPct, pctTol, `${c.anexo} aliquota efetiva`);
      close(result.dasAnual, expected.das, cents, `${c.anexo} DAS`);
      close(result.total, expected.total, cents, `${c.anexo} total`);
    }
  });

  it("valida comercio, servicos, industria, Fator R, Anexo III, Anexo V e partilha", () => {
    assert.strictEqual(engine.getAnexoSN("4711-3/00", "4711-3", 0), "Anexo I");
    assert.strictEqual(engine.getAnexoSN("1012-1/00", "1012-1", 0), "Anexo II");
    assert.strictEqual(engine.getAnexoSN("6201-5/00", "6201-5", 0.30), "Anexo III");
    assert.strictEqual(engine.getAnexoSN("6201-5/00", "6201-5", 0.10), "Anexo V");
    close(engine.getSNParcelaIcmsIss("Anexo I", 2_000_000), 0.335, pctTol, "ICMS Anexo I faixa 5");
    close(engine.getSNParcelaIcmsIss("Anexo II", 2_000_000), 0.32, pctTol, "ICMS Anexo II faixa 5");
    close(engine.getSNParcelaIcmsIss("Anexo III", 1_200_000), 0.325, pctTol, "ISS Anexo III faixa 4");
    close(engine.getSNParcelaIcmsIss("Anexo V", 1_200_000), 0.21, pctTol, "ISS Anexo V faixa 4");
  });

  it("valida memoria de calculo do SN contra os valores do resultado", () => {
    const result = engine.calcularComparacaoSimplesPresumido(commercialForm());
    const expected = manualSn(2_000_000, "Anexo I");
    close(result.memoriaCalculo.sn.aliqNominal, expected.aliqNominal, pctTol, "memoria aliquota nominal");
    close(result.memoriaCalculo.sn.deducao, expected.deducao, cents, "memoria deducao");
    close(result.memoriaCalculo.sn.aliqEfetiva, expected.aliqEfetivaPct, pctTol, "memoria aliquota efetiva");
    close(result.sn.dasAnual, expected.das, cents, "resultado DAS");
  });
});

describe("Auditoria tributaria - Lucro Presumido", () => {
  it("valida etapa a etapa empresa comercial com calculo manual centavo a centavo", () => {
    const result = engine.calcularComparacaoSimplesPresumido(commercialForm());
    const expected = manualLp({ rbt12: 2_000_000, compras: 800_000, icmsPct: 0.18, ano: 2027 });

    close(result.lp.baseIRPJ, expected.baseIRPJ.total, cents, "base IRPJ");
    close(result.lp.baseCSLL, expected.baseCSLL.total, cents, "base CSLL");
    close(result.lp.presIRPJ, 8, pctTol, "presuncao IRPJ");
    close(result.lp.presCSLL, 12, pctTol, "presuncao CSLL");
    close(result.lp.irpj15, expected.irpj15, cents, "IRPJ 15");
    close(result.lp.irpjAdic, expected.adicionalIRPJ, cents, "adicional IRPJ");
    close(result.lp.csll, expected.csll, cents, "CSLL");
    close(result.lp.pisCofins, expected.pisCofins, cents, "PIS/COFINS");
    close(result.lp.icms, expected.icms, cents, "ICMS liquido");
    close(result.lp.iss, 0, cents, "ISS comercio");
    close(result.lp.ipi, 0, cents, "IPI comercio");
    close(result.lp.total, expected.total, cents, "total LP");
    close(result.lp.aliquota, expected.aliquota, pctTol, "aliquota LP");
  });

  it("valida servicos, ISS e majoracao 2026/2027 somente sobre excedente", () => {
    const result = engine.calcularLP({
      rbt12: 6_000_000,
      tipoAtiv: "servicos",
      presIRPJ: 0.32,
      presCSLL: 0.32,
      issPct: 0.05,
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
    });
    const expected = manualLp({ rbt12: 6_000_000, tipoAtiv: "servicos", presIRPJ: 0.32, presCSLL: 0.32, issPct: 0.05, ano: 2027 });
    close(result.basePresumidaIRPJDetalhe.receitaNormal, 5_000_000, cents, "IRPJ receita normal");
    close(result.basePresumidaIRPJDetalhe.receitaExcedente, 1_000_000, cents, "IRPJ receita excedente");
    close(result.basePresumidaIRPJDetalhe.presuncaoMajorada, 0.352, pctTol, "IRPJ presuncao majorada");
    close(result.baseIRPJ, expected.baseIRPJ.total, cents, "IRPJ base majorada");
    close(result.baseCSLL, expected.baseCSLL.total, cents, "CSLL base majorada");
    close(result.iss, expected.iss, cents, "ISS servicos");
    close(result.total, expected.total, cents, "LP servicos total");
  });

  it("valida industria com ICMS, IPI e sem ISS", () => {
    const result = engine.calcularLP({
      rbt12: 2_000_000,
      tipoAtiv: "industria",
      presIRPJ: 0.08,
      presCSLL: 0.12,
      issPct: 0.05,
      icmsPct: 0.12,
      ipiPct: 0.05,
      segregPct: 1,
      comprasAnual: 800_000,
      sal: 0,
      prol: 0,
      inssP: 0,
      ratP: 0,
      tercP: 0,
      fgtsP: 0,
      anoSIM: "2027",
    });
    const expected = manualLp({ rbt12: 2_000_000, tipoAtiv: "industria", compras: 800_000, icmsPct: 0.12, ipiPct: 0.05, ano: 2027 });
    close(result.icms, expected.icms, cents, "ICMS industria");
    close(result.ipi, expected.ipi, cents, "IPI industria");
    close(result.iss, 0, cents, "ISS industria");
    close(result.total, expected.total, cents, "total industria");
  });
});

describe("Auditoria tributaria - Reforma Tributaria", () => {
  it("valida CBS, IBS, debitos, creditos, liquidos e transicao 2027", () => {
    const result = engine.calcularComparacaoPresumidoReforma(commercialForm());
    const lp = manualLp({ rbt12: 2_000_000, compras: 800_000, icmsPct: 0.18, ano: 2027 });
    const cbsDebito = 2_000_000 * 0.088;
    const cbsCredito = 800_000 * 0.088;
    const cbsLiquida = cbsDebito - cbsCredito;
    const ibsDebito = 2_000_000 * 0.001;
    const ibsCredito = 800_000 * 0.001;
    const ibsLiquido = ibsDebito - ibsCredito;
    const futuro = lp.total - lp.pisCofins - lp.ipi + cbsLiquida + ibsLiquido;

    close(result.lucroPresumidoAtual.total, lp.total, cents, "LP atual reforma");
    close(result.CBS.aliq, 8.8, pctTol, "CBS aliquota");
    close(result.CBS.debito, cbsDebito, cents, "CBS debito");
    close(result.CBS.credito, cbsCredito, cents, "CBS credito");
    close(result.CBS.liquida, cbsLiquida, cents, "CBS liquida");
    close(result.IBS.aliq, 0.1, pctTol, "IBS aliquota 2027");
    close(result.IBS.debito, ibsDebito, cents, "IBS debito");
    close(result.IBS.credito, ibsCredito, cents, "IBS credito");
    close(result.IBS.liquido, ibsLiquido, cents, "IBS liquido");
    close(result.cenarioFuturo.total, futuro, cents, "total futuro");
    assert.strictEqual(result.anoSimulacao, "2027");
    assert.ok(result.escopo.includes("IBS"));
  });

  it("valida reducoes legais aplicadas a CBS e IBS em atividade profissional confirmada", () => {
    const result = engine.calcularComparacaoPresumidoReforma(commercialForm({
      rbt12Input: "1.200.000,00",
      comprasInput: "200.000,00",
      aliquotaICMS: "0",
      aliquotaISS: "2.5",
      tipoAtivLP: "servicos",
      cnae: "6920-6/01",
      benefReqProfissionais: "sim",
      benefReqSemSocioPJ: "sim",
      benefReqNaoParticipaPJ: "sim",
      benefReqExclusiva: "sim",
      benefReqDireta: "sim",
    }));
    const cbsAliq = 0.088 * 0.70;
    const ibsAliq = 0.001 * 0.70;
    close(result.CBS.aliq, cbsAliq * 100, pctTol, "CBS reduzida 30%");
    close(result.CBS.debito, 1_200_000 * cbsAliq, cents, "CBS debito reduzido");
    close(result.CBS.credito, 200_000 * 0.088, cents, "CBS credito nao reduzido");
    close(result.CBS.liquida, 1_200_000 * cbsAliq - 200_000 * 0.088, cents, "CBS liquida reduzida");
    close(result.IBS.aliq, ibsAliq * 100, pctTol, "IBS reduzido 30%");
    close(result.IBS.debito, 1_200_000 * ibsAliq, cents, "IBS debito reduzido");
    close(result.IBS.credito, 200_000 * 0.001, cents, "IBS credito nao reduzido");
    assert.strictEqual(result.premissas.beneficioProfissional.status, "APLICADO");
  });
});

describe("Auditoria tributaria - Simples Hibrido", () => {
  it("valida DAS reduzido, CBS fora do DAS, total, aumento e vencedor tradicional", () => {
    const result = engine.calcularComparacaoSimplesHibrido(commercialForm());
    const sn = manualSn(2_000_000, "Anexo I");
    const repCbs = 0.1641;
    const cbsRetirada = sn.das * repCbs;
    const cbsDebito = 2_000_000 * 0.088;
    const cbsCredito = 800_000 * 0.088;
    const cbsLiquida = cbsDebito - cbsCredito;
    const dasReduzido = sn.das - cbsRetirada;
    const totalHibrido = dasReduzido + cbsLiquida;
    const aumento = totalHibrido - sn.total;

    close(result.simplesTradicional.das, sn.das, cents, "DAS tradicional");
    close(result.simplesHibrido.parcelaCbsRetiradaDoDas, cbsRetirada, cents, "CBS retirada do DAS");
    close(result.CBS.debito, cbsDebito, cents, "CBS fora debito");
    close(result.CBS.credito, cbsCredito, cents, "CBS fora credito");
    close(result.simplesHibrido.cbsLiquida, cbsLiquida, cents, "CBS fora liquida");
    close(result.simplesHibrido.dasReduzido, dasReduzido, cents, "DAS reduzido");
    close(result.simplesHibrido.total, totalHibrido, cents, "total hibrido");
    close(result.comparacaoFinanceira.valorAnual, aumento, cents, "aumento anual");
    assert.strictEqual(result.comparacaoFinanceira.tipo, "AUMENTO");
    assert.strictEqual(result.conclusao.vencedor, "Simples tradicional");
  });

  it("valida economia e vencedor hibrido quando os creditos CBS superam o debito", () => {
    const result = engine.calcularComparacaoSimplesHibrido(commercialForm({ comprasInput: "2.500.000,00" }));
    const sn = manualSn(2_000_000, "Anexo I");
    const cbsRetirada = sn.das * 0.1641;
    const dasReduzido = sn.das - cbsRetirada;

    close(result.CBS.liquida, 0, cents, "CBS liquida zerada por credito");
    close(result.simplesHibrido.total, dasReduzido, cents, "total hibrido com credito alto");
    close(result.comparacaoFinanceira.valorAnual, cbsRetirada, cents, "economia anual");
    assert.strictEqual(result.comparacaoFinanceira.tipo, "ECONOMIA");
    assert.strictEqual(result.conclusao.vencedor, "Simples híbrido");
  });

  it("valida memoria detalhada do hibrido contra o calculo", () => {
    const result = engine.calcularComparacaoSimplesHibrido(commercialForm());
    const consolidated = result.detalhamento.memoriaConsolidada;
    const dasIntegral = consolidated.find((row) => row.item === "DAS integral");
    const cbsRetirada = consolidated.find((row) => row.item === "(–) CBS retirada do DAS");
    const dasAjustado = consolidated.find((row) => row.item === "DAS ajustado");
    const cbsLiquida = consolidated.find((row) => row.item === "(+) CBS líquida");
    const total = consolidated.find((row) => row.item === "Total híbrido");

    close(dasIntegral.valorAnual, result.simplesHibrido.dasIntegral, cents, "memoria DAS integral");
    close(cbsRetirada.valorAnual, result.simplesHibrido.parcelaCbsRetiradaDoDas, cents, "memoria CBS retirada");
    close(dasAjustado.valorAnual, result.simplesHibrido.dasReduzido, cents, "memoria DAS ajustado");
    close(cbsLiquida.valorAnual, result.simplesHibrido.cbsLiquida, cents, "memoria CBS liquida");
    close(total.valorAnual, result.simplesHibrido.total, cents, "memoria total hibrido");
  });
});

describe("Auditoria tributaria - PDF e snapshots", () => {
  it("valida PDF SN x LP com resultado executivo, memoria e conclusao iguais a tela", async () => {
    const result = engine.calcularComparacaoSimplesPresumido(commercialForm());
    const pdf = await pdfFor(result, commercialForm());
    assert.ok(pdf.includes("Resultado Executivo") || pdf.includes("RESULTADO EXECUTIVO"));
    assert.ok(pdf.includes("Memória Resumida") || pdf.includes("Memória dos cálculos") || pdf.includes("MEMÓRIA DE CÁLCULO"));
    assert.ok(pdf.includes("Conclusão Executiva") || pdf.includes("CONCLUSÃO EXECUTIVA") || pdf.includes("Conclusão"));
    assert.ok(pdf.includes(money(result.sn.total)));
    assert.ok(pdf.includes(money(result.lp.total)));
    assert.ok(pdf.includes(money(result.lp.baseIRPJ)));
    assert.ok(pdf.includes(money(result.lp.baseCSLL)));
    assert.ok(pdf.includes(result.conclusao.vencedor));
  });

  it("valida PDF Reforma e Hibrido com os mesmos totais da tela", async () => {
    const reforma = engine.calcularComparacaoPresumidoReforma(commercialForm());
    const hibrido = engine.calcularComparacaoSimplesHibrido(commercialForm());
    const pdfReforma = await pdfFor(reforma, commercialForm());
    const pdfHibrido = await pdfFor(hibrido, commercialForm());
    assert.ok(pdfReforma.includes(money(reforma.lucroPresumidoAtual.total)));
    assert.ok(pdfReforma.includes(money(reforma.cenarioFuturo.total)));
    assert.ok(pdfReforma.includes(money(reforma.CBS.liquida)));
    assert.ok(pdfReforma.includes(money(reforma.IBS.liquido)));
    assert.ok(pdfHibrido.includes(money(hibrido.simplesTradicional.total)));
    assert.ok(pdfHibrido.includes(money(hibrido.simplesHibrido.total)));
    assert.ok(pdfHibrido.includes(money(hibrido.simplesHibrido.dasReduzido)));
    assert.ok(pdfHibrido.includes(money(hibrido.CBS.liquida)));
  });

  it("snapshot principal SN x LP detecta regressao numerica", () => {
    const result = engine.calcularComparacaoSimplesPresumido(commercialForm());
    assert.deepStrictEqual(snapshotSnLp(result), {
      tipo: "SIMPLES_VS_PRESUMIDO",
      sn: { anexo: "Anexo I", das: 198700, aliquota: 9.94, deducao: 87300 },
      lp: { total: 344600, baseIRPJ: 160000, baseCSLL: 240000, irpj15: 24000, irpjAdic: 10000, csll: 21600, pisCofins: 73000, icms: 216000 },
      vencedor: "Simples Nacional",
      economia: 145900,
    });
  });

  it("snapshots Reforma e Hibrido detectam regressao numerica", () => {
    const reforma = engine.calcularComparacaoPresumidoReforma(commercialForm());
    const hibrido = engine.calcularComparacaoSimplesHibrido(commercialForm());
    assert.deepStrictEqual({
      atual: round2(reforma.lucroPresumidoAtual.total),
      cbsDebito: round2(reforma.CBS.debito),
      cbsCredito: round2(reforma.CBS.credito),
      cbsLiquida: round2(reforma.CBS.liquida),
      ibsDebito: round2(reforma.IBS.debito),
      ibsCredito: round2(reforma.IBS.credito),
      ibsLiquido: round2(reforma.IBS.liquido),
      futuro: round2(reforma.cenarioFuturo.total),
      impacto: reforma.comparacao.tipo,
    }, {
      atual: 344600,
      cbsDebito: 176000,
      cbsCredito: 70400,
      cbsLiquida: 105600,
      ibsDebito: 2000,
      ibsCredito: 800,
      ibsLiquido: 1200,
      futuro: 378400,
      impacto: "AUMENTO",
    });
    assert.deepStrictEqual({
      tradicional: round2(hibrido.simplesTradicional.total),
      dasReduzido: round2(hibrido.simplesHibrido.dasReduzido),
      cbsLiquida: round2(hibrido.CBS.liquida),
      totalHibrido: round2(hibrido.simplesHibrido.total),
      tipoImpacto: hibrido.comparacaoFinanceira.tipo,
      vencedor: hibrido.conclusao.vencedor,
    }, {
      tradicional: 198700,
      dasReduzido: 166093.33,
      cbsLiquida: 105600,
      totalHibrido: 271693.33,
      tipoImpacto: "AUMENTO",
      vencedor: "Simples tradicional",
    });
  });
});
