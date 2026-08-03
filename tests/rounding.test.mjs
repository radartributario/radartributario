import { describe, it } from "node:test";
import assert from "node:assert";
import { close, form, loadEngine, money, pdfFor, round2 } from "./helpers/tributaryAuditHelpers.mjs";

const engine = loadEngine();

describe("Arredondamento oficial - percentuais", () => {
  it("9,935% deve arredondar para 9,94%, nunca 9,93%", async () => {
    const input = form();
    const result = engine.calcularComparacaoSimplesPresumido(input);
    close(result.sn.aliquota, 9.94, 0.000001, "aliquota tela SN");
    close(result.sn.aliquotaDisplay, 9.94, 0.000001, "aliquota display SN");
    assert.notStrictEqual(round2(result.sn.aliquota), 9.93);
    const pdf = await pdfFor(engine, result, input);
    assert.ok(pdf.includes("9,94%"), "PDF deve conter 9,94%");
    assert.ok(!pdf.includes("9,93%"), "PDF nao deve conter 9,93% para este caso");
  });

  it("aliquota efetiva da memoria do SN segue o mesmo arredondamento", () => {
    const result = engine.calcularComparacaoSimplesPresumido(form());
    close(result.memoriaCalculo.sn.aliqEfetiva, 9.94, 0.000001, "memoria SN aliquota efetiva");
    close(result.sn.aliquota, result.memoriaCalculo.sn.aliqEfetiva, 0.000001, "tela = memoria SN aliquota");
  });
});

describe("Arredondamento oficial - moeda", () => {
  it("valores monetarios principais mantem duas casas e batem com PDF", async () => {
    const input = form();
    const result = engine.calcularComparacaoSimplesPresumido(input);
    const pdf = await pdfFor(engine, result, input);
    for (const value of [result.sn.total, result.lp.total, result.lp.baseIRPJ, result.lp.baseCSLL, result.lp.icms, result.kpi.economia]) {
      const formatted = money(value);
      assert.match(formatted, /^R\$ \d{1,3}(\.\d{3})*,\d{2}$/);
      assert.ok(pdf.includes(formatted), `PDF nao contem ${formatted}`);
    }
  });

  it("bases majoradas arredondam centavos no motor e na memoria", () => {
    const result = engine.calcularLP({ rbt12: 5_000_001, tipoAtiv: "comercio", presIRPJ: 0.08, presCSLL: 0.12, issPct: 0, icmsPct: 0, ipiPct: 0, segregPct: 1, comprasAnual: 0, sal: 0, prol: 0, inssP: 0, ratP: 0, tercP: 0, fgtsP: 0, anoSIM: "2027" });
    close(result.basePresumidaIRPJDetalhe.baseMajorada, 0.09, 0.01, "IRPJ base majorada centavos");
    close(result.basePresumidaCSLLDetalhe.baseMajorada, 0.13, 0.01, "CSLL base majorada centavos");
    close(result.baseIRPJ, result.basePresumidaIRPJDetalhe.baseTotal, 0.01, "IRPJ total = memoria");
    close(result.baseCSLL, result.basePresumidaCSLLDetalhe.baseTotal, 0.01, "CSLL total = memoria");
  });

  it("media mensal e economia mensal usam divisao por 12 sem divergencia", () => {
    const result = engine.calcularComparacaoSimplesHibrido(form());
    close(result.simplesHibrido.media, result.simplesHibrido.total / 12, 0.01, "media hibrido");
    close(result.comparacaoFinanceira.valorMensal, result.comparacaoFinanceira.valorAnual / 12, 0.01, "impacto mensal");
  });
});
