// Auditoria — Simples Híbrido 2027
import { readFileSync } from "node:fs";

const html = readFileSync(
  new URL("./public/comparador.html", import.meta.url),
  "utf-8"
);

const jsMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!jsMatch) throw new Error("No script found");
const code = jsMatch[1];

const initIdx = code.indexOf("// ===== INIT =====");
const codeToEval = code.substring(0, initIdx !== -1 ? initIdx : code.length);

// CNAE data is in a JS file that assigns to window.CNAE_TAX_DATA
// We load it via vm.Script below

// Setup mock
globalThis.document = {
  getElementById: () => ({ value: "", innerHTML: "", textContent: "", style: {} }),
  querySelector: () => null,
  createElement: () => ({}),
  createTextNode: () => ({}),
};
globalThis.window = globalThis;
globalThis.CNAE_TAX_DATA = cnaeData.cnae_tax;
globalThis.CNAE_FATOR_R = new Set(
  Object.entries(cnaeData.cnae_tax)
    .filter(([k, v]) => v.anexo_simples === "Anexo III" || v.anexo_simples === "Anexo V")
    .map(([k]) => k.split("/")[0])
);
globalThis.CNAE_ANEXO_IV = new Set();
globalThis.brToNum = (v) => {
  if (!v) return 0;
  const s = String(v).replace(/\./g, "").replace(",", ".");
  return parseFloat(s) || 0;
};
globalThis.fmtMoeda = (v) => "R$ " + v.toFixed(2).replace(".", ",");
globalThis.fmtPct = (v) => (v * 100).toFixed(2).replace(".", ",") + "%";
globalThis.fmtDecimal = (v) => v.toFixed(2).replace(".", ",");
globalThis.fmt = (v) => v.toFixed(2).replace(".", ",");
globalThis.console = console;

const vm = require("vm");
const script = new vm.Script(codeToEval, { filename: "comparador.js" });
script.runInContext(globalThis);

function fd(overrides) {
  return {
    rbt12Input: "1.200.000,00",
    comprasInput: "0",
    salarios: "0",
    prolabore: "0",
    cnae: "6920-6",
    tipoAtivLP: "servicos",
    optOutPct: "100",
    anoSIM: "2027",
    aliquotaISS: "2.5",
    ...overrides,
  };
}

// =========================================================================
// CENÁRIO BASE: CNAE 6920-6, RBT12 1.200.000, Compras 200.000
// =========================================================================
const formData = fd({ comprasInput: "200.000,00" });
const result = calcularComparacaoSimplesHibrido(formData);

console.log("=== CENÁRIO BASE ===");
console.log("RBT12...............: 1.200.000,00");
console.log("Compras.............: 200.000,00");
console.log("CNAE................: 6920-6 (contabilidade)");
console.log("");

const st = result.simplesTradicional;
const hib = result.simplesHibrido;
const cbs = result.CBS;
const mem = result.memoriaCalculo;

console.log("=== SIMPLES TRADICIONAL ===");
console.log("DAS integral..............: R$", st.das.toFixed(2));
console.log("Total.....................: R$", st.total.toFixed(2));
console.log("Alíquota efetiva..........:", (st.aliquota).toFixed(2) + "%");
console.log("Anexo.....................:", st.anexo);
console.log("");

console.log("=== REPARTIÇÃO DO DAS (2027) ===");
const rep = hib.reparticao;
console.log("IRPJ.....................:", (rep.irpj * 100).toFixed(2) + "%");
console.log("CSLL.....................:", (rep.csll * 100).toFixed(2) + "%");
console.log("CBS (ex-COFINS)..........:", (rep.cbs * 100).toFixed(2) + "%");
console.log("CPP......................:", (rep.cpp * 100).toFixed(2) + "%");
console.log("ISS......................:", (rep.iss * 100).toFixed(2) + "%");
console.log("IBS......................:", (rep.ibs * 100).toFixed(2) + "%");
console.log("Soma.....................:", ((rep.irpj + rep.csll + rep.cbs + rep.cpp + rep.iss + rep.ibs) * 100).toFixed(2) + "%");
console.log("");

console.log("=== RETIRADA DA CBS DO DAS ===");
const cbParc = hib.parcelaCbsRetiradaDoDas;
console.log("DAS integral................: R$", st.das.toFixed(2));
console.log("Parcela CBS na repartição...:", (rep.cbs * 100).toFixed(2) + "%");
console.log("CBS retirada do DAS.........: R$", cbParc.toFixed(2));
console.log("DAS reduzido................: R$", hib.dasReduzido.toFixed(2));
console.log("");

console.log("=== CBS FORA DO DAS ===");
console.log("Alíquota padrão CBS.........:", (cbs.aliqPadrao).toFixed(2) + "%");
console.log("Alíquota efetiva CBS........:", (cbs.aliq).toFixed(2) + "%");
console.log("Créditos sobre compras......: R$", cbs.credito.toFixed(2));
console.log("CBS bruta...................: R$", cbs.debito.toFixed(2));
console.log("CBS líquida.................: R$", cbs.liquida.toFixed(2));
if (cbs.reducao) {
  console.log("Redução CBS.................: -" + cbs.reducao.pct + "% (" + cbs.reducao.descricao + ")");
  console.log("Base legal..................:", cbs.reducao.baseLegal);
  console.log("Condicional.................:", cbs.reducao.condicional ? "SIM" : "NÃO");
}
console.log("");

console.log("=== IBS ===");
const ibs = result.IBS;
console.log("Alíquota IBS................:", ibs.aliq.toFixed(2) + "%");
console.log("Débito......................: R$", ibs.debito.toFixed(2));
console.log("Crédito.....................: R$", ibs.credito.toFixed(2));
console.log("Líquido.....................: R$", ibs.liquido.toFixed(2));
console.log("");

console.log("=== TOTAL HÍBRIDO ===");
console.log("DAS reduzido................: R$", hib.dasReduzido.toFixed(2));
console.log("CBS líquida.................: R$", cbs.liquida.toFixed(2));
console.log("IBS líquido.................: R$", hib.ibsLiquido.toFixed(2));
console.log("Encargos....................: R$", hib.encargos.toFixed(2));
console.log("Total.......................: R$", hib.total.toFixed(2));
console.log("");

console.log("=== DETALHE DA REDUÇÃO CBS (30%) ===");
console.log("Alíquota CBS reduzida aplicada automaticamente?",
  cbs.reducao ? "SIM — sem confirmação do usuário" : "NÃO");

// Test with explicit confirmation
console.log("");
console.log("=== CENÁRIO: confirmação explícita negada ===");
const formData2 = fd({ comprasInput: "200.000,00", confirmadoBeneficioArt127: false });
const result2 = calcularComparacaoSimplesHibrido(formData2);
const cbs2 = result2.CBS;
console.log("Alíquota efetiva CBS (sem redução):", (cbs2.aliq).toFixed(2) + "%");
console.log("CBS bruta (sem redução)...: R$", cbs2.debito.toFixed(2));
console.log("CBS líquida (sem redução).: R$", cbs2.liquida.toFixed(2));
console.log("Total Híbrido (sem redução): R$", result2.simplesHibrido.total.toFixed(2));

console.log("");
console.log("=== CENÁRIO: IBS com alíquota de 0,10% ===");
console.log("Débito IBS = 1.200.000 × 0,10% = R$", (1200000 * 0.001).toFixed(2));
console.log("Crédito IBS = 200.000 × 0,10% = R$", (200000 * 0.001).toFixed(2));
console.log("IBS líquido................: R$", (1200000 * 0.001 - 200000 * 0.001).toFixed(2));
