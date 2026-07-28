import { describe, it } from "node:test";
import assert from "node:assert";

function formatCurrencyBRL(value) {
  if (!isFinite(value) || value < 0) return "0,00";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrencyBRL(str) {
  if (!str) return 0;
  let s = str.replace(/[R$\s]/g, "").trim();
  if (!s) return 0;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastComma > lastDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(",", "");
  }
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

describe("formatCurrencyBRL", () => {
  it("formats 0", () => {
    assert.strictEqual(formatCurrencyBRL(0), "0,00");
  });
  it("formats 1.50", () => {
    assert.strictEqual(formatCurrencyBRL(1.5), "1,50");
  });
  it("formats 1000", () => {
    assert.strictEqual(formatCurrencyBRL(1000), "1.000,00");
  });
  it("formats 1000000", () => {
    assert.strictEqual(formatCurrencyBRL(1000000), "1.000.000,00");
  });
  it("formats 1234567.89", () => {
    assert.strictEqual(formatCurrencyBRL(1234567.89), "1.234.567,89");
  });
  it("handles negative as 0", () => {
    assert.strictEqual(formatCurrencyBRL(-100), "0,00");
  });
  it("handles NaN as 0", () => {
    assert.strictEqual(formatCurrencyBRL(NaN), "0,00");
  });
});

describe("parseCurrencyBRL", () => {
  it("parses empty string", () => {
    assert.strictEqual(parseCurrencyBRL(""), 0);
  });
  it("parses 0", () => {
    assert.strictEqual(parseCurrencyBRL("0"), 0);
  });
  it("parses 1.000,00", () => {
    assert.strictEqual(parseCurrencyBRL("1.000,00"), 1000);
  });
  it("parses 1.000.000,00", () => {
    const result = parseCurrencyBRL("1.000.000,00");
    assert.strictEqual(result, 1000000);
  });
  it("parses 100000000 as centavos sequence", () => {
    assert.strictEqual(parseCurrencyBRL("100000000"), 100000000);
  });
  it("parses R$ 1.000.000,00", () => {
    assert.strictEqual(parseCurrencyBRL("R$ 1.000.000,00"), 1000000);
  });
  it("parses numeric without separators", () => {
    assert.strictEqual(parseCurrencyBRL("500"), 500);
  });
});

describe("CurrencyInput formatting sequence", () => {
  function digitsToBRL(raw) {
    if (!raw) return "";
    const n = parseInt(raw, 10) / 100;
    return formatCurrencyBRL(n);
  }
  it("1 -> 0,01", () => {
    assert.strictEqual(digitsToBRL("1"), "0,01");
  });
  it("10 -> 0,10", () => {
    assert.strictEqual(digitsToBRL("10"), "0,10");
  });
  it("100 -> 1,00", () => {
    assert.strictEqual(digitsToBRL("100"), "1,00");
  });
  it("1000 -> 10,00", () => {
    assert.strictEqual(digitsToBRL("1000"), "10,00");
  });
  it("10000 -> 100,00", () => {
    assert.strictEqual(digitsToBRL("10000"), "100,00");
  });
  it("100000 -> 1.000,00", () => {
    assert.strictEqual(digitsToBRL("100000"), "1.000,00");
  });
  it("1000000 -> 10.000,00", () => {
    assert.strictEqual(digitsToBRL("1000000"), "10.000,00");
  });
  it("100000000 -> 1.000.000,00", () => {
    assert.strictEqual(digitsToBRL("100000000"), "1.000.000,00");
  });
});

describe("Round-trip consistency", () => {
  const values = [0, 0.01, 0.10, 1, 1.50, 100, 1000, 10000, 100000, 1000000, 1234567.89];
  for (const v of values) {
    it(`format -> parse returns original for ${v}`, () => {
      const formatted = formatCurrencyBRL(v);
      const parsed = parseCurrencyBRL(formatted);
      assert.strictEqual(parsed, v);
    });
  }
});
