import assert from "node:assert";
import { readFileSync } from "node:fs";

export const CENT = 0.01;
export const PCT_TOL = 0.000001;

export function close(actual, expected, tolerance = CENT, label = "value") {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function roundPct(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function money(value) {
  return `R$ ${round2(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function pct(value) {
  return `${roundPct(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

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

export function loadEngine() {
  const html = readFileSync(new URL("../../public/comparador.html", import.meta.url), "utf-8");
  const jsMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!jsMatch) throw new Error("No script found");
  const code = jsMatch[1];
  const initIdx = code.indexOf("// ===== INIT =====");
  const codeToEval = code.substring(0, initIdx !== -1 ? initIdx : code.length);
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
    CNAE_FATOR_R: new Set(["6201-5", "6202-3", "6203-1", "6204-0", "6209-1", "6911-7", "6920-6", "7020-4", "7111-1", "7311-4"]),
    addEventListener: () => {},
    getCbsTreatment: () => ({}),
    location: { href: "" },
  };
  const fn = new Function(
    "window", "document", "console",
    codeToEval + "; return { getSNParams, getSNParcelaIcmsIss, getAnexoSN, getSNFaixa, calcularSN, calcularLP, calcularCBS, calcularIBS, calcularComparacaoSimplesPresumido, calcularComparacaoSimplesHibrido, calcularComparacaoPresumidoReforma, buildPdfHtmlFromObject };"
  );
  return fn(mockWindow, mockDoc, console);
}

export function pdfFor(engine, results, formData) {
  return new Promise((resolve) => engine.buildPdfHtmlFromObject(results, formData, resolve));
}

export function form(overrides = {}) {
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
    aliqCbsFora: "9.21",
    aliqCbsCompras: "9.21",
    refAliqCbs: "9.21",
    aliqIbsCompras: "0.1",
    ...overrides,
  };
}

export function manualSn(rbt12, anexo, encargosForaDAS = 0) {
  const table = {
    "Anexo I": [[180000, 0.04, 0], [360000, 0.073, 5940], [720000, 0.095, 13860], [1800000, 0.107, 22500], [3600000, 0.143, 87300], [Infinity, 0.19, 378000]],
    "Anexo II": [[180000, 0.045, 0], [360000, 0.078, 5940], [720000, 0.10, 13860], [1800000, 0.112, 22500], [3600000, 0.147, 85500], [Infinity, 0.30, 720000]],
    "Anexo III": [[180000, 0.06, 0], [360000, 0.112, 9360], [720000, 0.135, 17640], [1800000, 0.16, 35640], [3600000, 0.21, 125640], [Infinity, 0.33, 648000]],
    "Anexo IV": [[180000, 0.045, 0], [360000, 0.09, 8100], [720000, 0.102, 12420], [1800000, 0.14, 39780], [3600000, 0.22, 183780], [Infinity, 0.33, 828000]],
    "Anexo V": [[180000, 0.155, 0], [360000, 0.18, 4500], [720000, 0.195, 9900], [1800000, 0.205, 17100], [3600000, 0.23, 62100], [Infinity, 0.305, 540000]],
  };
  const [, aliqNominal, deducao] = table[anexo].find(([limit]) => rbt12 <= limit);
  const aliqEfetiva = rbt12 > 0 ? (rbt12 * aliqNominal - deducao) / rbt12 : 0;
  const das = rbt12 * aliqEfetiva;
  return { aliqNominal, deducao, aliqEfetivaPct: roundPercent2LikeDisplay(aliqEfetiva * 100), das, total: das + encargosForaDAS };
}

function roundPercent2LikeDisplay(v) {
  return Math.round(((Number(v) || 0) + 1e-9) * 100) / 100;
}

export function manualLp({ rbt12, tipoAtiv = "comercio", presIRPJ = 0.08, presCSLL = 0.12, issPct = 0, icmsPct = 0, ipiPct = 0, compras = 0, ano = 2027 }) {
  function baseMajorada(pres, tributo) {
    const limite = tributo === "CSLL" && ano === 2026 ? 3_750_000 : ano >= 2026 ? 5_000_000 : Infinity;
    const receitaNormal = Math.min(Math.max(rbt12, 0), limite);
    const receitaExcedente = Math.max(0, rbt12 - limite);
    const presuncaoMajorada = Math.round((pres * 1.1 + Number.EPSILON) * 1_000_000_000_000) / 1_000_000_000_000;
    const baseNormal = round2(receitaNormal * pres);
    const baseMajoradaValor = round2(receitaExcedente * presuncaoMajorada);
    return { limite, receitaNormal, receitaExcedente, presuncaoNormal: pres, presuncaoMajorada, baseNormal, baseMajorada: baseMajoradaValor, total: round2(baseNormal + baseMajoradaValor) };
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
  return { baseIRPJ, baseCSLL, irpj15, adicionalIRPJ, csll, pis, cofins, pisCofins: pis + cofins, icms, iss, ipi, total, aliquota: rbt12 > 0 ? total / rbt12 * 100 : 0 };
}

export function stableSnLpSnapshot(result) {
  return {
    modulo: result.tipoComparacao,
    sn: { total: round2(result.sn.total), das: round2(result.sn.dasAnual), aliquota: round2(result.sn.aliquota), anexo: result.sn.anexo },
    lp: { total: round2(result.lp.total), baseIRPJ: round2(result.lp.baseIRPJ), baseCSLL: round2(result.lp.baseCSLL), irpj15: round2(result.lp.irpj15), irpjAdic: round2(result.lp.irpjAdic), csll: round2(result.lp.csll), pisCofins: round2(result.lp.pisCofins), icms: round2(result.lp.icms), iss: round2(result.lp.iss), ipi: round2(result.lp.ipi) },
    decisao: { vencedor: result.conclusao.vencedor, economia: round2(result.kpi.economia) },
  };
}

export function stableHibridoSnapshot(result) {
  return {
    modulo: result.tipoComparacao,
    tradicional: { total: round2(result.simplesTradicional.total), das: round2(result.simplesTradicional.das), aliquota: round2(result.simplesTradicional.aliquota) },
    hibrido: { total: round2(result.simplesHibrido.total), dasReduzido: round2(result.simplesHibrido.dasReduzido), cbsLiquida: round2(result.simplesHibrido.cbsLiquida), ibsLiquido: round2(result.simplesHibrido.ibsLiquido) },
    decisao: { vencedor: result.conclusao.vencedor, tipo: result.comparacaoFinanceira.tipo, valor: round2(result.comparacaoFinanceira.valorAnual) },
  };
}

export function stableReformaSnapshot(result) {
  return {
    modulo: result.tipoComparacao,
    atual: { total: round2(result.lucroPresumidoAtual.total), pisCofins: round2(result.lucroPresumidoAtual.pisCofins), ipi: round2(result.lucroPresumidoAtual.ipi) },
    cbs: { debito: round2(result.CBS.debito), credito: round2(result.CBS.credito), liquida: round2(result.CBS.liquida), aliq: round2(result.CBS.aliq) },
    ibs: { debito: round2(result.IBS.debito), credito: round2(result.IBS.credito), liquido: round2(result.IBS.liquido), aliq: round2(result.IBS.aliq) },
    futuro: { total: round2(result.cenarioFuturo.total), aliquota: round2(result.cenarioFuturo.aliquotaTotal) },
    decisao: { tipo: result.comparacao.tipo, valor: round2(result.comparacao.valorAnual) },
  };
}
