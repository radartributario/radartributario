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

// Extract code up to (but not including) the init calls at the very end
// Find "// ===== INIT =====" and stop there - init code does DOM manipulation
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
    "; return { getIbsAliq2027, getSNParams, getAnexoSN, getSNParcelaIcmsIss, calcularSN, calcularLP, calcularCBS, calcularIBS, calcularImpacto, calcularComparacaoSimplesHibrido, calcularComparacaoPresumidoReforma, calcularComparacaoSimplesPresumido, checkEligibility, buildPdfHtmlFromObject };"
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
    refAliqCbs: "8.8",
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
    aliqCbsFora: "8.8",
    anoSIM: "2027",
    ...overrides,
  };
}

async function pdfHtmlFor(result, formData) {
  return new Promise(resolve => engine.buildPdfHtmlFromObject(result, formData, resolve));
}

describe("Transição 2027 — IBS", () => {
  it("TESTE 1: IBS 2027 = 0,10%, débito = R$ 1.200,00", () => {
    const aliq = engine.getIbsAliq2027();
    assert.strictEqual(aliq, 0.001, "IBS alíquota deve ser 0,10% (0.001)");
    const debito = 1_200_000 * aliq;
    assert.strictEqual(debito, 1200, "IBS débito = 1.200.000 × 0,10% = R$ 1.200,00");
    assert.notStrictEqual(debito, 115200, "NÃO pode ser R$ 115.200,00 (9,60%)");
  });

  it("TESTE 2: crédito IBS 2027 com 0,10%", () => {
    const aliq = engine.getIbsAliq2027();
    const credito = 200_000 * aliq;
    const liquido = Math.max(0, 1_200_000 * aliq - credito);
    assert.strictEqual(credito, 200, "Crédito IBS = 200.000 × 0,10% = R$ 200,00");
    assert.strictEqual(liquido, 1000, "IBS líquido = 1.200 - 200 = R$ 1.000,00");
    assert.notStrictEqual(credito, 19200, "NÃO pode ser R$ 19.200,00 (9,60%)");
    assert.notStrictEqual(liquido, 96000, "NÃO pode ser R$ 96.000,00 (9,60%)");
  });

});

describe("Transição 2027 — CBS mantida em 8,80%", () => {
  it("CBS permanece 8,80% no módulo híbrido", () => {
    const result = engine.calcularComparacaoSimplesHibrido(fd());
    if (result.error) throw new Error(result.error);
    assert.ok(result.CBS.aliq === 8.8, "CBS alíquota = 8,80%");
  });

  it("CBS permanece 8,80% no módulo reforma", () => {
    const result = engine.calcularComparacaoPresumidoReforma(fd());
    if (result.error) throw new Error(result.error);
    assert.ok(result.CBS.aliq === 8.8, "CBS alíquota = 8,80%");
  });
});

describe("Transição 2027 — Simples Híbrido (IBS desligado por premissa funcional)", () => {
  it("Simples Híbrido 2027: IBS = 0 por premissa funcional do simulador", () => {
    const result = engine.calcularComparacaoSimplesHibrido(fd());
    if (result.error) throw new Error(result.error);
    assert.strictEqual(result.statusCalculo, "OK", "statusCalculo = OK");
    assert.strictEqual(result.IBS.aliquota, 0, "IBS aliquota = 0");
    assert.strictEqual(result.IBS.debito, 0, "IBS débito = 0");
    assert.strictEqual(result.IBS.credito, 0, "IBS crédito = 0");
    assert.strictEqual(result.IBS.liquido, 0, "IBS líquido = 0");
    assert.strictEqual(result.simplesHibrido.ibsLiquido, 0, "IBS líquido = 0 em 2027");
    assert.strictEqual(result.simplesHibrido.parcelaIbsRetiradaDoDas, 0, "Parcela IBS retirada do DAS = 0");
  });

  it("Simples Híbrido 2027: total híbrido usa CBS líquida e não inclui IBS", () => {
    const result = engine.calcularComparacaoSimplesHibrido(fd());
    if (result.error) throw new Error(result.error);
    const hib = result.simplesHibrido;
    assert.ok(hib.total > 0, "Total híbrido > 0");
    assert.ok(hib.cbsLiquida > 0, "CBS líquida > 0");
    const semIbs = hib.dasReduzido + result.CBS.liquida + hib.encargos;
    assert.strictEqual(hib.total, semIbs, "Total híbrido = DAS reduzido + CBS líquida + encargos");
  });

  it("Simples Híbrido 2027: premissas e CBS.aliqCompras permanecem no contrato", () => {
    const result = engine.calcularComparacaoSimplesHibrido(fd());
    if (result.error) throw new Error(result.error);
    const premissas = result.premissas;
    assert.ok(premissas, "premissas presentes");
    assert.strictEqual(result.CBS.aliqCompras, 8.8, "CBS.aliqCompras presente");
    assert.ok(result.simplesHibrido.aliquota !== premissas.aliqCbs, "Alíquota total ≠ alíquota CBS");
  });

  it("Simples Híbrido 2027: DAS reduzido = DAS integral - CBS retirada", () => {
    const result = engine.calcularComparacaoSimplesHibrido(fd());
    if (result.error) throw new Error(result.error);
    const hib = result.simplesHibrido;
    const expected = hib.dasIntegral - hib.parcelaCbsRetiradaDoDas; // IBS = 0 em 2027
    assert.strictEqual(hib.dasReduzido, expected, "DAS reduzido = DAS integral - CBS");
    assert.ok(hib.dasReduzido < hib.dasIntegral, "DAS reduzido < DAS integral (CBS foi retirada)");
  });

  it("memória de cálculo completa presente", () => {
    const result = engine.calcularComparacaoSimplesHibrido(fd());
    if (result.error) throw new Error(result.error);
    const mem = result.memoriaCalculo;
    assert.ok(mem.das, "Memória DAS presente");
    assert.ok(mem.cbs, "Memória CBS presente");
    assert.ok(mem.total, "Memória total presente");
  });

  it("Simples Híbrido 2027: estrutura IBS existe e permanece zerada", () => {
    const result = engine.calcularComparacaoSimplesHibrido(fd());
    if (result.error) throw new Error(result.error);
    assert.ok(result.IBS, "result.IBS deve existir");
    assert.strictEqual(result.IBS.aliquota, 0, "IBS alíquota = 0");
    assert.strictEqual(result.IBS.debito, 0, "IBS débito = 0");
    assert.strictEqual(result.IBS.credito, 0, "IBS crédito = 0");
    assert.strictEqual(result.IBS.liquido, 0, "IBS líquido = 0");
  });

  it("Simples Híbrido 2027: IBS não altera total, média, alíquota ou impacto", () => {
    const result = engine.calcularComparacaoSimplesHibrido(fd());
    if (result.error) throw new Error(result.error);
    assert.ok(result.IBS, "IBS object existe");
    assert.strictEqual(result.IBS.liquido, 0, "IBS.liquido = 0 → sem contribuição ao total");
    assert.strictEqual(result.statusCalculo, "OK", "statusCalculo = OK (consistência do motor)");
    // Total não é alterado por IBS: dasReduzido + CBS.liquida + encargos
    const semIbs = result.simplesHibrido.dasReduzido + result.CBS.liquida + result.simplesHibrido.encargos;
    assert.strictEqual(result.simplesHibrido.total, semIbs,
      "Total = soma dos componentes não-IBS");
    assert.strictEqual(result.simplesHibrido.media, result.simplesHibrido.total / 12);
    assert.strictEqual(result.simplesHibrido.aliquota, result.simplesHibrido.total / result.simplesTradicional.rbt12 * 100);
  });
});

describe("Transição 2027 — Módulo LP × Reforma", () => {
  it("deve incluir IBS de 0,10% no cenário futuro", () => {
    const result = engine.calcularComparacaoPresumidoReforma(fd());
    if (result.error) throw new Error(result.error);
    assert.ok(result.cenarioFuturo.ibs !== undefined, "IBS presente");
    assert.strictEqual(result.IBS.aliq, 0.1, "IBS alíquota = 0,10%");
  });

  it("PIS/COFINS = 0 no cenário futuro", () => {
    const result = engine.calcularComparacaoPresumidoReforma(fd());
    if (result.error) throw new Error(result.error);
    assert.strictEqual(result.cenarioFuturo.pisCofins, 0, "PIS/COFINS = 0");
  });

  it("ISS e ICMS mantidos no cenário futuro", () => {
    const result = engine.calcularComparacaoPresumidoReforma(fd());
    if (result.error) throw new Error(result.error);
    const fut = result.cenarioFuturo;
    const lp = result.lucroPresumidoAtual;
    if (lp.iss > 0) assert.ok(fut.iss > 0, "ISS mantido");
    if (lp.icms > 0) assert.ok(fut.icms > 0, "ICMS mantido");
  });

  it("Total futuro = atual - PIS/COFINS - IPI + CBS + IBS", () => {
    const result = engine.calcularComparacaoPresumidoReforma(fd());
    if (result.error) throw new Error(result.error);
    const lp = result.lucroPresumidoAtual;
    const fut = result.cenarioFuturo;
    const cbs = result.CBS;
    const ibs = result.IBS;
    const esperado = lp.total - lp.pisCofins - (lp.ipi || 0) + cbs.liquida + ibs.liquido;
    assert.ok(Math.abs(fut.total - esperado) < 0.02, "Fórmula correta");
  });

  it("statusCalculo = OK", () => {
    const result = engine.calcularComparacaoPresumidoReforma(fd());
    if (result.error) throw new Error(result.error);
    assert.strictEqual(result.statusCalculo, "OK");
  });

  it("contabilidade sem confirmação mantém cenário sem benefício em R$ 243.560,00", () => {
    const result = engine.calcularComparacaoPresumidoReforma(fd({ cnae: "6920-6/01" }));
    if (result.error) throw new Error(result.error);
    assert.strictEqual(result.premissas.beneficioProfissional.status, "PENDENTE");
    assert.strictEqual(result.cenarioFuturo.total, 243560);
    assert.strictEqual(result.CBS.liquida, 88000.00000000001);
    assert.strictEqual(result.IBS.liquido, 1000);
    assert.ok(result.cenariosBeneficio, "deve retornar cenários condicionado com/sem benefício");
  });

  it("contabilidade com requisitos confirmados aplica redução de 30% na CBS e no IBS", () => {
    const result = engine.calcularComparacaoPresumidoReforma(fd({
      cnae: "6920-6/01",
      benefReqProfissionais: "sim",
      benefReqSemSocioPJ: "sim",
      benefReqNaoParticipaPJ: "sim",
      benefReqExclusiva: "sim",
      benefReqDireta: "sim",
    }));
    if (result.error) throw new Error(result.error);
    assert.strictEqual(result.premissas.beneficioProfissional.status, "APLICADO");
    assert.strictEqual(result.CBS.aliq, 6.16);
    assert.strictEqual(result.CBS.debito, 73920);
    assert.strictEqual(result.CBS.credito, 17600);
    assert.strictEqual(result.CBS.liquida, 56320);
    assert.ok(Math.abs(result.IBS.aliq - 0.07) < 0.0001);
    assert.strictEqual(result.IBS.debito, 840);
    assert.strictEqual(result.IBS.credito, 200);
    assert.strictEqual(result.IBS.liquido, 640);
    assert.strictEqual(result.cenarioFuturo.total, 211520);
  });

  it("contabilidade com requisito negado não aplica benefício profissional", () => {
    const result = engine.calcularComparacaoPresumidoReforma(fd({ cnae: "6920601", benefReqProfissionais: "nao" }));
    if (result.error) throw new Error(result.error);
    assert.strictEqual(result.premissas.beneficioProfissional.status, "NAO_APLICADO");
    assert.strictEqual(result.CBS.aliq, 8.8);
    assert.strictEqual(result.IBS.aliq, 0.1);
    assert.strictEqual(result.cenarioFuturo.total, 243560);
    assert.strictEqual(result.cenariosBeneficio, null);
  });

  it("contabilidade pendente informa cenários com e sem benefício sem perder comparação financeira", () => {
    const result = engine.calcularComparacaoPresumidoReforma(fd({ cnae: "69206" }));
    if (result.error) throw new Error(result.error);
    assert.strictEqual(result.premissas.cbsNomenclatura.base, "CBS sobre prestação de serviços");
    assert.strictEqual(result.premissas.ibsNomenclatura.base, "IBS sobre prestação de serviços");
    assert.strictEqual(result.cenariosBeneficio.comBeneficioConfirmado.total, 211520);
    assert.strictEqual(result.cenariosBeneficio.semBeneficioConfirmado.total, 243560);
    assert.strictEqual(result.comparacaoFinanceira.valorAnual, 45200);
  });

  it("regressão visual: valores principais e impactos do cenário pendente", () => {
    const result = engine.calcularComparacaoPresumidoReforma(fd({ cnae: "6920-6/01" }));
    if (result.error) throw new Error(result.error);
    const atual = result.lucroPresumidoAtual;
    const com = result.cenariosBeneficio.comBeneficioConfirmado;
    const sem = result.cenariosBeneficio.semBeneficioConfirmado;
    assert.strictEqual(atual.total, 198360);
    assert.strictEqual(atual.aliquota, 16.53);
    assert.strictEqual(atual.media, 16530);
    assert.strictEqual(atual.iss, 30000);
    assert.strictEqual(com.total, 211520);
    assert.ok(Math.abs(com.aliquotaTotal - 17.6266666667) < 0.0001);
    assert.strictEqual(sem.total, 243560);
    assert.ok(Math.abs(sem.aliquotaTotal - 20.2966666667) < 0.0001);
    assert.strictEqual(com.total - atual.total, 13160);
    assert.ok(Math.abs((com.total - atual.total) / atual.total * 100 - 6.6344020972) < 0.0001);
    assert.strictEqual(sem.total - atual.total, 45200);
    assert.ok(Math.abs((sem.total - atual.total) / atual.total * 100 - 22.786852188) < 0.0001);
  });

  it("detalhamento LP atual retorna PIS, Cofins e bases para memória", () => {
    const result = engine.calcularComparacaoPresumidoReforma(fd({ cnae: "6920-6/01" }));
    if (result.error) throw new Error(result.error);
    const atual = result.lucroPresumidoAtual;
    assert.strictEqual(atual.baseIRPJ, 384000);
    assert.strictEqual(atual.baseAdic, 324000);
    assert.strictEqual(atual.baseCSLL, 384000);
    assert.strictEqual(atual.irpj15, 57600);
    assert.strictEqual(atual.irpjAdic, 32400);
    assert.strictEqual(atual.csll, 34560);
    assert.strictEqual(atual.pis, 7800);
    assert.strictEqual(atual.cofins, 36000);
  });

  it("PDF pendente mostra os dois cenários e não define total futuro único", async () => {
    const result = engine.calcularComparacaoPresumidoReforma(fd({ cnae: "6920-6/01" }));
    if (result.error) throw new Error(result.error);
    const html = await new Promise(resolve => engine.buildPdfHtmlFromObject(result, fd({ cnae: "6920-6/01", atividade: "Serviços contábeis" }), resolve));
    assert.match(html, /Benefício Fiscal/);
    assert.match(html, /LC 214\/2025/);
    assert.doesNotMatch(html, /30% da carga tributária/);
    assert.match(html, /Resultado condicionado/);
    assert.match(html, /Pós-Reforma com benefício/);
    assert.match(html, /Pós-Reforma sem benefício/);
    assert.match(html, /R\$ 211\.520,00/);
    assert.match(html, /R\$ 243\.560,00/);
    assert.doesNotMatch(html, /Regime\/cenário favorecido/);
  });

  it("PDF confirmado omite cenário sem benefício", async () => {
    const confirmado = fd({
      cnae: "6920-6/01",
      atividade: "Serviços contábeis",
      benefReqProfissionais: "sim",
      benefReqSemSocioPJ: "sim",
      benefReqNaoParticipaPJ: "sim",
      benefReqExclusiva: "sim",
      benefReqDireta: "sim",
    });
    const result = engine.calcularComparacaoPresumidoReforma(confirmado);
    if (result.error) throw new Error(result.error);
    const html = await new Promise(resolve => engine.buildPdfHtmlFromObject(result, confirmado, resolve));
    assert.match(html, /R\$ 211\.520,00/);
    assert.doesNotMatch(html, /Pós-Reforma sem benefício/);
    assert.doesNotMatch(html, /R\$ 243\.560,00/);
  });

  it("PDF negado omite cenário com benefício", async () => {
    const negado = fd({ cnae: "6920-6/01", atividade: "Serviços contábeis", benefReqProfissionais: "nao" });
    const result = engine.calcularComparacaoPresumidoReforma(negado);
    if (result.error) throw new Error(result.error);
    const html = await new Promise(resolve => engine.buildPdfHtmlFromObject(result, negado, resolve));
    assert.match(html, /R\$ 243\.560,00/);
    assert.doesNotMatch(html, /Pós-Reforma com benefício/);
    assert.doesNotMatch(html, /R\$ 211\.520,00/);
  });

  it("PDF contém memória CBS/IBS de serviços e não usa bloco de impacto financeiro", async () => {
    const result = engine.calcularComparacaoPresumidoReforma(fd({ cnae: "6920-6/01", benefReqProfissionais: "nao" }));
    if (result.error) throw new Error(result.error);
    const html = await new Promise(resolve => engine.buildPdfHtmlFromObject(result, fd({ cnae: "6920-6/01", atividade: "Serviços contábeis", benefReqProfissionais: "nao" }), resolve));
    assert.match(html, />CBS<\/td><td class="num">/);
    assert.match(html, />IBS<\/td><td class="num">/);
    assert.match(html, /representando um aumento de \d+,\d+ pontos percentuais|representando uma redução de \d+,\d+ pontos percentuais|sem variação relevante de carga/);
    assert.match(html, /Carga Atual|Nova Carga/);
    assert.match(html, />ISS<\/td><td class="num">/);
    assert.doesNotMatch(html, /Impacto financeiro/);
    assert.doesNotMatch(html, /ISS transitório/);
    assert.doesNotMatch(html, /Economia anual/);
  });
});

describe("Memória Resumida dinâmica no PDF", () => {
  it("comércio exibe ICMS e oculta ISS/IPI sem incidência", async () => {
    const data = fd({ cnae: "4789-0/99", tipoAtivLP: "comercio", segregacao: "0", aliquotaISS: "0", aliquotaICMS: "18", aliquotaIPI: "0" });
    const result = engine.calcularComparacaoSimplesPresumido(data);
    if (result.error) throw new Error(result.error);
    const html = await pdfHtmlFor(result, data);
    assert.match(html, />ICMS<\/td><td class="num">/);
    assert.doesNotMatch(html, />ISS<\/td><td class="num">/);
    assert.doesNotMatch(html, />IPI<\/td><td class="num">/);
  });

  it("serviços exibe ISS e oculta ICMS", async () => {
    const data = fd({ cnae: "6920-6/01", tipoAtivLP: "servicos", segregacao: "100", aliquotaISS: "2.5", aliquotaICMS: "0" });
    const result = engine.calcularComparacaoSimplesPresumido(data);
    if (result.error) throw new Error(result.error);
    const html = await pdfHtmlFor(result, data);
    assert.match(html, />ISS<\/td><td class="num">/);
    assert.doesNotMatch(html, />ICMS<\/td><td class="num">/);
  });

  it("indústria exibe ICMS e IPI", async () => {
    const data = fd({ cnae: "1012-1/00", tipoAtivLP: "industria", segregacao: "0", aliquotaISS: "0", aliquotaICMS: "18", aliquotaIPI: "5" });
    const result = engine.calcularComparacaoSimplesPresumido(data);
    if (result.error) throw new Error(result.error);
    const html = await pdfHtmlFor(result, data);
    assert.match(html, />ICMS<\/td><td class="num">/);
    assert.match(html, />IPI<\/td><td class="num">/);
  });

  it("IRPJ Adicional aparece somente quando há incidência", async () => {
    const comAdicional = fd({ cnae: "6920-6/01", tipoAtivLP: "servicos", rbt12Input: "1.200.000,00" });
    const semAdicional = fd({ cnae: "4789-0/99", tipoAtivLP: "comercio", segregacao: "0", rbt12Input: "500.000,00", aliquotaICMS: "18", aliquotaISS: "0" });
    const resultCom = engine.calcularComparacaoSimplesPresumido(comAdicional);
    const resultSem = engine.calcularComparacaoSimplesPresumido(semAdicional);
    if (resultCom.error) throw new Error(resultCom.error);
    if (resultSem.error) throw new Error(resultSem.error);
    const htmlCom = await pdfHtmlFor(resultCom, comAdicional);
    const htmlSem = await pdfHtmlFor(resultSem, semAdicional);
    assert.match(htmlCom, />IRPJ Adicional<\/td><td class="num">/);
    assert.doesNotMatch(htmlSem, />IRPJ Adicional<\/td><td class="num">/);
  });
});

describe("TESTE 5 — Isolamento: SN×LP sem CBS/IBS", () => {
  it("módulo Simples × Lucro Presumido não contém CBS/IBS", () => {
    const result = engine.calcularComparacaoSimplesPresumido(fd());
    if (result.error) throw new Error(result.error);
    assert.strictEqual(result.CBS, undefined, "CBS não deve existir");
    assert.strictEqual(result.IBS, undefined, "IBS não deve existir");
    assert.strictEqual(result.cbsParcial, undefined, "cbsParcial não deve existir");
    assert.ok(result.sn, "Resultado deve ter sn");
    assert.ok(result.lp, "Resultado deve ter lp");
    assert.strictEqual(result.sn.total > 0, true, "SN total > 0");
    assert.strictEqual(result.lp.total > 0, true, "LP total > 0");
    assert.strictEqual(typeof result.sublimite, "object", "sublimite presente");
  });
});

describe("TESTE 8 — Créditos ≤ 100%", () => {
  it("otimista = null quando provável = 100%", () => {
    const result = engine.calcularComparacaoPresumidoReforma(fd({ refCredPct: "100" }));
    if (result.error) throw new Error(result.error);
    assert.strictEqual(result.cenariosCredito.otimista, null, "Otimista = null");
  });

  it("otimista existe quando provável < 100%", () => {
    const result = engine.calcularComparacaoPresumidoReforma(fd({ refCredPct: "80" }));
    if (result.error) throw new Error(result.error);
    assert.ok(result.cenariosCredito.otimista, "Otimista existe");
  });
});

// ===== SUBLIMITE TESTS =====
function fdSN(overrides = {}) {
  return {
    rbt12Input: "4.000.000,00",
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
    anoSIM: "2027",
    refCredPct: "100",
    ...overrides,
  };
}

describe("TESTE S1 — Impedimento j\u00E1 vigente", () => {
  it("receita ano anterior > sublimite", () => {
    const result = engine.calcularComparacaoSimplesPresumido(fdSN({ receitaAnoAnterior: "4000000" }));
    if (result.error) throw new Error(result.error);
    assert.strictEqual(result.sublimite.status, "IMPEDIMENTO_JA_VIGENTE");
    assert.strictEqual(result.sublimite.issForaDoDas, true);
    assert.strictEqual(result.sn.sublimiteIss, true);
    assert.strictEqual(result.sn.sublimiteValor > 0, true);
    // Validate DAS and SN total for R$4M, Anexo III, 6ª faixa
    assert.ok(Math.abs(result.sn.dasAnual - 672000) < 2, "DAS anual ~ R$ 672.000 (33% - R$648.000)");
    assert.ok(Math.abs(result.sn.total - 772000) < 2, "SN total ~ R$ 772.000 (DAS + ISS)");
    assert.ok(Math.abs(result.lp.total - 675200) < 2, "LP total ~ R$ 675.200");
  });
});

describe("TESTE S2 — Excesso no pr\u00F3prio ano em at\u00E9 20%", () => {
  it("receita acumulada entre 3,6M e 4,32M, ano anterior < sublimite", () => {
    const result = engine.calcularComparacaoSimplesPresumido(fdSN({ receitaAcumulada: "4000000", receitaAnoAnterior: "3000000" }));
    if (result.error) throw new Error(result.error);
    assert.strictEqual(result.sublimite.status, "IMPEDIMENTO_ANO_SEGUINTE");
    assert.strictEqual(result.sublimite.issForaDoDas, false);
    assert.strictEqual(result.sn.sublimiteIss, false);
  });
});

describe("TESTE S3 — Excesso superior a 20%", () => {
  it("receita acumulada > R$ 4.320.000,00", () => {
    const result = engine.calcularComparacaoSimplesPresumido(fdSN({ receitaAcumulada: "4500000", receitaAnoAnterior: "3000000", mesUltrapassagem: "10" }));
    if (result.error) throw new Error(result.error);
    assert.strictEqual(result.sublimite.status, "IMPEDIMENTO_MES_SEGUINTE");
    assert.strictEqual(result.sublimite.issForaDoDas, false);
    assert.ok(result.sublimite.dataInicioEfeito.includes("11"), "Efeitos no mês 11 (mês seguinte ao mês 10)");
  });
});

describe("TESTE S4 — Aus\u00EAncia de hist\u00F3rico", () => {
  it("RBT12 > sublimite mas sem dados hist\u00F3ricos", () => {
    const result = engine.calcularComparacaoSimplesPresumido(fdSN());
    if (result.error) throw new Error(result.error);
    assert.strictEqual(result.statusCalculo, "DADOS_INSUFICIENTES");
    assert.strictEqual(result.sublimite.status, "DADOS_INSUFICIENTES");
    assert.strictEqual(result.sublimite.issForaDoDas, false);
    assert.strictEqual(result.conclusao.vencedor, "\u2014", "Sem vencedor quando insuficiente");
  });
});

describe("TESTE S5 — Isolamento SN×LP", () => {
  it("resultado n\u00E3o cont\u00E9m CBS/IBS/reforma", () => {
    const result = engine.calcularComparacaoSimplesPresumido(fdSN({ receitaAnoAnterior: "4000000" }));
    if (result.error) throw new Error(result.error);
    assert.strictEqual(result.CBS, undefined, "CBS n\u00E3o deve existir");
    assert.strictEqual(result.IBS, undefined, "IBS n\u00E3o deve existir");
    assert.strictEqual(result.cbsParcial, undefined, "cbsParcial n\u00E3o deve existir");
    assert.strictEqual(result.reformaTotais, undefined, "reformaTotais n\u00E3o deve existir");
    assert.strictEqual(result.reformaResumo, undefined, "reformaResumo n\u00E3o deve existir");
    assert.strictEqual(result.snHibrido, undefined, "snHibrido n\u00E3o deve existir");
  });
});

describe("TESTE S6 — Lucro Presumido", () => {
  it("componentes LP batem com R$ 4.000.000,00 servi\u00E7os 32%", () => {
    const result = engine.calcularComparacaoSimplesPresumido(fdSN({ receitaAnoAnterior: "4000000" }));
    if (result.error) throw new Error(result.error);
    assert.ok(Math.abs(result.lp.irpj15 - 192000) < 2, "IRPJ 15% = R$ 192.000 (1.280.000 x 15%)");
    assert.ok(Math.abs(result.lp.irpjAdic - 122000) < 2, "IRPJ Adicional = R$ 122.000");
    assert.ok(Math.abs(result.lp.csll - 115200) < 2, "CSLL = R$ 115.200");
    assert.ok(Math.abs(result.lp.pisCofins - 146000) < 2, "PIS/COFINS = R$ 146.000 (3,65%)");
    assert.ok(Math.abs(result.lp.iss - 100000) < 2, "ISS = R$ 100.000 (2,5% de R$ 4.000.000)");
    assert.ok(Math.abs(result.lp.total - 675200) < 2, "LP total = R$ 675.200");
  });
});

console.log("✅ All transition tests passed");
