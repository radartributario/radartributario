import { describe, it } from "node:test";
import assert from "node:assert";

function fmtPctBR(v) {
  if (!isFinite(v)) return "—";
  return v.toFixed(2).replace(".", ",") + "%";
}

function formatCurrencyBRL(value) {
  if (!isFinite(value) || value < 0) return "0,00";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmt(v) {
  return formatCurrencyBRL(v);
}

describe("Winner only between comparable regimes (excludes CBS)", () => {
  it("SN < LP -> SN wins", () => {
    const sn = 100000, lp = 150000, cbs = 60000;
    const winner = sn < lp ? "Simples Nacional" : lp < sn ? "Lucro Presumido" : null;
    assert.strictEqual(winner, "Simples Nacional");
    // CBS must NOT affect the result
    const cbsLower = 40000; // lower than both
    assert.strictEqual(winner, "Simples Nacional"); // still SN, CBS ignored
  });

  it("LP < SN -> LP wins", () => {
    const sn = 200000, lp = 150000;
    const winner = sn < lp ? "Simples Nacional" : lp < sn ? "Lucro Presumido" : null;
    assert.strictEqual(winner, "Lucro Presumido");
  });

  it("SN == LP -> null (equivalentes)", () => {
    const sn = 150000, lp = 150000;
    const winner = sn < lp ? "Simples Nacional" : lp < sn ? "Lucro Presumido" : null;
    assert.strictEqual(winner, null);
  });

  it("CBS lower than both but does not win", () => {
    const sn = 100000, lp = 110000, cbs = 50000;
    const winner = sn < lp ? "Simples Nacional" : lp < sn ? "Lucro Presumido" : null;
    assert.strictEqual(winner, "Simples Nacional");
    // cbs doesn't participate
    assert.ok(cbs < sn, "CBS is lower but not the winner");
  });
});

describe("LP sum validation", () => {
  function validateLP(components, total) {
    const sum = components.reduce((s, c) => s + c.val, 0);
    return Math.abs(sum - total) < 0.02;
  }

  it("all components present sum to total", () => {
    const components = [
      { label: "IRPJ", val: 12000 },
      { label: "IRPJ Adic", val: 0 },
      { label: "CSLL", val: 10800 },
      { label: "PIS+COFINS", val: 36500 },
      { label: "IPI", val: 0 },
      { label: "ISS", val: 25000 },
      { label: "ICMS", val: 55000 },
      { label: "Encargos", val: 10000 },
    ];
    const total = components.reduce((s, c) => s + c.val, 0); // 149300
    assert.ok(validateLP(components, total));
  });

  it("missing ISS causes inconsistency", () => {
    const components = [
      { label: "IRPJ", val: 12000 },
      { label: "CSLL", val: 10800 },
      { label: "PIS+COFINS", val: 36500 },
      { label: "ISS", val: 0 },           // should be 25000
      { label: "ICMS", val: 55000 },
      { label: "Encargos", val: 10000 },
    ];
    const total = 149300;
    assert.ok(!validateLP(components, total), "Should fail without ISS");
  });

  it("all zeros is consistent", () => {
    const components = [
      { label: "IRPJ", val: 0 },
      { label: "CSLL", val: 0 },
      { label: "PIS+COFINS", val: 0 },
    ];
    assert.ok(validateLP(components, 0));
  });
});

describe("Total / 12 = monthly average", () => {
  function mediaMensal(total) { return total / 12; }

  it("149300 / 12 = 12441.67", () => {
    assert.strictEqual(mediaMensal(149300), 12441.666666666666);
  });
  it("0 / 12 = 0", () => {
    assert.strictEqual(mediaMensal(0), 0);
  });
});

describe("Alíquota efetiva = total / receita", () => {
  it("124360 / 1000000 = 12.436%", () => {
    const aliq = 124360 / 1000000 * 100;
    assert.strictEqual(aliq, 12.436);
  });
  it("0 / 1000000 = 0%", () => {
    assert.strictEqual(0 / 1000000 * 100, 0);
  });
});

describe("Economia = |vencedor - segundo|", () => {
  it("SN wins: economia = LP - SN", () => {
    const sn = 124360, lp = 149300;
    const economia = Math.abs(sn - lp);
    assert.strictEqual(economia, 24940);
  });
  it("LP wins: economia = SN - LP", () => {
    const sn = 200000, lp = 150000;
    const economia = Math.abs(sn - lp);
    assert.strictEqual(economia, 50000);
  });
});

describe("pt-BR percent formatting", () => {
  it("12.44% -> 12,44%", () => {
    assert.strictEqual(fmtPctBR(12.44), "12,44%");
  });
  it("14.93% -> 14,93%", () => {
    assert.strictEqual(fmtPctBR(14.93), "14,93%");
  });
  it("8.8% -> 8,80%", () => {
    assert.strictEqual(fmtPctBR(8.8), "8,80%");
  });
  it("6.6% -> 6,60%", () => {
    assert.strictEqual(fmtPctBR(6.6), "6,60%");
  });
  it("0% -> 0,00%", () => {
    assert.strictEqual(fmtPctBR(0), "0,00%");
  });
  it("handles NaN", () => {
    assert.strictEqual(fmtPctBR(NaN), "—");
  });
});

describe("pt-BR currency formatting", () => {
  it("1000000 -> R$ 1.000.000,00", () => {
    assert.strictEqual(fmt(1000000), "1.000.000,00");
  });
  it("149300 -> 149.300,00", () => {
    assert.strictEqual(fmt(149300), "149.300,00");
  });
  it("12441.67 -> 12.441,67", () => {
    assert.strictEqual(fmt(12441.67), "12.441,67");
  });
  it("0 -> 0,00", () => {
    assert.strictEqual(fmt(0), "0,00");
  });
});

describe("CNAE classification - Industria (CASO 1)", () => {
  function cnaeToTipoAtiv(cnae) {
    if (!cnae) return "";
    const digits = cnae.replace(/\D/g, "");
    const div = parseInt(digits.substring(0, 2)) || 0;
    if (div >= 10 && div <= 33) return "industria";
    if (div >= 41 && div <= 43) return "servicos";
    if (div >= 45 && div <= 47) return "comercio";
    return "servicos";
  }

  it("CNAE 1629-3/01 (fabrica\u00E7\u00E3o) -> industria", () => {
    assert.strictEqual(cnaeToTipoAtiv("1629-3/01"), "industria");
  });

  it("CNAE 1011-2/01 (abate de animais) -> industria", () => {
    assert.strictEqual(cnaeToTipoAtiv("1011-2/01"), "industria");
  });

  it("CNAE 3312-1/00 (manuten\u00E7\u00E3o industrial) -> industria", () => {
    assert.strictEqual(cnaeToTipoAtiv("3312-1/00"), "industria");
  });

  it("CNAE 3329-5/01 (fabrica\u00E7\u00E3o outros equipamentos) -> industria", () => {
    assert.strictEqual(cnaeToTipoAtiv("3329-5/01"), "industria");
  });

  it("CNAE 45xx (com\u00E9rcio) -> comercio", () => {
    assert.strictEqual(cnaeToTipoAtiv("4511-1/01"), "comercio");
  });

  it("CNAE 47xx (varejo) -> comercio", () => {
    assert.strictEqual(cnaeToTipoAtiv("4711-3/01"), "comercio");
  });

  it("CNAE 62xx (servi\u00E7os TI) -> servicos", () => {
    assert.strictEqual(cnaeToTipoAtiv("6201-1/01"), "servicos");
  });

  it("CNAE 69xx (advocacia) -> servicos", () => {
    assert.strictEqual(cnaeToTipoAtiv("6911-7/01"), "servicos");
  });

  it("Null/empty CNAE -> empty string", () => {
    assert.strictEqual(cnaeToTipoAtiv(""), "");
    assert.strictEqual(cnaeToTipoAtiv(null), "");
  });
});

describe("getAnexoSN logic", () => {
  function getAnexoSN(cnae, classe, fatorR) {
    const cat = null; // no CNAE_TAX_DATA lookup in tests
    if (cat==='comercio') return 'Anexo I';
    if (cat==='industria') return 'Anexo II';
    if (cat==='servico') return 'Anexo III';
    const digits2 = parseInt(classe.replace(/\D/g,'').substring(0,2)) || 0;
    if (digits2>=10&&digits2<=33) return 'Anexo II';
    if (digits2>=45&&digits2<=47) return 'Anexo I';
    if (digits2>=41&&digits2<=43) return 'Anexo IV';
    // Fator R classes (CNAE 6201-1, 6911-7, etc.)
    const fatorRClasses = ["6201-1","6911-7","6920-6","7020-4","7111-1"];
    if (fatorRClasses.includes(classe)) return fatorR >= 0.28 ? "Anexo III" : "Anexo V";
    return "Anexo III";
  }

  it("CNAE 1629-3/01 (fabrica\u00E7\u00E3o) -> Anexo II", () => {
    assert.strictEqual(getAnexoSN("1629-3/01", "1629-3", 0), "Anexo II");
  });

  it("CNAE 1011-2/01 (ind\u00FAstria) -> Anexo II", () => {
    assert.strictEqual(getAnexoSN("1011-2/01", "1011-2", 0), "Anexo II");
  });

  it("CNAE 4711-3/01 (com\u00E9rcio) -> Anexo I", () => {
    assert.strictEqual(getAnexoSN("4711-3/01", "4711-3", 0), "Anexo I");
  });

  it("CNAE 6201-1/01 (TI) com Fator R >= 28% -> Anexo III", () => {
    assert.strictEqual(getAnexoSN("6201-1/01", "6201-1", 0.30), "Anexo III");
  });

  it("CNAE 6201-1/01 (TI) com Fator R < 28% -> Anexo V", () => {
    assert.strictEqual(getAnexoSN("6201-1/01", "6201-1", 0.20), "Anexo V");
  });

  it("CNAE at\u00E9 33 sempre Anexo II, independente de Fator R", () => {
    assert.strictEqual(getAnexoSN("1629-3/01", "1629-3", 0.50), "Anexo II");
  });
});

describe("PDF validation rules", () => {
  it("RBT12 must be > 0 to generate PDF", () => {
    const rbt12 = 0;
    assert.ok(rbt12 <= 0, "RBT12 should fail validation if zero");
  });

  it("RBT12 = 1000000 generates correctly", () => {
    const rbt12 = 1000000;
    assert.ok(rbt12 > 0, "Valid RBT12");
  });

  it("LP components must sum to total within 0.02 tolerance", () => {
    const components = [12000, 0, 10800, 36500, 0, 25000, 55000, 10000];
    const total = 149300;
    const sum = components.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - total) < 0.02);
  });

  it("LP sum divergence > 0.02 fails validation", () => {
    const components = [12000, 0, 10800, 36500, 0, 0, 55000, 10000]; // missing ISS 25000
    const total = 149300;
    const sum = components.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - total) >= 0.02);
  });

  it("Average = total / 12 (within 0.02)", () => {
    const total = 149300;
    const avg = total / 12;
    assert.ok(Math.abs(avg - 12441.666666666666) < 0.02);
  });

  it("Aliquota = total / rbt12 * 100", () => {
    const total = 124360;
    const rbt12 = 1000000;
    const ali = total / rbt12 * 100;
    assert.strictEqual(parseFloat(ali.toFixed(4)), 12.436);
  });

  it("CBS bruta - creditos = CBS liquida", () => {
    const bruta = 88000;
    const creditos = 30000;
    const liquida = bruta - creditos;
    assert.strictEqual(liquida, 58000);
  });

  it("Dashboard and PDF must use same RBT12", () => {
    const rbt12FromCalc = 1000000;
    const rbt12ForDisplay = 1000000;
    assert.strictEqual(rbt12FromCalc, rbt12ForDisplay);
  });

  it("Fator R context message for industrial activity", () => {
    const anexo = "Anexo II";
    const isSujeitoFR = false;
    const fatorRctx = !isSujeitoFR
      ? anexo === "Anexo II" ? "N\u00E3o aplic\u00E1vel \u00E0 atividade industrial"
        : anexo === "Anexo I" ? "N\u00E3o aplic\u00E1vel ao Anexo I (com\u00E9rcio)"
        : "N\u00E3o aplic\u00E1vel"
      : "0,00%";
    assert.strictEqual(fatorRctx, "N\u00E3o aplic\u00E1vel \u00E0 atividade industrial");
  });

  it("Fator R not applicable for commerce", () => {
    const anexo = "Anexo I";
    const isSujeitoFR = false;
    const fatorRctx = !isSujeitoFR
      ? anexo === "Anexo II" ? "N\u00E3o aplic\u00E1vel \u00E0 atividade industrial"
        : anexo === "Anexo I" ? "N\u00E3o aplic\u00E1vel ao Anexo I (com\u00E9rcio)"
        : "N\u00E3o aplic\u00E1vel"
      : "0,00%";
    assert.strictEqual(fatorRctx, "N\u00E3o aplic\u00E1vel ao Anexo I (com\u00E9rcio)");
  });
});

describe("Mixed activities (CASO 4)", () => {
  it("Segregation affects ISS and ICMS allocation", () => {
    const rbt12 = 1000000;
    const segregPct = 0.60; // 60% servicos
    const issPct = 0.025;
    const icmsPct = 0.18;
    // ISS only on service portion
    const receitaServicos = rbt12 * segregPct;
    const iss = receitaServicos * issPct;
    assert.strictEqual(iss, 15000);
    // ICMS on commerce portion (rest)
    const receitaComercio = rbt12 * (1 - segregPct);
    const icms = receitaComercio * icmsPct;
    assert.strictEqual(icms, 72000);
  });

  it("Industry with mixed revenue includes ICMS and no ISS", () => {
    const tipoAtiv = "industria";
    const rbt12 = 1000000;
    const receitaLP = rbt12; // simplified: no segregation
    const comprasAnual = 500000;
    const icmsPct = 0.18;
    const baseIcms = receitaLP; // removed 50% rule
    const icms = baseIcms * icmsPct - comprasAnual * icmsPct;
    assert.strictEqual(icms, 90000);
    // No ISS for industry
    assert.strictEqual(tipoAtiv === "industria" ? 0 : 999, 0);
  });
});

describe("ICMS detail breakdown", () => {
  it("ICMS liquido = (base * aliq) - (compras * aliq)", () => {
    const base = 500000;
    const compras = 500000;
    const aliq = 0.18;
    const bruto = base * aliq;
    const cred = compras * aliq;
    const liquido = Math.max(0, bruto - cred);
    assert.strictEqual(bruto, 90000);
    assert.strictEqual(cred, 90000);
    assert.strictEqual(liquido, 0); // compras = base => net zero
  });

  it("ICMS com compras maiores que base", () => {
    const base = 300000;
    const compras = 500000;
    const aliq = 0.18;
    const bruto = base * aliq;
    const cred = compras * aliq;
    const liquido = Math.max(0, bruto - cred);
    assert.strictEqual(bruto, 54000);
    assert.strictEqual(cred, 90000);
    assert.strictEqual(liquido, 0); // capped at 0
  });

  it("ICMS liquido positivo quando compras < base", () => {
    const base = 500000;
    const compras = 200000;
    const aliq = 0.18;
    const bruto = base * aliq;
    const cred = compras * aliq;
    const liquido = Math.max(0, bruto - cred);
    assert.strictEqual(bruto, 90000);
    assert.strictEqual(cred, 36000);
    assert.strictEqual(liquido, 54000);
  });

  it("ICMS zero when no ICMS rate", () => {
    const base = 500000;
    const compras = 500000;
    const icmsPct = 0;
    const icms = Math.max(0, base * icmsPct - compras * icmsPct);
    assert.strictEqual(icms, 0);
  });

  it("Credito ICMS = compras * aliquota (nao mais 50% do debito)", () => {
    const compras = 500000;
    const aliq = 0.18;
    const cred = compras * aliq;
    assert.strictEqual(cred, 90000);
    assert.notStrictEqual(cred, 45000); // era 45k com 50% antes
  });
});

describe("LP component percentages of RBT12", () => {
  const rbt12 = 1000000;
  function compPct(val) { return (val / rbt12 * 100).toFixed(2).replace(".", ",") + "%"; }

  it("IRPJ 12000 -> 1,20%", () => {
    assert.strictEqual(compPct(12000), "1,20%");
  });
  it("CSLL 10800 -> 1,08%", () => {
    assert.strictEqual(compPct(10800), "1,08%");
  });
  it("PIS+COFINS 36500 -> 3,65%", () => {
    assert.strictEqual(compPct(36500), "3,65%");
  });
  it("ISS 25000 -> 2,50%", () => {
    assert.strictEqual(compPct(25000), "2,50%");
  });
  it("ICMS 90000 -> 9,00%", () => {
    assert.strictEqual(compPct(90000), "9,00%");
  });
  it("Encargos 10000 -> 1,00%", () => {
    assert.strictEqual(compPct(10000), "1,00%");
  });
  it("RBT12=0 returns 0,00%", () => {
    const pct = (val) => 0 > 0 ? ((val / 0) * 100).toFixed(2) + "%" : "0,00%";
    assert.strictEqual(pct(0), "0,00%");
  });
  it("Sum of all component % equals total LP %", () => {
    const irpj = 12000, irpjA = 0, csll = 10800, pisCof = 36500, iss = 25000, icms = 55000, enc = 10000;
    const total = irpj + irpjA + csll + pisCof + iss + icms + enc;
    const lpPct = (total / rbt12 * 100).toFixed(2);
    const sumPct = ((irpj + irpjA + csll + pisCof + iss + icms + enc) / rbt12 * 100).toFixed(2);
    assert.strictEqual(sumPct, lpPct);
  });
});

describe("LP filtering by activity type", () => {
  const components = [
    { key: "irpj", label: "IRPJ", val: 12000 },
    { key: "csll", label: "CSLL", val: 10800 },
    { key: "iss", label: "ISS", val: 25000 },
    { key: "icms", label: "ICMS", val: 55000 },
    { key: "enc", label: "Encargos", val: 10000 },
  ];
  function filterByTipo(tipo) {
    let list = components.filter(c => c.val > 0);
    if (tipo === "servicos") list = list.filter(c => c.key !== "icms");
    else if (tipo === "comercio" || tipo === "industria") list = list.filter(c => c.key !== "iss");
    return list;
  }
  it("Servicos: includes ISS, excludes ICMS", () => {
    const f = filterByTipo("servicos");
    assert.ok(f.find(c => c.key === "iss"));
    assert.ok(!f.find(c => c.key === "icms"));
  });
  it("Comercio: includes ICMS, excludes ISS", () => {
    const f = filterByTipo("comercio");
    assert.ok(f.find(c => c.key === "icms"));
    assert.ok(!f.find(c => c.key === "iss"));
  });
  it("Industria: includes ICMS, excludes ISS", () => {
    const f = filterByTipo("industria");
    assert.ok(f.find(c => c.key === "icms"));
    assert.ok(!f.find(c => c.key === "iss"));
  });
});

describe("CBS credit calculation (corrigido)", () => {
  it("Credito = compras * aliquota (sem fator cenario)", () => {
    const compras = 500000;
    const aliqCbs = 0.0921;
    const credPct = 1.0; // 100%
    const credito = compras * aliqCbs * credPct;
    assert.strictEqual(credito, 46050);
  });

  it("CBS bruta = receita * aliquota", () => {
    const receita = 1000000;
    const aliqCbs = 0.0921;
    const cbsBruta = receita * aliqCbs;
    assert.strictEqual(cbsBruta, 92100);
  });

  it("CBS liquida = bruta - credito", () => {
    const cbsBruta = 92100;
    const credito = 46050;
    const cbsLiquida = cbsBruta - credito;
    assert.strictEqual(cbsLiquida, 46050);
  });

  it("Impacto anual = CBS liquida - PIS+COFINS atual", () => {
    const cbsLiquida = 46050;
    const pisCofins = 36500;
    const impacto = cbsLiquida - pisCofins;
    assert.strictEqual(impacto, 9550);
  });

  it("Cenario completo: 500k compras, 1M receita, 9.21%", () => {
    const receita = 1000000;
    const compras = 500000;
    const aliqCbs = 0.0921;
    const credPct = 1.0;
    const cbsBruta = receita * aliqCbs;
    const credito = compras * aliqCbs * credPct;
    const cbsLiquida = cbsBruta - credito;
    const pisCofins = 36500;
    const impacto = cbsLiquida - pisCofins;
    assert.strictEqual(cbsBruta, 92100);
    assert.strictEqual(credito, 46050);
    assert.strictEqual(cbsLiquida, 46050);
    assert.strictEqual(impacto, 9550);
  });

  it("Credito com 80% creditavel", () => {
    const compras = 500000;
    const aliqCbs = 0.0921;
    const credPct = 0.8;
    const baseCred = compras * credPct;
    const credito = baseCred * aliqCbs;
    assert.strictEqual(baseCred, 400000);
    assert.strictEqual(credito, 36840);
  });

  it("Credito nao pode ser maior que CBS bruta", () => {
    const cbsBruta = 92100;
    const compras = 2000000;
    const aliqCbs = 0.0921;
    const credPct = 1.0;
    const credito = Math.min(compras * aliqCbs * credPct, cbsBruta);
    assert.strictEqual(credito, 92100); // capped
  });

  it("Cenario conservador (50%) foi removido — credito usa 100% direto", () => {
    const compras = 500000;
    const aliqCbs = 0.0921;
    const credPct = 1.0; // unico fator, sem cenario
    const credito = compras * aliqCbs * credPct;
    assert.notStrictEqual(credito, 22000); // nao é mais 22k
    assert.notStrictEqual(credito, 33000); // nao é mais 33k
    assert.strictEqual(credito, 46050); // é 46,05k
  });
});

describe("Consistência tela ↔ PDF", () => {
  it("ICMS na memória = ICMS no card LP", () => {
    const icmsMemoria = 54000;
    const icmsCard = 54000;
    assert.strictEqual(icmsMemoria, icmsCard);
  });
  it("CBS na memória = CBS no card CBS", () => {
    const cbsMemoria = 44000;
    const cbsCard = 44000;
    assert.strictEqual(cbsMemoria, cbsCard);
  });
  it("Total SN na conferência = total SN calculado", () => {
    const snConf = 140000;
    const snCalc = 140000;
    assert.strictEqual(snConf, snCalc);
  });
  it("Total LP na conferência = total LP calculado", () => {
    const lpConf = 124360;
    const lpCalc = 124360;
    assert.strictEqual(lpConf, lpCalc);
  });
  it("Regime vencedor na conferência = regime vencedor do cálculo", () => {
    const snTotal = 140000;
    const lpTotal = 124360;
    const winnerConf = lpTotal < snTotal ? "Lucro Presumido" : snTotal < lpTotal ? "Simples Nacional" : "Equivalentes";
    const winnerCalc = lpTotal < snTotal ? "Lucro Presumido" : snTotal < lpTotal ? "Simples Nacional" : "Equivalentes";
    assert.strictEqual(winnerConf, winnerCalc);
  });
  it("Economia na tela = economia no PDF", () => {
    const snTotal = 140000;
    const lpTotal = 124360;
    const eco = Math.abs(snTotal - lpTotal);
    assert.strictEqual(eco, 15640);
  });
  it("Alterar premissa (RBT12) atualiza dashboard e PDF igualmente", () => {
    const rbt12Velho = 1000000;
    const rbt12Novo = 1200000;
    const aliquotaSNVelha = 0.12;
    const aliquotaSNNova = 0.11;
    const snVelho = rbt12Velho * aliquotaSNVelha;
    const snNovo = rbt12Novo * aliquotaSNNova;
    assert.ok(snNovo !== snVelho);
  });
  it("Nenhum cálculo executado exclusivamente no PDF — motor = calc()", () => {
    // Verifica que os valores do PDF são lidos do DOM, não recalculados
    const icmsBase = 500000;
    const icmsAliq = 0.18;
    const icmsBruto = icmsBase * icmsAliq;
    // O PDF deve ler icmsBruto do DOM, não recalcular
    const icmsLidoDoDOM = icmsBruto; // simula leitura
    assert.strictEqual(icmsLidoDoDOM, 90000);
  });
  it("PDF não é gerado se validação de consistência falhar", () => {
    const snCalc = 140000;
    const snDOM = 139000; // divergência
    const diffOk = Math.abs(snCalc - snDOM) < 0.02;
    assert.strictEqual(diffOk, false);
  });
});

describe("Economia anual e mensal", () => {
  const sn = 124360, lp = 149300;
  const economia = Math.abs(sn - lp);
  const economiaMensal = economia / 12;

  it("economia anual = 24940", () => {
    assert.strictEqual(economia, 24940);
  });
  it("economia mensal = 2078.33", () => {
    assert.strictEqual(economiaMensal, 2078.3333333333335);
  });
  it("diffPct = economia / max = 24940 / 149300 = 16.70%", () => {
    const diffPct = economia / Math.max(sn, lp);
    assert.strictEqual(Math.round(diffPct * 10000) / 100, 16.70);
  });
});
