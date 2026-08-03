import { describe, it } from "node:test";
import assert from "node:assert";
import {
  form,
  loadEngine,
  pdfFor,
  stableHibridoSnapshot,
  stableReformaSnapshot,
  stableSnLpSnapshot,
} from "./helpers/tributaryAuditHelpers.mjs";

const engine = loadEngine();

describe("Regressao visual estrutural - snapshots comerciais", () => {
  it("snapshot Simples x Lucro Presumido", async () => {
    const input = form();
    const result = engine.calcularComparacaoSimplesPresumido(input);
    const pdf = await pdfFor(engine, result, input);
    assert.deepStrictEqual({
      cards: stableSnLpSnapshot(result),
      secoesPdf: {
        resultadoExecutivo: pdf.includes("Resultado Executivo"),
        memoriaResumida: pdf.includes("Memória Resumida"),
        conclusao: pdf.includes("Conclusão Executiva"),
        cardSimples: pdf.includes("Simples Nacional"),
        cardPresumido: pdf.includes("Lucro Presumido"),
      },
    }, {
      cards: {
        modulo: "SIMPLES_VS_PRESUMIDO",
        sn: { total: 198700, das: 198700, aliquota: 9.94, anexo: "Anexo I" },
        lp: { total: 344600, baseIRPJ: 160000, baseCSLL: 240000, irpj15: 24000, irpjAdic: 10000, csll: 21600, pisCofins: 73000, icms: 216000, iss: 0, ipi: 0 },
        decisao: { vencedor: "Simples Nacional", economia: 145900 },
      },
      secoesPdf: { resultadoExecutivo: true, memoriaResumida: true, conclusao: true, cardSimples: true, cardPresumido: true },
    });
  });

  it("snapshot Simples x Hibrido", async () => {
    const input = form();
    const result = engine.calcularComparacaoSimplesHibrido(input);
    const pdf = await pdfFor(engine, result, input);
    assert.deepStrictEqual({
      cards: stableHibridoSnapshot(result),
      secoesPdf: {
        resultadoExecutivo: pdf.includes("RESULTADO EXECUTIVO") || pdf.includes("Resultado Executivo"),
        memoriaCalculo: pdf.includes("CBS líquida") && pdf.includes("DAS reduzido"),
        conclusao: pdf.includes("menor carga tributária") || pdf.includes("menor carga"),
        cardTradicional: pdf.includes("Simples Tradicional"),
        cardHibrido: pdf.includes("Simples Híbrido"),
      },
    }, {
      cards: {
        modulo: "SIMPLES_TRADICIONAL_VS_HIBRIDO",
        tradicional: { total: 198700, das: 198700, aliquota: 9.94 },
        hibrido: { total: 271693.33, dasReduzido: 166093.33, cbsLiquida: 105600, ibsLiquido: 0 },
        decisao: { vencedor: "Simples tradicional", tipo: "AUMENTO", valor: 72993.33 },
      },
      secoesPdf: { resultadoExecutivo: true, memoriaCalculo: true, conclusao: true, cardTradicional: true, cardHibrido: true },
    });
  });

  it("snapshot Lucro Presumido x Reforma", async () => {
    const input = form();
    const result = engine.calcularComparacaoPresumidoReforma(input);
    const pdf = await pdfFor(engine, result, input);
    assert.deepStrictEqual({
      cards: stableReformaSnapshot(result),
      secoesPdf: {
        resultadoExecutivo: pdf.includes("Resultado Executivo") || pdf.includes("RESULTADO EXECUTIVO"),
        memoria: pdf.includes("Memória Resumida"),
        lpAtual: pdf.includes("Lucro Presumido atual"),
        reforma: pdf.includes("Reforma"),
        cbs: pdf.includes("CBS"),
        ibs: pdf.includes("IBS"),
      },
    }, {
      cards: {
        modulo: "PRESUMIDO_ATUAL_VS_REFORMA",
        atual: { total: 344600, pisCofins: 73000, ipi: 0 },
        cbs: { debito: 176000, credito: 70400, liquida: 105600, aliq: 8.8 },
        ibs: { debito: 2000, credito: 800, liquido: 1200, aliq: 0.1 },
        futuro: { total: 378400, aliquota: 18.92 },
        decisao: { tipo: "AUMENTO", valor: 33800 },
      },
      secoesPdf: { resultadoExecutivo: true, memoria: true, lpAtual: true, reforma: true, cbs: true, ibs: true },
    });
  });
});
