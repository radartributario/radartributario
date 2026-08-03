import assert from "node:assert";
import { describe, it } from "node:test";
import { form, loadEngine, money, pct, pdfFor } from "./helpers/tributaryAuditHelpers.mjs";

const engine = loadEngine();

function htmlText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function assertIncludesAll(html, expected, context) {
  const missing = [];
  for (const item of expected) {
    if (item == null || item === "") continue;
    if (item === "R$ 0,00" || item === "0,00%" || item === "NaN%") continue;
    if (!html.includes(String(item))) missing.push(String(item));
  }
  assert.deepStrictEqual(missing, [], `${context}: valores ausentes no PDF`);
}

function tableCells(html) {
  const cells = [];
  const re = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let match;
  while ((match = re.exec(html))) cells.push(htmlText(match[1]));
  return cells;
}

function assertNoEmptyTableCells(html, context) {
  const invalid = tableCells(html).filter((cell) => !cell || /undefined|NaN|Infinity|null/i.test(cell));
  assert.deepStrictEqual(invalid, [], `${context}: celulas vazias ou invalidas em tabela`);
}

function assertStructure(html, context) {
  assert.ok(html.includes("Resultado Executivo") || html.includes("RESULTADO EXECUTIVO"), `${context}: Resultado Executivo ausente`);
  assert.ok(html.includes("Memória Resumida"), `${context}: Memória Resumida ausente`);
  assert.ok(html.includes("ANEXO TÉCNICO – MEMÓRIA DE CÁLCULO"), `${context}: Anexo Tecnico ausente`);
  assert.ok(html.includes("Conclusão Executiva") || html.includes("CONCLUSÃO EXECUTIVA") || html.includes("Conclusão"), `${context}: Conclusao ausente`);
  assert.ok(html.includes("Premissas"), `${context}: Premissas ausentes`);
  assert.ok(html.includes("CompareTributo®"), `${context}: rodape sem marca`);
  assert.ok(html.includes("https://comparetributo.com.br"), `${context}: rodape sem dominio oficial`);
  assert.ok(html.includes("Relatório gerado automaticamente pelo CompareTributo"), `${context}: texto automatico do rodape ausente`);
  assertNoEmptyTableCells(html, context);
}

function lpBaseValues(lp) {
  const values = [money(lp.baseIRPJ), money(lp.baseCSLL)];
  if (lp.baseAdic > 0) values.push(money(lp.baseAdic));
  if (Number.isFinite(lp.presIRPJ)) values.push(pct(lp.presIRPJ));
  if (Number.isFinite(lp.presCSLL)) values.push(pct(lp.presCSLL));
  for (const detail of [lp.basePresumidaIRPJDetalhe, lp.basePresumidaCSLLDetalhe]) {
    if (!detail) continue;
    values.push(
      money(detail.receitaNormal),
      pct(detail.presuncaoNormal * 100),
      money(detail.baseNormal),
      money(detail.baseTotal),
    );
    if (detail.receitaExcedente > 0) {
      values.push(money(detail.receitaExcedente), pct(detail.presuncaoMajorada * 100), money(detail.baseMajorada));
    }
  }
  return values;
}

function assertNoTaxRowsForScenario(html, scenario, context) {
  if (scenario === "comercio") {
    assert.ok(!html.includes("IPI</td><td") && !html.includes("IPI</th>"), `${context}: comercio nao deve exibir IPI zerado como tributo`);
  }
  if (scenario === "servicos") {
    assert.ok(!html.includes("ICMS</td><td") && !html.includes("ICMS</th>"), `${context}: servicos nao deve exibir ICMS como tributo`);
  }
}

const scenarios = {
  comercio: form({
    rbt12Input: "6.100.000,00",
    comprasInput: "2.200.000,00",
    tipoAtivLP: "comercio",
    cnae: "4711-3/00",
    aliquotaICMS: "18",
    aliquotaISS: "0",
    aliquotaIPI: "0",
    anoSIM: "2027",
  }),
  servicos: form({
    rbt12Input: "6.100.000,00",
    comprasInput: "800.000,00",
    tipoAtivLP: "servicos",
    cnae: "7020-4/00",
    aliquotaICMS: "0",
    aliquotaISS: "5",
    aliquotaIPI: "0",
    anoSIM: "2027",
  }),
  industria: form({
    rbt12Input: "3.000.000,00",
    comprasInput: "1.000.000,00",
    tipoAtivLP: "industria",
    cnae: "1012-1/00",
    aliquotaICMS: "12",
    aliquotaISS: "0",
    aliquotaIPI: "5",
    anoSIM: "2027",
  }),
};

describe("Homologacao completa dos PDFs", () => {
  it("Simples Nacional x Lucro Presumido: tela/motor/memoria/PDF consistentes", async () => {
    for (const [scenario, input] of Object.entries(scenarios)) {
      const result = engine.calcularComparacaoSimplesPresumido(input);
      const html = await pdfFor(engine, result, input);
      assertStructure(html, `SN x LP ${scenario}`);
      assertIncludesAll(html, [
        money(result.sn.total),
        money(result.sn.dasAnual || result.sn.das),
        pct(result.sn.aliquota),
        result.sn.anexo,
        money(result.lp.total),
        pct(result.lp.aliquota),
        money(result.lp.irpj15),
        money(result.lp.irpjAdic),
        money(result.lp.csll),
        money(result.lp.pisCofins),
        money(result.lp.icms),
        money(result.lp.iss),
        money(result.lp.ipi),
        money(result.kpi.economia),
        money(result.kpi.economia / 12),
        result.conclusao.vencedor,
        ...lpBaseValues(result.lp),
      ], `SN x LP ${scenario}`);
      assertNoTaxRowsForScenario(html, scenario, `SN x LP ${scenario}`);
    }
  });

  it("Simples Tradicional x Simples Hibrido: tela/motor/memoria/PDF consistentes", async () => {
    for (const [scenario, input] of Object.entries({ comercio: scenarios.comercio, servicos: scenarios.servicos })) {
      const result = engine.calcularComparacaoSimplesHibrido(input);
      const html = await pdfFor(engine, result, input);
      assertStructure(html, `Hibrido ${scenario}`);
      assertIncludesAll(html, [
        money(result.simplesTradicional.total),
        money(result.simplesTradicional.das || result.simplesTradicional.total),
        pct(result.simplesTradicional.aliquota),
        money(result.simplesHibrido.dasIntegral),
        money(result.simplesHibrido.parcelaCbsRetiradaDoDas),
        money(result.simplesHibrido.dasReduzido),
        money(result.CBS.debito),
        money(result.CBS.credito),
        money(result.CBS.liquida),
        pct(result.CBS.aliq),
        pct(result.CBS.aliqCompras),
        money(result.simplesHibrido.total),
        money(result.comparacaoFinanceira.valorAnual),
        money(result.comparacaoFinanceira.valorMensal),
        pct(result.comparacaoFinanceira.percentual),
        result.comparacaoFinanceira.tipo === "AUMENTO" ? "Aumento de carga" : "Economia anual",
      ], `Hibrido ${scenario}`);
      assert.ok(!html.includes("PIS/COFINS</td><td"), `Hibrido ${scenario}: nao deve exibir PIS/COFINS como tributo vigente`);
      assert.ok(html.includes("IBS (2027)"), `Hibrido ${scenario}: premissa IBS 2027 ausente`);
    }
  });

  it("Lucro Presumido Atual x Reforma Tributaria: tela/motor/memoria/PDF consistentes", async () => {
    for (const [scenario, input] of Object.entries(scenarios)) {
      const result = engine.calcularComparacaoPresumidoReforma(input);
      const html = await pdfFor(engine, result, input);
      assertStructure(html, `Reforma ${scenario}`);
      assertIncludesAll(html, [
        money(result.lucroPresumidoAtual.total),
        pct(result.lucroPresumidoAtual.aliquota),
        money(result.lucroPresumidoAtual.irpj15),
        money(result.lucroPresumidoAtual.irpjAdic),
        money(result.lucroPresumidoAtual.csll),
        money(result.lucroPresumidoAtual.pisCofins),
        money(result.lucroPresumidoAtual.icms),
        money(result.lucroPresumidoAtual.iss),
        money(result.lucroPresumidoAtual.ipi),
        money(result.cenarioFuturo.total),
        pct(result.cenarioFuturo.aliquotaTotal),
        money(result.CBS.debito),
        money(result.CBS.credito),
        money(result.CBS.liquida),
        pct(result.CBS.aliq),
        money(result.IBS.debito),
        money(result.IBS.credito),
        money(result.IBS.liquido),
        pct(result.IBS.aliq),
        money(result.comparacao.valorAnual),
        pct(result.comparacao.percentual),
        ...lpBaseValues(result.lucroPresumidoAtual),
      ], `Reforma ${scenario}`);
      assertNoTaxRowsForScenario(html, scenario, `Reforma ${scenario}`);
    }
  });
});
