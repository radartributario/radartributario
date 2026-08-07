import { describe, it } from "node:test";
import assert from "node:assert";
import { close, form, loadEngine, manualLp, round2 } from "./helpers/tributaryAuditHelpers.mjs";

const engine = loadEngine();

const RECEITAS_OBRIGATORIAS = [
  0,
  1,
  59_999,
  60_000,
  60_001,
  1_249_999,
  1_250_000,
  1_250_001,
  4_999_999,
  5_000_000,
  5_000_001,
];

describe("Limites tributarios obrigatorios - receitas", () => {
  for (const receita of RECEITAS_OBRIGATORIAS) {
    it(`receita ${receita}: LP comercio permanece finito e bate formula manual`, () => {
      const result = engine.calcularLP({
        rbt12: receita,
        tipoAtiv: "comercio",
        presIRPJ: 0.08,
        presCSLL: 0.12,
        issPct: 0,
        icmsPct: 0.18,
        ipiPct: 0,
        segregPct: 1,
        comprasAnual: Math.min(receita, 800_000),
        sal: 0,
        prol: 0,
        inssP: 0,
        ratP: 0,
        tercP: 0,
        fgtsP: 0,
        anoSIM: "2027",
      });
      const expected = manualLp({ rbt12: receita, compras: Math.min(receita, 800_000), icmsPct: 0.18, ano: 2027 });
      assert.ok(Number.isFinite(result.total), `total invalido para receita ${receita}`);
      close(result.baseIRPJ, expected.baseIRPJ.total, 0.01, `base IRPJ ${receita}`);
      close(result.baseCSLL, expected.baseCSLL.total, 0.01, `base CSLL ${receita}`);
      close(result.total, expected.total, 0.01, `total ${receita}`);
    });
  }
});

describe("Limites tributarios obrigatorios - IRPJ adicional e majoracao", () => {
  it("IRPJ adicional inicia somente quando a base presumida supera R$ 60.000", () => {
    const abaixo = engine.calcularLP({ rbt12: 749_999, tipoAtiv: "comercio", presIRPJ: 0.08, presCSLL: 0.12, issPct: 0, icmsPct: 0, ipiPct: 0, segregPct: 1, comprasAnual: 0, sal: 0, prol: 0, inssP: 0, ratP: 0, tercP: 0, fgtsP: 0, anoSIM: "2027" });
    const limite = engine.calcularLP({ rbt12: 750_000, tipoAtiv: "comercio", presIRPJ: 0.08, presCSLL: 0.12, issPct: 0, icmsPct: 0, ipiPct: 0, segregPct: 1, comprasAnual: 0, sal: 0, prol: 0, inssP: 0, ratP: 0, tercP: 0, fgtsP: 0, anoSIM: "2027" });
    const acima = engine.calcularLP({ rbt12: 750_001, tipoAtiv: "comercio", presIRPJ: 0.08, presCSLL: 0.12, issPct: 0, icmsPct: 0, ipiPct: 0, segregPct: 1, comprasAnual: 0, sal: 0, prol: 0, inssP: 0, ratP: 0, tercP: 0, fgtsP: 0, anoSIM: "2027" });
    close(abaixo.adicionalIRPJ, 0, 0.01, "adicional abaixo");
    close(limite.adicionalIRPJ, 0, 0.01, "adicional limite");
    close(acima.adicionalIRPJ, 0.008, 0.01, "adicional acima");
  });

  it("majoracao da presuncao ocorre somente acima de R$ 5.000.000 no limite anual", () => {
    const abaixo = engine.calcularLP({ rbt12: 4_999_999, tipoAtiv: "comercio", presIRPJ: 0.08, presCSLL: 0.12, issPct: 0, icmsPct: 0, ipiPct: 0, segregPct: 1, comprasAnual: 0, sal: 0, prol: 0, inssP: 0, ratP: 0, tercP: 0, fgtsP: 0, anoSIM: "2027" });
    const limite = engine.calcularLP({ rbt12: 5_000_000, tipoAtiv: "comercio", presIRPJ: 0.08, presCSLL: 0.12, issPct: 0, icmsPct: 0, ipiPct: 0, segregPct: 1, comprasAnual: 0, sal: 0, prol: 0, inssP: 0, ratP: 0, tercP: 0, fgtsP: 0, anoSIM: "2027" });
    const acima = engine.calcularLP({ rbt12: 5_000_001, tipoAtiv: "comercio", presIRPJ: 0.08, presCSLL: 0.12, issPct: 0, icmsPct: 0, ipiPct: 0, segregPct: 1, comprasAnual: 0, sal: 0, prol: 0, inssP: 0, ratP: 0, tercP: 0, fgtsP: 0, anoSIM: "2027" });
    assert.strictEqual(abaixo.basePresumidaIRPJDetalhe.majoracaoAplicada, false);
    assert.strictEqual(limite.basePresumidaIRPJDetalhe.majoracaoAplicada, false);
    assert.strictEqual(acima.basePresumidaIRPJDetalhe.majoracaoAplicada, true);
    close(acima.basePresumidaIRPJDetalhe.receitaExcedente, 1, 0.01, "excedente IRPJ");
    close(acima.basePresumidaIRPJDetalhe.baseMajorada, 0.09, 0.01, "base majorada IRPJ arredondada");
  });

  it("CSLL em 2026 usa limite transitorio anual de R$ 3.750.000", () => {
    const result = engine.calcularLP({ rbt12: 4_000_000, tipoAtiv: "servicos", presIRPJ: 0.32, presCSLL: 0.32, issPct: 0.05, icmsPct: 0, ipiPct: 0, segregPct: 1, comprasAnual: 0, sal: 0, prol: 0, inssP: 0, ratP: 0, tercP: 0, fgtsP: 0, anoSIM: "2026" });
    close(result.basePresumidaCSLLDetalhe.limite, 3_750_000, 0.01, "limite CSLL 2026");
    close(result.basePresumidaCSLLDetalhe.receitaExcedente, 250_000, 0.01, "excedente CSLL 2026");
    close(result.baseCSLL, 1_288_000, 0.01, "base CSLL 2026");
  });
});

describe("Limites tributarios obrigatorios - Fator R, sublimite, CBS e IBS", () => {
  it("Fator R decide Anexo III no limite de 28% e Anexo V abaixo do limite", () => {
    const noLimite = engine.calcularComparacaoSimplesPresumido(form({ rbt12Input: "1.200.000,00", salarios: "28.000,00", prolabore: "0,00", tipoAtivLP: "servicos", cnae: "6201-5/00", aliquotaICMS: "0", aliquotaISS: "2.5" }));
    const abaixo = engine.calcularComparacaoSimplesPresumido(form({ rbt12Input: "1.200.000,00", salarios: "27.999,00", prolabore: "0,00", tipoAtivLP: "servicos", cnae: "6201-5/00", aliquotaICMS: "0", aliquotaISS: "2.5" }));
    assert.strictEqual(noLimite.sn.anexo, "Anexo III");
    assert.strictEqual(abaixo.sn.anexo, "Anexo V");
  });

  it("sublimite marca ICMS fora do DAS quando impedimento esta vigente", () => {
    const result = engine.calcularComparacaoSimplesPresumido(form({ rbt12Input: "4.000.000,00", comprasInput: "2.000.000,00", receitaAnoAnterior: "4.000.000,00", impedimentoIssJaProduzEfeitos: "sim" }));
    assert.strictEqual(result.sn.sublimiteIcms, true);
    assert.strictEqual(result.sn.sublimiteIss, false);
    close(result.sn.sublimiteValor, 360_000, 0.01, "ICMS por fora do DAS");
  });

  it("CBS e IBS zeram o liquido quando os creditos superam os debitos", () => {
    const cbs = engine.calcularCBS({ receita: 1_000, compras: 2_000, pctCreditavel: 100, aliqPadrao: 0.0921, aliqMediaEntradas: 0.0921 });
    const ibs = engine.calcularIBS({ receita: 1_000, compras: 2_000, pctCreditavel: 100, aliqPadrao: 0.001, aliqMediaEntradas: 0.001 });
    close(cbs.cbsDebito, 92.10, 0.01, "CBS debito");
    close(cbs.cbsCreditoTotal, 184.20, 0.01, "CBS credito");
    close(cbs.cbsLiquida, 0, 0.01, "CBS liquida zerada");
    close(ibs.ibsDebito, 1, 0.01, "IBS debito");
    close(ibs.ibsCredito, 2, 0.01, "IBS credito");
    close(ibs.ibsLiquido, 0, 0.01, "IBS liquido zerado");
  });

  it("receitas obrigatorias geram percentuais SN sem NaN quando elegiveis", () => {
    for (const receita of RECEITAS_OBRIGATORIAS.filter((value) => value <= 5_000_000)) {
      const result = engine.calcularComparacaoSimplesPresumido(form({ rbt12Input: String(receita), comprasInput: "0", aliquotaICMS: "0" }));
      assert.ok(Number.isFinite(round2(result.lp.aliquota)), `aliquota LP invalida para ${receita}`);
    }
  });
});
