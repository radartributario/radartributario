import { readFileSync } from "fs";

// 1. Check if any .tsx files contain literal \u00 sequences
const files = [
  "src/app/dashboard/components/DashboardResultados.tsx",
  "src/app/dashboard/components/ModoSelecao.tsx",
  "src/app/dashboard/components/DashboardResultadosHibrido.tsx",
  "src/app/dashboard/components/DashboardResultadosReforma.tsx",
  "src/app/dashboard/components/DashboardDS.tsx",
  "public/comparador.html",
];

for (const file of files) {
  const content = readFileSync(file, "utf-8");
  const lines = content.split("\n");
  let found = 0;
  for (let i = 0; i < lines.length; i++) {
    // Check for literal backslash-u (double backslash in source)
    const m = lines[i].match(/\\\\u00[0-9a-f]{2}/);
    if (m) {
      console.log(`LITERAL in ${file}:${i + 1}: ${lines[i].trim().substring(0, 100)}`);
      found++;
    }
  }
  if (found === 0) {
    console.log(`No literal \\u sequences in ${file}`);
  }
}

// 2. Check the actual rendered output from the engine for unicode issues
// Simulate the engine output
const html = readFileSync("public/comparador.html", "utf-8");
const jsMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!jsMatch) throw new Error("No script");
const code = jsMatch[1];
const initIdx = code.indexOf("// ===== INIT =====");
const codeToEval = code.substring(0, initIdx !== -1 ? initIdx : code.length);

const cnaeFatorR = new Set([
  "6201-5","6202-3","6203-1","6204-0","6209-1",
  "6311-9","6319-4",
  "6611-8","6612-6","6613-4","6619-3",
  "6911-7","6912-5","6920-6",
  "7020-4",
  "7111-1","7112-0","7119-7",
  "7311-4","7312-2","7319-0","7410-2","7490-1","7500-1",
  "8220-2","8230-0",
  "8291-1","8292-0","8299-7",
  "8511-2","8512-1","8513-9","8514-7","8520-1",
  "8531-7","8532-5","8533-3","8541-4","8542-2","8550-3",
  "8610-1","8621-6","8622-4","8630-5","8640-2","8650-0","8660-7","8690-9",
  "9001-9","9002-7","9003-5",
  "9101-5","9102-3","9103-1",
  "9311-5","9312-3","9313-1","9319-1",
  "9511-8","9512-6","9521-5","9522-3","9529-1",
  "9601-7","9602-5","9603-3","9609-2",
]);

const mockWindow = { CNAE_TAX_DATA: {}, CNAE_ANEXO_IV: new Set(), CNAE_FATOR_R: cnaeFatorR, addEventListener: () => {}, getCbsTreatment: () => ({}), location: { href: "" } };
const mockDoc = { getElementById: () => ({ value: "", innerHTML: "", textContent: "", style: {}, classList: { add: () => {}, remove: () => {} }, disabled: false, checked: false, options: [], selectedIndex: -1, dataset: {} }), querySelector: () => null, querySelectorAll: () => [], createElement: () => ({}), createTextNode: () => ({}) };

const fn = new Function("window", "document", "console",
  codeToEval +
  "; return { calcularComparacaoSimplesPresumido, getAnexoSN, calcularLP, calcularSN, getSNParams };"
);
const engine = fn(mockWindow, mockDoc, console);

// Scenario with salary data to ensure Anexo III
const cenario = {
  cnae: "6920-6",
  tipoAtividadePrincipal: "servicos",
  rbt12Input: "1200000",
  comprasInput: "200000",
  aliquotaISS: "2.5",
  aliquotaICMS: "0",
  aliquotaIPI: "0",
  segregate: "0",
  salarios: "50000",
  prolabore: "15000",
};

const result = engine.calcularComparacaoSimplesPresumido(cenario);
console.log("\n=== RESULTADO ===");
console.log("SN total:", result.sn.total);
console.log("SN aliquota:", result.sn.aliquota);
console.log("SN anexo:", result.sn.anexo);
console.log("SN fatorR:", result.sn.fatorR);
console.log("LP total:", result.lp.total);
console.log("LP aliquota:", result.lp.aliquota);
console.log("Winner:", result.kpi.winner);
console.log("Economia:", result.kpi.economia);

// Check all string fields for unicode escape literals
console.log("\n=== UNICODE CHECK ===");
const json = JSON.stringify(result);
const uMatches = json.match(/\\\\u00[0-9a-f]{2}/g);
if (uMatches) {
  console.log(`FOUND ${uMatches.length} literal \\u00 sequences in JSON output!`);
  console.log("Unique:", [...new Set(uMatches)]);
} else {
  console.log("No literal \\u sequences in engine output");
}

// Check the specific fields that might have issues
console.log("\n=== LP BREAKDOWN ===");
console.log("  irpj15:", result.lp.irpj15, "(presIRPJ:", result.lp.presIRPJ, "%)");
console.log("  irpjAdic:", result.lp.irpjAdic);
console.log("  csll:", result.lp.csll, "(presCSLL:", result.lp.presCSLL, "%)");
console.log("  pisCofins:", result.lp.pisCofins);
console.log("  iss:", result.lp.iss);
console.log("  icms:", result.lp.icms);
console.log("  ipi:", result.lp.ipi);
console.log("  federalTotal:", result.lp.federalTotal);
console.log("  municipalTotal:", result.lp.municipalTotal);
console.log("  total:", result.lp.total);
