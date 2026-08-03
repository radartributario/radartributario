import { describe, it } from "node:test";
import assert from "node:assert";

describe("Motor de Elegibilidade — Simples Nacional", () => {
  function checkEligibility(rbt12, cnae) {
    const result = { sn: { elegivel: true, motivo: "" }, lp: { elegivel: true, motivo: "" }, hasBlock: false, hipotetica: false };
    const LIMITE_SN = 4800000;
    if (rbt12 > LIMITE_SN) {
      result.sn.elegivel = false;
      result.sn.motivo = "Receita superior ao limite legal de R$ 4.800.000,00.";
      result.hasBlock = true;
    }
    if (cnae) {
      const classe = cnae.split("/")[0];
      const dig2 = parseInt(classe.replace(/\D/g, "").substring(0, 2)) || 0;
      const ativImpeditivas = [64, 65, 66, 51, 50, 49];
      if (ativImpeditivas.includes(dig2)) {
        result.sn.elegivel = false;
        result.sn.motivo = "Atividade incompatível com o Simples Nacional (CNAE " + dig2 + "xx).";
        result.hasBlock = true;
      }
    }
    return result;
  }

  it("RBT12 <= 4.8M -> SN elegivel", () => {
    const r = checkEligibility(4800000, "4711-3/01");
    assert.ok(r.sn.elegivel);
    assert.ok(!r.hasBlock);
  });

  it("RBT12 > 4.8M -> SN nao elegivel", () => {
    const r = checkEligibility(5000000, "4711-3/01");
    assert.ok(!r.sn.elegivel);
    assert.ok(r.hasBlock);
    assert.ok(r.sn.motivo.includes("4.800.000"));
  });

  it("CNAE financeiro (64xx) -> SN nao elegivel", () => {
    const r = checkEligibility(1000000, "6410-7/01");
    assert.ok(!r.sn.elegivel);
    assert.ok(r.hasBlock);
  });

  it("RBT12 < 4.8M e CNAE comercio -> SN elegivel", () => {
    const r = checkEligibility(1000000, "4711-3/01");
    assert.ok(r.sn.elegivel);
    assert.ok(!r.hasBlock);
  });

  it("RBT12 > 4.8M e CNAE servico -> SN nao elegivel (receita)", () => {
    const r = checkEligibility(10000000, "6201-1/01");
    assert.ok(!r.sn.elegivel);
    assert.ok(r.sn.motivo.includes("4.800.000"));
  });

  it("CNAE vazio -> sem impeditivo por CNAE", () => {
    const r = checkEligibility(1000000, "");
    assert.ok(r.sn.elegivel);
    assert.ok(!r.hasBlock);
  });
});

describe("Segregacao das Receitas", () => {
  function validateSegregacao(rbt12, tipoAtiv, segregPct) {
    const errors = [];
    const receitaServicos = rbt12 * (segregPct / 100);
    const receitaComercio = rbt12 * ((100 - segregPct) / 100);
    const receitaIndustrial = tipoAtiv === "industria" ? receitaComercio : 0;
    const soma = receitaServicos + receitaComercio;

    if (tipoAtiv === "industria" && segregPct > 50) {
      errors.push("Indústria deve ter receita industrial predominante.");
    }
    if (tipoAtiv === "servicos" && segregPct < 50) {
      errors.push("Serviços deve ter receita de serviços predominante.");
    }
    if (tipoAtiv === "comercio" && segregPct > 50) {
      errors.push("Comércio deve ter receita de comércio predominante.");
    }
    if (Math.abs(soma - rbt12) > 1) {
      errors.push("Soma das receitas difere da RBT12.");
    }

    return { errors };
  }

  it("Industria 30% servicos -> ok", () => {
    const r = validateSegregacao(1000000, "industria", 30);
    assert.strictEqual(r.errors.length, 0);
  });

  it("Industria 70% servicos -> erro", () => {
    const r = validateSegregacao(1000000, "industria", 70);
    assert.ok(r.errors.length > 0);
    assert.ok(r.errors[0].includes("Indústria"));
  });

  it("Servicos 30% servicos -> erro", () => {
    const r = validateSegregacao(1000000, "servicos", 30);
    assert.ok(r.errors.length > 0);
    assert.ok(r.errors[0].includes("Serviços"));
  });

  it("Comercio 70% servicos -> erro", () => {
    const r = validateSegregacao(1000000, "comercio", 70);
    assert.ok(r.errors.length > 0);
    assert.ok(r.errors[0].includes("Comércio"));
  });

  it("Servicos 80% servicos -> ok", () => {
    const r = validateSegregacao(1000000, "servicos", 80);
    assert.strictEqual(r.errors.length, 0);
  });

  it("Comercio 20% servicos -> ok", () => {
    const r = validateSegregacao(1000000, "comercio", 20);
    assert.strictEqual(r.errors.length, 0);
  });
});

describe("IRPJ Adicional Memory", () => {
  it("Receita 5M, pres 8% -> adicional = 34k", () => {
    const receita = 5000000;
    const pres = 0.08;
    const baseIRPJ = receita * pres;
    const adicional = Math.max(0, baseIRPJ - 60000) * 0.10;
    assert.strictEqual(baseIRPJ, 400000);
    assert.strictEqual(adicional, 34000);
  });

  it("Receita 1M, pres 8% -> adicional = 2k", () => {
    const receita = 1000000;
    const pres = 0.08;
    const baseIRPJ = receita * pres;
    const adicional = Math.max(0, baseIRPJ - 60000) * 0.10;
    assert.strictEqual(baseIRPJ, 80000);
    assert.strictEqual(adicional, 2000);
  });

  it("Receita 3M, pres 32% -> adicional presente", () => {
    const receita = 3000000;
    const pres = 0.32;
    const baseIRPJ = receita * pres;
    const adicional = Math.max(0, baseIRPJ - 60000) * 0.10;
    assert.strictEqual(baseIRPJ, 960000);
    assert.strictEqual(adicional, 90000);
  });

  it("Excedente = baseIRPJ - 60000", () => {
    const baseIRPJ = 400000;
    const excedente = Math.max(0, baseIRPJ - 60000);
    assert.strictEqual(excedente, 340000);
  });

  it("Excedente = 0 quando base <= 60k", () => {
    const baseIRPJ = 60000;
    const excedente = Math.max(0, baseIRPJ - 60000);
    assert.strictEqual(excedente, 0);
  });
});

describe("Validadores Tributários", () => {
  function validateAll(rbt12, compras, cnae, tipoAtiv, aliqICMS, aliqISS, aliqIPI, segr) {
    const errors = [];
    const warnings = [];
    const classe = cnae ? cnae.split("/")[0].replace(/\D/g, "") : "";
    const dig2 = parseInt(classe.substring(0, 2)) || 0;

    if (rbt12 <= 0) errors.push("RBT12 deve ser maior que zero.");
    if (!cnae) errors.push("CNAE é obrigatório.");
    if (!tipoAtiv) errors.push("Tipo de Atividade (LP) é obrigatório.");
    if (rbt12 > 4800000) errors.push("Receita superior ao limite do Simples Nacional.");
    if (compras > 0 && rbt12 > 0 && compras > rbt12 * 3) warnings.push("Compras muito superiores à receita.");
    if ((tipoAtiv === "comercio" || tipoAtiv === "industria") && aliqICMS === 0) warnings.push("ICMS zerado para " + tipoAtiv + ".");
    if (tipoAtiv === "servicos" && aliqISS === 0) warnings.push("ISS zerado para serviços.");
    if (tipoAtiv === "industria" && aliqIPI === 0) warnings.push("IPI zerado para indústria.");
    if (tipoAtiv === "industria" && segr > 0.5) errors.push("Segregação incompatível: indústria deve ter receita industrial predominante.");
    if (tipoAtiv === "servicos" && segr < 0.5) errors.push("Segregação incompatível: serviços deve ter receita de serviços predominante.");
    if (tipoAtiv === "comercio" && segr > 0.5) errors.push("Segregação incompatível: comércio deve ter receita de comércio predominante.");
    if (dig2 >= 10 && dig2 <= 33 && tipoAtiv !== "industria") warnings.push("CNAE sugere indústria.");
    if (dig2 >= 45 && dig2 <= 47 && tipoAtiv !== "comercio") warnings.push("CNAE sugere comércio.");

    return { errors, warnings };
  }

  it("RBT12 zero -> erro", () => {
    const r = validateAll(0, 0, "4711-3/01", "comercio", 0.18, 0, 0, 0);
    assert.ok(r.errors.length > 0);
  });

  it("CNAE vazio -> erro", () => {
    const r = validateAll(1000000, 0, "", "comercio", 0.18, 0, 0, 0);
    assert.ok(r.errors.length > 0);
    assert.ok(r.errors.some(e => e.includes("CNAE")));
  });

  it("ICMS zerado para comercio -> warning", () => {
    const r = validateAll(1000000, 0, "4711-3/01", "comercio", 0, 0, 0, 0);
    assert.ok(r.warnings.some(w => w.includes("ICMS")));
  });

  it("ISS zerado para servicos -> warning", () => {
    const r = validateAll(1000000, 0, "6201-1/01", "servicos", 0, 0, 0, 0);
    assert.ok(r.warnings.some(w => w.includes("ISS")));
  });

  it("IPI zerado para industria -> warning", () => {
    const r = validateAll(1000000, 0, "1012-1/01", "industria", 0.18, 0, 0, 0);
    assert.ok(r.warnings.some(w => w.includes("IPI")));
  });

  it("Industria 70% servicos -> erro (segregacao)", () => {
    const r = validateAll(1000000, 0, "1012-1/01", "industria", 0.18, 0, 0, 0.7);
    assert.ok(r.errors.some(e => e.includes("Segregação")));
  });

  it("Servicos 30% servicos -> erro (segregacao)", () => {
    const r = validateAll(1000000, 0, "6201-1/01", "servicos", 0, 0.05, 0, 0.3);
    assert.ok(r.errors.some(e => e.includes("Segregação")));
  });

  it("Comercio 70% servicos -> erro (segregacao)", () => {
    const r = validateAll(1000000, 0, "4711-3/01", "comercio", 0.18, 0, 0, 0.7);
    assert.ok(r.errors.some(e => e.includes("Segregação")));
  });

  it("CNAE comercio (47xx) com tipo servicos -> warning", () => {
    const r = validateAll(1000000, 0, "4711-3/01", "servicos", 0, 0.025, 0, 100);
    assert.ok(r.warnings.some(w => w.includes("CNAE") && w.includes("comércio")));
  });

  it("RBT12 > 4.8M -> erro", () => {
    const r = validateAll(5000000, 0, "4711-3/01", "comercio", 0.18, 0, 0, 0);
    assert.ok(r.errors.some(e => e.includes("4.800.000") || e.includes("limite")));
  });

  it("Compras 10x receita -> warning", () => {
    const r = validateAll(1000000, 10000000, "4711-3/01", "comercio", 0.18, 0, 0, 0);
    assert.ok(r.warnings.some(w => w.includes("Compras")));
  });

  it("Empresa valida sem erros", () => {
    const r = validateAll(1000000, 500000, "4711-3/01", "comercio", 0.18, 0, 0, 0);
    assert.strictEqual(r.errors.length, 0);
  });

  it("Empresa industrial valida (0% servicos, abaixo 4.8M)", () => {
    const r = validateAll(3600000, 2000000, "1012-1/01", "industria", 0.18, 0, 0.05, 0);
    assert.strictEqual(r.errors.length, 0);
  });

  it("Empresa de servicos valida (100% servicos)", () => {
    const r = validateAll(1000000, 50000, "6201-1/01", "servicos", 0, 0.05, 0, 1);
    assert.strictEqual(r.errors.length, 0);
  });

  it("Empresa acima do SN (5M) — erro limite", () => {
    const r = validateAll(5000000, 2000000, "4711-3/01", "comercio", 0.18, 0, 0, 0);
    assert.ok(r.errors.some(e => e.includes("limite") || e.includes("4.800.000")));
  });

  it("Empresa abaixo do SN (1M) — sem erro de limite", () => {
    const r = validateAll(1000000, 500000, "4711-3/01", "comercio", 0.18, 0, 0, 0);
    assert.ok(!r.errors.some(e => e.includes("limite")));
  });

  it("CNAE industria com tipo servicos -> warning", () => {
    const r = validateAll(1000000, 0, "1012-1/01", "servicos", 0, 0.05, 0, 1);
    assert.ok(r.warnings.some(w => w.includes("CNAE")));
  });
});

describe("Elegibilidade com hipotetica", () => {
  it("SN bloqueado -> vencedor = LP", () => {
    const eligBlocked = true;
    const hipoteticaChecked = false;
    const sn = 100000, lp = 150000;
    const winner = eligBlocked && !hipoteticaChecked ? "LUCRO PRESUMIDO"
      : sn < lp ? "SIMPLES NACIONAL" : lp < sn ? "LUCRO PRESUMIDO" : "EQUIVALENTES";
    assert.strictEqual(winner, "LUCRO PRESUMIDO");
  });

  it("SN bloqueado + hipotetica -> compara normalmente", () => {
    const eligBlocked = true;
    const hipoteticaChecked = true;
    const sn = 100000, lp = 150000;
    const winner = eligBlocked && !hipoteticaChecked ? "LUCRO PRESUMIDO"
      : sn < lp ? "SIMPLES NACIONAL" : lp < sn ? "LUCRO PRESUMIDO" : "EQUIVALENTES";
    assert.strictEqual(winner, "SIMPLES NACIONAL");
  });
});

describe("ICMS — débito, crédito e líquido", () => {
  it("Receita 5M, ICMS 18%, compras 3M -> ICMS liquido 360k", () => {
    const receita = 5000000, aliq = 0.18, compras = 3000000;
    const debito = receita * aliq;
    const credito = compras * aliq;
    const liquido = Math.max(0, debito - credito);
    assert.strictEqual(debito, 900000);
    assert.strictEqual(credito, 540000);
    assert.strictEqual(liquido, 360000);
  });

  it("Receita 1M, ICMS 12%, sem compras -> ICMS liquido 120k", () => {
    const receita = 1000000, aliq = 0.12, compras = 0;
    const liquido = Math.max(0, receita * aliq - compras * aliq);
    assert.strictEqual(liquido, 120000);
  });

  it("Credito superior ao debito -> ICMS liquido = 0", () => {
    const receita = 100000, aliq = 0.18, compras = 500000;
    const liquido = Math.max(0, receita * aliq - compras * aliq);
    assert.strictEqual(liquido, 0);
  });
});

describe("CBS — bruta, credito e liquida", () => {
  it("Receita 5M, aliq 8.8%, sem credito -> CBS 440k", () => {
    const receita = 5000000, aliq = 0.088, credito = 0;
    const bruta = receita * aliq;
    const liquida = Math.max(0, bruta - credito);
    assert.strictEqual(bruta, 440000);
    assert.strictEqual(liquida, 440000);
  });

  it("Receita 5M, aliq 8.8%, credito 264k -> CBS 176k", () => {
    const receita = 5000000, aliq = 0.088, credito = 264000;
    const liquida = Math.max(0, receita * aliq - credito);
    assert.strictEqual(liquida, 176000);
  });

  it("Credito superior -> CBS = 0", () => {
    const receita = 1000000, aliq = 0.088, credito = 500000;
    const liquida = Math.max(0, receita * aliq - credito);
    assert.strictEqual(liquida, 0);
  });
});

describe("Impacto CBS — verbo correto", () => {
  it("Impacto negativo -> reducao", () => {
    const impacto = -6500;
    const verbo = impacto < 0 ? "redução" : impacto > 0 ? "aumento" : "neutro";
    assert.strictEqual(verbo, "redução");
  });

  it("Impacto positivo -> aumento", () => {
    const impacto = 10000;
    const verbo = impacto < 0 ? "redução" : impacto > 0 ? "aumento" : "neutro";
    assert.strictEqual(verbo, "aumento");
  });

  it("Impacto zero -> neutro", () => {
    const impacto = 0;
    const verbo = impacto < 0 ? "redução" : impacto > 0 ? "aumento" : "neutro";
    assert.strictEqual(verbo, "neutro");
  });
});

describe("Base Legal Dinâmica", () => {
  it("SN elegivel -> mostra leis SN", () => {
    const snElegivel = true;
    const snLegal = snElegivel
      ? "LC 123/2006 (arts. 17-18)"
      : "Não aplicável";
    assert.strictEqual(snLegal, "LC 123/2006 (arts. 17-18)");
  });

  it("SN nao elegivel -> nao aplicavel", () => {
    const snElegivel = false;
    const snLegal = snElegivel
      ? "LC 123/2006 (arts. 17-18)"
      : "Não aplicável";
    assert.strictEqual(snLegal, "Não aplicável");
  });

  it("ISS citado apenas para servicos", () => {
    const tipoAtiv = "servicos";
    const issLegal = tipoAtiv === "servicos" ? "LC 116/2003" : "";
    assert.strictEqual(issLegal, "LC 116/2003");
  });

  it("ISS nao citado para industria", () => {
    const tipoAtiv = "industria";
    const issLegal = tipoAtiv === "servicos" ? "LC 116/2003" : "";
    assert.strictEqual(issLegal, "");
  });
});

describe("Recomendacao — SN nao elegivel", () => {
  it("SN bloqueado -> texto de nao elegivel", () => {
    const eligBlocked = true;
    const hipotetica = false;
    const motivo = eligBlocked && !hipotetica
      ? "A empresa não é elegível ao Simples Nacional por exceder o teto legal de R$ 4.800.000,00."
      : "Elegível";
    assert.ok(motivo.includes("não é elegível"));
  });

  it("SN bloqueado + hipotetica -> texto normal", () => {
    const eligBlocked = true;
    const hipotetica = true;
    const motivo = eligBlocked && !hipotetica
      ? "A empresa não é elegível"
      : "Comparação hipotética";
    assert.strictEqual(motivo, "Comparação hipotética");
  });
});

describe("CBS Premissas (sem credito como compras)", () => {
  it("Base de compras = 500k, credito = 44k, labels corretas", () => {
    const cbsComprasVal = 500000;
    const cbsPctCred = 100;
    const cbsBaseCred = cbsComprasVal * (cbsPctCred / 100);
    const aliqCbs = 0.088;
    const cbsCredCalc = cbsBaseCred * aliqCbs;
    assert.strictEqual(cbsComprasVal, 500000);
    assert.strictEqual(cbsBaseCred, 500000);
    assert.strictEqual(cbsCredCalc, 44000);
  });
});
