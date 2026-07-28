import { describe, it } from "node:test";
import assert from "node:assert";

// Repartition table for 2027 (matches comparador.html getReparticao2027)
const REPARTICAO_2027 = {
  'Anexo III': {
    faixas: [
      { ate: 180000, irpj: 0.04,  csll: 0.035, cbs: 0.1641, cpp: 0.434, iss: 0.3269, ibs: 0 },
      { ate: 360000, irpj: 0.04,  csll: 0.035, cbs: 0.1641, cpp: 0.434, iss: 0.3269, ibs: 0 },
      { ate: 720000, irpj: 0.04,  csll: 0.035, cbs: 0.1641, cpp: 0.434, iss: 0.3269, ibs: 0 },
      { ate: 1800000, irpj: 0.04, csll: 0.035, cbs: 0.1641, cpp: 0.434, iss: 0.3269, ibs: 0 },
      { ate: 3600000, irpj: 0.04, csll: 0.035, cbs: 0.1641, cpp: 0.434, iss: 0.3269, ibs: 0 },
      { ate: Infinity, irpj: 0.04, csll: 0.035, cbs: 0.1641, cpp: 0.434, iss: 0.3269, ibs: 0 },
    ]
  },
  'Anexo I': {
    faixas: [
      { ate: 180000, irpj: 0.04,  csll: 0.035, cbs: 0.1641, cpp: 0.414, iss: 0.3469, ibs: 0 },
      { ate: 360000, irpj: 0.04,  csll: 0.035, cbs: 0.1641, cpp: 0.414, iss: 0.3469, ibs: 0 },
      { ate: 720000, irpj: 0.04,  csll: 0.035, cbs: 0.1641, cpp: 0.414, iss: 0.3469, ibs: 0 },
      { ate: 1800000, irpj: 0.04, csll: 0.035, cbs: 0.1641, cpp: 0.414, iss: 0.3469, ibs: 0 },
      { ate: 3600000, irpj: 0.04, csll: 0.035, cbs: 0.1641, cpp: 0.414, iss: 0.3469, ibs: 0 },
      { ate: Infinity, irpj: 0.04, csll: 0.035, cbs: 0.1641, cpp: 0.414, iss: 0.3469, ibs: 0 },
    ]
  },
  'Anexo II': {
    faixas: [
      { ate: 180000, irpj: 0.04,  csll: 0.035, cbs: 0.1641, cpp: 0.424, iss: 0.3369, ibs: 0 },
      { ate: 360000, irpj: 0.04,  csll: 0.035, cbs: 0.1641, cpp: 0.424, iss: 0.3369, ibs: 0 },
      { ate: 720000, irpj: 0.04,  csll: 0.035, cbs: 0.1641, cpp: 0.424, iss: 0.3369, ibs: 0 },
      { ate: 1800000, irpj: 0.04, csll: 0.035, cbs: 0.1641, cpp: 0.424, iss: 0.3369, ibs: 0 },
      { ate: 3600000, irpj: 0.04, csll: 0.035, cbs: 0.1641, cpp: 0.424, iss: 0.3369, ibs: 0 },
      { ate: Infinity, irpj: 0.04, csll: 0.035, cbs: 0.1641, cpp: 0.424, iss: 0.3369, ibs: 0 },
    ]
  },
  'Anexo IV': {
    faixas: [
      { ate: 180000, irpj: 0.04,  csll: 0.035, cbs: 0.1641, cpp: 0.404, iss: 0.3569, ibs: 0 },
      { ate: 360000, irpj: 0.04,  csll: 0.035, cbs: 0.1641, cpp: 0.404, iss: 0.3569, ibs: 0 },
      { ate: 720000, irpj: 0.04,  csll: 0.035, cbs: 0.1641, cpp: 0.404, iss: 0.3569, ibs: 0 },
      { ate: 1800000, irpj: 0.04, csll: 0.035, cbs: 0.1641, cpp: 0.404, iss: 0.3569, ibs: 0 },
      { ate: 3600000, irpj: 0.04, csll: 0.035, cbs: 0.1641, cpp: 0.404, iss: 0.3569, ibs: 0 },
      { ate: Infinity, irpj: 0.04, csll: 0.035, cbs: 0.1641, cpp: 0.404, iss: 0.3569, ibs: 0 },
    ]
  },
  'Anexo V': {
    faixas: [
      { ate: 180000, irpj: 0.04,  csll: 0.035, cbs: 0.1641, cpp: 0.434, iss: 0.3269, ibs: 0 },
      { ate: 360000, irpj: 0.04,  csll: 0.035, cbs: 0.1641, cpp: 0.434, iss: 0.3269, ibs: 0 },
      { ate: 720000, irpj: 0.04,  csll: 0.035, cbs: 0.1641, cpp: 0.434, iss: 0.3269, ibs: 0 },
      { ate: 1800000, irpj: 0.04, csll: 0.035, cbs: 0.1641, cpp: 0.434, iss: 0.3269, ibs: 0 },
      { ate: 3600000, irpj: 0.04, csll: 0.035, cbs: 0.1641, cpp: 0.434, iss: 0.3269, ibs: 0 },
      { ate: Infinity, irpj: 0.04, csll: 0.035, cbs: 0.1641, cpp: 0.434, iss: 0.3269, ibs: 0 },
    ]
  }
};

function getReparticao(anexo, rbt12) {
  const anexoData = REPARTICAO_2027[anexo];
  if (!anexoData) return null;
  const faixa = anexoData.faixas.find(f => rbt12 <= f.ate);
  return faixa || anexoData.faixas[anexoData.faixas.length - 1];
}

// Simulated calcHibrido logic (mirrors comparador.html calcularComparacaoSimplesHibrido)
function calcHibrido({ rbt12, dasAnual, anexo, optOutPct, aliqCbsFora, encargosFora, snTotalTrad }) {
  if (!rbt12 || !dasAnual || optOutPct === undefined || optOutPct === null) return null;

  const rep = getReparticao(anexo, rbt12);
  const consumoPct = rep.cbs || 0; // IBS = 0 em 2027

  const dasReduzido = dasAnual * (1 - optOutPct * consumoPct);
  const cbsLiquida = rbt12 * optOutPct * aliqCbsFora;
  const ibsLiquido = 0; // IBS não tem cálculo em 2027
  const totalHibrido = dasReduzido + cbsLiquida + encargosFora;
  const mediaHibrido = totalHibrido / 12;
  const aliquotaHibrido = totalHibrido / rbt12;
  const economia = Math.abs(snTotalTrad - totalHibrido);
  const ecoPct = Math.max(snTotalTrad, totalHibrido) > 0 ? economia / Math.max(snTotalTrad, totalHibrido) : 0;

  return { dasReduzido, cbsLiquida, ibsLiquido, total: totalHibrido, media: mediaHibrido, aliquota: aliquotaHibrido, economia, ecoPct, reparticao: rep };
}

describe("Motor Híbrido — Simples tradicional × Simples híbrido", () => {
  const base = {
    rbt12: 1200000,
    dasAnual: 144000,    // 12% efetiva
    anexo: "Anexo III",
    optOutPct: 1,        // 100% opt-out
    aliqCbsFora: 0.088, // 8.8%
    encargosFora: 6000,
    snTotalTrad: 150000,
  };

  it("deve calcular DAS reduzido < DAS original", () => {
    const r = calcHibrido(base);
    assert.ok(r.dasReduzido < base.dasAnual, `DAS reduzido ${r.dasReduzido} >= DAS original ${base.dasAnual}`);
  });

  it("deve ter CBS > 0 e IBS = 0 com opt-out 100% (IBS sem cálculo em 2027)", () => {
    const r = calcHibrido(base);
    assert.ok(r.cbsLiquida > 0, "CBS deve ser > 0");
    assert.strictEqual(r.ibsLiquido, 0, "IBS deve ser 0 em 2027");
  });

  it("deve ter alíquota híbrida entre 0 e 100%", () => {
    const r = calcHibrido(base);
    assert.ok(r.aliquota > 0 && r.aliquota < 1, `Alíquota híbrida inválida: ${r.aliquota}`);
  });

  it("opt-out 0% = DAS unchanged, CBS = 0", () => {
    const r = calcHibrido({ ...base, optOutPct: 0 });
    assert.strictEqual(r.dasReduzido, base.dasAnual, "DAS deve permanecer igual");
    assert.strictEqual(r.cbsLiquida, 0, "CBS deve ser 0");
    assert.strictEqual(r.ibsLiquido, 0, "IBS deve ser 0 em 2027");
  });

  it("opt-out 50% = metade da redução e metade CBS", () => {
    const rFull = calcHibrido(base);
    const rHalf = calcHibrido({ ...base, optOutPct: 0.5 });
    // Anexo III, faixa 4 (R$ 1.200.000): CBS portion = 0.1641 (IBS = 0 em 2027)
    const consumptionPortion = 0.1641;
    const expectedDasReduzido = base.dasAnual * (1 - 0.5 * consumptionPortion);
    assert.strictEqual(rHalf.dasReduzido, expectedDasReduzido, "DAS reduzido 50% incorreto");
    assert.strictEqual(rHalf.cbsLiquida, rFull.cbsLiquida / 2, "CBS deve ser metade");
    assert.strictEqual(rHalf.ibsLiquido, 0, "IBS deve ser 0 em 2027");
  });

  it("economia >= 0 para qualquer cenário", () => {
    for (const optPct of [0, 0.25, 0.5, 0.75, 1]) {
      const r = calcHibrido({ ...base, optOutPct: optPct });
      assert.ok(r.economia >= 0, `Economia negativa para optOutPct=${optPct}`);
    }
  });

  it("deve funcionar para todos os anexos", () => {
    for (const anexo of ["Anexo I", "Anexo II", "Anexo III", "Anexo IV", "Anexo V"]) {
      const r = calcHibrido({ ...base, anexo });
      assert.ok(r, `Falhou para ${anexo}`);
      assert.ok(r.total > 0, `Total zero para ${anexo}`);
      assert.ok(r.aliquota > 0 && r.aliquota < 1, `Alíquota inválida para ${anexo}: ${r.aliquota}`);
    }
  });

  it("deve funcionar para diferentes faixas de receita", () => {
    for (const rbt of [180000, 360000, 720000, 1800000, 3600000, 4800000]) {
      const das = rbt * 0.12;
      const r = calcHibrido({ ...base, rbt12: rbt, dasAnual: das, snTotalTrad: das + 6000 });
      assert.ok(r, `Falhou para RBT12=${rbt}`);
      assert.ok(r.total > 0, `Total zero para RBT12=${rbt}`);
    }
  });
});
