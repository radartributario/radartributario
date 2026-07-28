import { describe, it } from "node:test";
import assert from "node:assert";

function cnaeToTipoAtiv(cnae) {
  if (!cnae) return "";
  const digits = cnae.replace(/\D/g, "");
  const div = parseInt(digits.substring(0, 2)) || 0;
  if (div >= 10 && div <= 33) return "industria";
  if (div >= 41 && div <= 43) return "servicos";
  if (div >= 45 && div <= 47) return "comercio";
  if (div >= 55 && div <= 56) return "servicos";
  if (div >= 58 && div <= 60) return "servicos";
  if (div >= 61 && div <= 63) return "servicos";
  if ((div >= 64 && div <= 66) || (div >= 68 && div <= 82)) return "servicos";
  if (div >= 85 && div <= 88) return "servicos";
  if (div >= 90 && div <= 96) return "servicos";
  return "servicos";
}

describe("CNAE classification to Tipo de Atividade", () => {
  // CASO 1 — Comércio
  it("CASO 1: CNAE comércio (4711100) -> comercio", () => {
    assert.strictEqual(cnaeToTipoAtiv("4711100"), "comercio");
  });
  it("CASO 1: CNAE comércio atacadista (4631100) -> comercio", () => {
    assert.strictEqual(cnaeToTipoAtiv("4631100"), "comercio");
  });
  it("CASO 1: CNAE comércio varejista (4711300) -> comercio", () => {
    assert.strictEqual(cnaeToTipoAtiv("4711300"), "comercio");
  });

  // CASO 2 — Indústria
  it("CASO 2: CNAE indústria (1012100) -> industria", () => {
    assert.strictEqual(cnaeToTipoAtiv("1012100"), "industria");
  });
  it("CASO 2: CNAE fabricação (2829100) -> industria", () => {
    assert.strictEqual(cnaeToTipoAtiv("2829100"), "industria");
  });
  it("CASO 2: CNAE fabricação (3314700) -> industria", () => {
    assert.strictEqual(cnaeToTipoAtiv("3314700"), "industria");
  });

  // CASO 3 — Serviços
  it("CASO 3: CNAE serviços (6201500) -> servicos", () => {
    assert.strictEqual(cnaeToTipoAtiv("6201500"), "servicos");
  });
  it("CASO 3: CNAE consultoria (7020400) -> servicos", () => {
    assert.strictEqual(cnaeToTipoAtiv("7020400"), "servicos");
  });
  it("CASO 3: CNAE saúde (8610100) -> servicos", () => {
    assert.strictEqual(cnaeToTipoAtiv("8610100"), "servicos");
  });
  it("CASO 3: CNAE advocacia (6911700) -> servicos", () => {
    assert.strictEqual(cnaeToTipoAtiv("6911700"), "servicos");
  });

  // CASO 4 — Educação
  it("CASO 4: CNAE educação (8512100) -> servicos", () => {
    assert.strictEqual(cnaeToTipoAtiv("8512100"), "servicos");
  });

  // Formatos com traço
  it("Formato com traço: 4711-3/00 -> comercio", () => {
    assert.strictEqual(cnaeToTipoAtiv("4711-3/00"), "comercio");
  });
  it("Formato com traço: 6201-5/00 -> servicos", () => {
    assert.strictEqual(cnaeToTipoAtiv("6201-5/00"), "servicos");
  });
  it("Formato com traço: 1012-1/00 -> industria", () => {
    assert.strictEqual(cnaeToTipoAtiv("1012-1/00"), "industria");
  });

  // Construção
  it("Construção (4120400) -> servicos", () => {
    assert.strictEqual(cnaeToTipoAtiv("4120400"), "servicos");
  });

  // Empty / invalid
  it("Empty cnae returns empty", () => {
    assert.strictEqual(cnaeToTipoAtiv(""), "");
  });
  it("Undefined returns empty", () => {
    assert.strictEqual(cnaeToTipoAtiv(undefined), "");
  });

  // Exemplo dos requisitos: Comércio varejista -> comercio
  it("Exemplo req: Comércio varejista", () => {
    assert.strictEqual(cnaeToTipoAtiv("4711100"), "comercio");
  });
  it("Exemplo req: Fabricação de produtos -> industria", () => {
    assert.strictEqual(cnaeToTipoAtiv("1012100"), "industria");
  });
  it("Exemplo req: Consultoria -> servicos", () => {
    assert.strictEqual(cnaeToTipoAtiv("7020400"), "servicos");
  });
  it("Exemplo req: Tecnologia -> servicos", () => {
    assert.strictEqual(cnaeToTipoAtiv("6201500"), "servicos");
  });
  it("Exemplo req: Publicidade -> servicos", () => {
    assert.strictEqual(cnaeToTipoAtiv("7311400"), "servicos");
  });
});

describe("Consistency with calc engine", () => {
  // Simula a função getCnaeCategoria do comparador.html para garantir compatibilidade
  function getCnaeCategoria(codigo) {
    if (!codigo) return 'servico';
    const classe = (codigo+'').split('/')[0];
    const digits = classe.replace(/\D/g,'');
    const div = parseInt(digits.substring(0,2)) || 0;
    if (div >= 10 && div <= 33) return 'industria';
    if (div >= 45 && div <= 47) return 'comercio';
    if (div >= 41 && div <= 43) return 'construcao';
    return 'servico';
  }
  // getCnaeCategoria returns 'comercio'/'industria'/'servico'/'construcao'
  // cnaeToTipoAtiv returns 'comercio'/'industria'/'servicos'
  // Map: comercio->comercio, industria->industria, servico->servicos, construcao->servicos
  function mapCategoria(v) {
    return v === 'servico' || v === 'construcao' ? 'servicos' : v;
  }

  it("4711100: getCnaeCategoria and cnaeToTipoAtiv agree", () => {
    const c1 = mapCategoria(getCnaeCategoria("4711100"));
    const c2 = cnaeToTipoAtiv("4711100");
    assert.strictEqual(c1, c2);
  });
  it("7020400 (consultoria): both return servicos", () => {
    const c1 = mapCategoria(getCnaeCategoria("7020400"));
    const c2 = cnaeToTipoAtiv("7020400");
    assert.strictEqual(c1, c2);
  });
  it("1012100 (indústria): both return industria", () => {
    const c1 = mapCategoria(getCnaeCategoria("1012100"));
    const c2 = cnaeToTipoAtiv("1012100");
    assert.strictEqual(c1, c2);
  });
});
