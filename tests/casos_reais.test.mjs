import { describe, it } from "node:test";
import assert from "node:assert";
import { casosReais } from "./casos_reais/fixtures.mjs";
import {
  close,
  loadEngine,
  manualLp,
  manualSn,
  pdfFor,
  round2,
  stableHibridoSnapshot,
  stableReformaSnapshot,
  stableSnLpSnapshot,
} from "./helpers/tributaryAuditHelpers.mjs";

const engine = loadEngine();

function snapshotFor(caseData) {
  if (caseData.modulo === "SIMPLES_VS_PRESUMIDO") {
    return stableSnLpSnapshot(engine.calcularComparacaoSimplesPresumido(caseData.input));
  }
  if (caseData.modulo === "SIMPLES_TRADICIONAL_VS_HIBRIDO") {
    return stableHibridoSnapshot(engine.calcularComparacaoSimplesHibrido(caseData.input));
  }
  if (caseData.modulo === "PRESUMIDO_ATUAL_VS_REFORMA") {
    return stableReformaSnapshot(engine.calcularComparacaoPresumidoReforma(caseData.input));
  }
  throw new Error(`Modulo desconhecido: ${caseData.modulo}`);
}

function resultFor(caseData) {
  if (caseData.modulo === "SIMPLES_VS_PRESUMIDO") return engine.calcularComparacaoSimplesPresumido(caseData.input);
  if (caseData.modulo === "SIMPLES_TRADICIONAL_VS_HIBRIDO") return engine.calcularComparacaoSimplesHibrido(caseData.input);
  return engine.calcularComparacaoPresumidoReforma(caseData.input);
}

function parseMoneyBR(value) {
  return parseFloat(String(value).replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
}

describe("Casos reais anonimizados - homologacao comercial", () => {
  for (const caseData of casosReais) {
    it(`${caseData.id}: motor e snapshot esperado`, () => {
      assert.deepStrictEqual(snapshotFor(caseData), caseData.expected);
    });

    it(`${caseData.id}: memoria resumida e completa batem com o motor`, () => {
      const result = resultFor(caseData);
      if (caseData.modulo === "SIMPLES_VS_PRESUMIDO") {
        if (typeof caseData.memoriaCompleta.snDas === "number") close(result.sn.dasAnual, caseData.memoriaCompleta.snDas, 0.01, `${caseData.id} SN DAS`);
        if (typeof caseData.memoriaCompleta.snAliquota === "number") close(round2(result.sn.aliquota), caseData.memoriaCompleta.snAliquota, 0.01, `${caseData.id} SN aliquota`);
        if (typeof caseData.memoriaCompleta.lpBaseIRPJ === "number") close(result.lp.baseIRPJ, caseData.memoriaCompleta.lpBaseIRPJ, 0.01, `${caseData.id} base IRPJ`);
        if (typeof caseData.memoriaCompleta.lpBaseCSLL === "number") close(result.lp.baseCSLL, caseData.memoriaCompleta.lpBaseCSLL, 0.01, `${caseData.id} base CSLL`);
        if (typeof caseData.memoriaCompleta.icms === "number") close(result.lp.icms, caseData.memoriaCompleta.icms, 0.01, `${caseData.id} ICMS`);
        if (typeof caseData.memoriaCompleta.iss === "number") close(result.lp.iss, caseData.memoriaCompleta.iss, 0.01, `${caseData.id} ISS`);
        if (typeof caseData.memoriaCompleta.ipi === "number") close(result.lp.ipi, caseData.memoriaCompleta.ipi, 0.01, `${caseData.id} IPI`);
        if (typeof caseData.memoriaCompleta.total === "number") close(result.lp.total, caseData.memoriaCompleta.total, 0.01, `${caseData.id} LP total`);
      }
      if (caseData.modulo === "PRESUMIDO_ATUAL_VS_REFORMA") {
        close(result.lucroPresumidoAtual.total, caseData.memoriaCompleta.atual, 0.01, `${caseData.id} LP atual`);
        close(result.CBS.debito, caseData.memoriaCompleta.cbsDebito, 0.01, `${caseData.id} CBS debito`);
        close(result.CBS.credito, caseData.memoriaCompleta.cbsCredito, 0.01, `${caseData.id} CBS credito`);
        close(result.CBS.liquida, caseData.memoriaCompleta.cbsLiquida, 0.01, `${caseData.id} CBS liquida`);
        close(result.IBS.liquido, caseData.memoriaCompleta.ibsLiquido, 0.01, `${caseData.id} IBS liquido`);
        close(result.cenarioFuturo.total, caseData.memoriaCompleta.futuro, 0.01, `${caseData.id} futuro`);
      }
      if (caseData.modulo === "SIMPLES_TRADICIONAL_VS_HIBRIDO") {
        close(result.simplesTradicional.total, caseData.memoriaCompleta.tradicional, 0.01, `${caseData.id} tradicional`);
        close(result.simplesHibrido.dasReduzido, caseData.memoriaCompleta.dasReduzido, 0.01, `${caseData.id} DAS reduzido`);
        close(result.simplesHibrido.cbsLiquida, caseData.memoriaCompleta.cbsLiquida, 0.01, `${caseData.id} CBS liquida`);
        close(result.simplesHibrido.total, caseData.memoriaCompleta.totalHibrido, 0.01, `${caseData.id} total hibrido`);
      }
    });

    it(`${caseData.id}: PDF contem os mesmos valores homologados`, async () => {
      const result = resultFor(caseData);
      const pdf = await pdfFor(engine, result, caseData.input);
      for (const expectedValue of caseData.pdfValues) {
        assert.ok(pdf.includes(expectedValue), `${caseData.id}: PDF nao contem ${expectedValue}`);
      }
    });
  }
});

describe("Casos reais anonimizados - conferencia manual independente", () => {
  it("comercio base: calculo manual SN e LP bate com caso real", () => {
    const caso = casosReais.find((item) => item.id === "comercio-simples-nacional");
    const sn = manualSn(2_000_000, "Anexo I");
    const lp = manualLp({ rbt12: 2_000_000, compras: 800_000, icmsPct: 0.18, ano: 2027 });
    close(sn.das, caso.expected.sn.das, 0.01, "comercio SN manual");
    close(lp.total, caso.expected.lp.total, 0.01, "comercio LP manual");
  });

  it("servicos base: calculo manual SN e LP bate com caso real", () => {
    const caso = casosReais.find((item) => item.id === "servicos-simples-nacional");
    const sn = manualSn(1_200_000, "Anexo III");
    const lp = manualLp({ rbt12: 1_200_000, tipoAtiv: "servicos", presIRPJ: 0.32, presCSLL: 0.32, issPct: 0.025, compras: 200_000, ano: 2027 });
    const encargosLp = 40_000 * (0.20 + 0.03 + 0.033 + 0.08) * 12;
    close(sn.das, caso.expected.sn.das, 0.01, "servicos SN manual");
    close(lp.total + encargosLp, caso.expected.lp.total, 0.01, "servicos LP manual");
  });

  it("industria base: calculo manual LP bate com caso real", () => {
    const caso = casosReais.find((item) => item.id === "industria-lucro-presumido");
    const lp = manualLp({ rbt12: 3_000_000, tipoAtiv: "industria", compras: 1_400_000, icmsPct: 0.12, ipiPct: 0.05, ano: 2027 });
    close(lp.total, caso.expected.lp.total, 0.01, "industria LP manual");
    close(lp.ipi, caso.expected.lp.ipi, 0.01, "industria IPI manual");
  });

  it("valores declarados para PDF sao monetarios validos", () => {
    for (const caseData of casosReais) {
      for (const expectedValue of caseData.pdfValues) {
        assert.ok(parseMoneyBR(expectedValue) >= 0, `${caseData.id}: valor PDF invalido ${expectedValue}`);
      }
    }
  });
});
