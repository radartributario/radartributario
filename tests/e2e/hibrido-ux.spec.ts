import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const EMAIL = process.env.EMAIL_TEST;
const PASSWORD = process.env.PASSWORD_TEST;

test.skip(!(EMAIL && PASSWORD), "Defina EMAIL_TEST e PASSWORD_TEST para executar os testes E2E");
const OUT = "C:/Users/TECHNO~1/AppData/Local/Temp/opencode";

// ---------------------------------------------------------------------------
// Motor compartilhado: carrega o mesmo motor tributário da aplicação e deriva os
// valores esperados dos próprios fluxos (nada de números monetários hardcoded).
// Formatação compatível com tests/helpers/tributaryAuditHelpers.mjs.
// ---------------------------------------------------------------------------
interface Hybrid {
  simplesTradicional: { total: number; das: number; aliquota: number };
  simplesHibrido: {
    dasIntegral: number;
    dasReduzido: number;
    parcelaCbsRetiradaDoDas: number;
    cbsLiquida: number;
    total: number;
    aliquota: number;
  };
  comparacaoFinanceira: { valorAnual: number; valorMensal: number };
}

function money(value: number): string {
  const cents = Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  return `R$ ${cents.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pct(value: number): string {
  const rounded = Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  return `${rounded.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function mockEl(overrides: Record<string, unknown> = {}) {
  return {
    value: "", innerHTML: "", textContent: "", style: {}, classList: { add: () => {}, remove: () => {} },
    disabled: false, checked: false, options: [], selectedIndex: -1, dataset: {}, ...overrides,
  };
}
type Engine = { calcularComparacaoSimplesHibrido: (form: Record<string, string>) => Hybrid };
function loadEngine(): Engine {
  const html = readFileSync(path.join(process.cwd(), "public", "comparador.html"), "utf-8");
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("No script found");
  const code = match[1];
  const initIdx = code.indexOf("// ===== INIT ===");
  const toEval = code.substring(0, initIdx !== -1 ? initIdx : code.length);
  const doc = { getElementById: () => mockEl(), querySelector: () => mockEl(), querySelectorAll: () => [], createElement: () => mockEl(), createTextNode: () => ({}) };
  const win = {
    CNAE_TAX_DATA: {}, CNAE_ANEXO_IV: new Set(), CNAE_FATOR_R: new Set(["6201-5","6202-3","6203-1","6204-0","6209-1","6911-7","6920-6","7020-4","7111-1","7311-4"]),
    addEventListener: () => {}, getCbsTreatment: () => ({}), location: { href: "" },
  };
  const fn = new Function("window", "document", "console", toEval + "; return { calcularComparacaoSimplesHibrido };");
  return fn(win, doc, console);
}

function calcHibrido(rbt12: string, compras: string, cnae = "6920-6/01"): Hybrid {
  const engine = loadEngine();
  const r = engine.calcularComparacaoSimplesHibrido({
    rbt12Input: rbt12, comprasInput: compras, salarios: "0", prolabore: "0",
    inss: "20", rat: "3", terceiros: "3.3", fgts: "8", aliquotaISS: "2.5", aliquotaICMS: "0",
    tipoAtivLP: "servicos", cnae, anoSIM: "2027", optOutPct: "100",
    aliqCbsFora: "9.21", aliqCbsCompras: "9.21",
  });
  if (r.error) throw new Error(r.error);
  return r;
}

async function login(page) {
  await page.route("**/api/auth/login", async (route) => {
    const response = await route.fetch();
    const headers = response.headers();
    const setCookie = headers["set-cookie"] || headers["Set-Cookie"] || "";
    const modified = setCookie.replace(/;\s*Secure\s*(?=;|$)/gi, "");
    await route.fulfill({ status: response.status(), headers: { ...headers, "set-cookie": modified }, body: await response.body() });
  });
  await page.goto("/auth/login");
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.waitForLoadState("networkidle");
}

async function openHibrido(page) {
  const cards = page.locator("button:has(h3)");
  await expect(cards).toHaveCount(3, { timeout: 30000 });
  await expect(page.locator("text=Preparando motor de cálculo")).not.toBeVisible({ timeout: 10000 });
}

async function fillEconomicos(page, rbt12, compras, cnae) {
  await page.fill("#cnae", cnae);
  await page.fill("#cnpj", "11222333000181");
  const ecoHeader = page.locator("h3:has-text('Dados Econômicos')");
  if (await ecoHeader.isVisible().catch(() => false)) await ecoHeader.click();
  await page.fill("#rbt12Input", rbt12);
  await page.fill("#comprasInput", compras);
  await page.fill("#salarios", "0");
  await page.fill("#prolabore", "0");
  const btn = page.locator("button:has(h3)").nth(1);
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await expect(page.locator("[data-testid='executive-conclusion']")).toBeVisible({ timeout: 60000 });
}

async function expectNoPendingLanguage(page) {
  const forbidden = /Pendente|Benefício pendente|Status|Não há vencedor definitivo|Resultado indefinido/i;
  expect(await page.locator("body").innerText()).not.toMatch(forbidden);
}

async function expectSingleLine(page, text) {
  const locator = page.getByText(text, { exact: true }).first();
  await expect(locator).toBeVisible();
  const isSingleLine = await locator.evaluate((el) => {
    const candidates = [el, ...Array.from(el.querySelectorAll("*"))];
    const target = candidates.find((node) => node.textContent?.trim() === el.textContent?.trim() && getComputedStyle(node).whiteSpace === "nowrap") || el;
    const style = getComputedStyle(target);
    return style.whiteSpace === "nowrap" && target.getClientRects().length === 1;
  });
  expect(isSingleLine, `${text} deve permanecer em uma única linha`).toBeTruthy();
}

async function expectNoHorizontalScroll(page) {
  const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(hasHorizontalScroll).toBeFalsy();
}

async function expectMemoryCardsStacked(page) {
  const metrics = await page.locator("[data-testid='calculation-memory-section']").evaluate((section) => {
    const sectionBox = section.getBoundingClientRect();
    const cards = Array.from(section.querySelectorAll("[data-testid='memory-card']")).map((child) => child.getBoundingClientRect());
    return {
      sectionWidth: sectionBox.width,
      count: cards.length,
      leftGap: Math.abs(cards[0].left - cards[1].left),
      topGap: cards[1].top - cards[0].bottom,
      widths: cards.map((card) => card.width),
    };
  });
  expect(metrics.count).toBe(2);
  expect(metrics.leftGap).toBeLessThanOrEqual(2);
  expect(metrics.topGap).toBeGreaterThan(0);
  expect(metrics.widths[0]).toBeGreaterThan(0);
  expect(Math.abs(metrics.widths[0] - metrics.widths[1])).toBeLessThanOrEqual(4);
  expect(metrics.widths[0] / metrics.sectionWidth).toBeGreaterThan(0.85);
}

async function expectSectionOrder(page) {
  const order = await page.locator("[data-testid='result-section'], [data-testid='premises-section'], [data-testid='calculation-memory-section'], [data-testid='executive-conclusion']").evaluateAll((sections) => sections.map((section) => section.getAttribute("data-testid")));
  expect(order).toEqual(["result-section", "premises-section", "calculation-memory-section", "executive-conclusion"]);
}

test.describe("UX Simples Tradicional x Híbrido", () => {
  test("desktop exibe benefício sem status, conclusão objetiva e memória vertical", async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: 1920, height: 1200 });
    await login(page);
    await openHibrido(page);
    await fillEconomicos(page, "120000000", "20000000", "6920-6/01");
    const r = calcHibrido("120000000", "20000000");
    const tradTotal = money(r.simplesTradicional.total);
    const hibTotal = money(r.simplesHibrido.total);
    const dasReduzido = money(r.simplesHibrido.dasReduzido);
    const parcelaCbs = money(r.simplesHibrido.parcelaCbsRetiradaDoDas);
    const cbsLiquida = money(r.simplesHibrido.cbsLiquida);
    const diffAnual = money(r.comparacaoFinanceira.valorAnual);
    const diffMensal = money(r.comparacaoFinanceira.valorMensal);

    await expect(page.locator("text=Resultado Executivo").first()).toBeVisible();
    await expect(page.locator("text=Premissas Utilizadas na Simulação").first()).toBeVisible();
    await expect(page.locator("text=Menor carga tributária").first()).toBeVisible();
    await expect(page.locator("[data-testid='impact-card']")).toHaveAttribute("data-tone", "red");
    await expect(page.locator("[data-testid='impact-card']")).toContainText("Aumento de Carga");
    await expect(page.locator("[data-testid='impact-card']")).toContainText("Simples Tradicional");
    await expect(page.locator("text=Memória de Cálculo").first()).toBeVisible();
    await expect(page.locator("text=Comparação Visual").first()).toBeVisible();
    await expect(page.locator("text=Benefício Fiscal").first()).toBeVisible();
    await expectSectionOrder(page);
    await expectNoPendingLanguage(page);
    await expect(page.locator(`text=${hibTotal}`).first()).toBeVisible();
    await expect(page.locator(`text=${dasReduzido}`).first()).toBeVisible();
    await expect(page.locator(`text=${pct(r.simplesTradicional.aliquota)}`).first()).toBeVisible();
    await expect(page.locator(`text=${pct(r.simplesHibrido.aliquota)}`).first()).toBeVisible();
    await expect(page.locator("text=Sem recalcular tributos na interface; dados consumidos do motor.")).toHaveCount(0);
    for (const value of [tradTotal, hibTotal, dasReduzido, parcelaCbs, cbsLiquida, diffAnual, diffMensal]) {
      await expectSingleLine(page, value);
    }
    await page.screenshot({ path: `${OUT}/hibrido-dashboard-desktop-1920.png`, fullPage: true });

    const memorySection = page.locator("[data-testid='calculation-memory-section']");
    const memoryCards = memorySection.locator("[data-testid='memory-card']");
    const hibridoColumn = memoryCards.nth(1);
    await expect(memorySection).toContainText("Memória de Cálculo");
    await expect(memorySection).toContainText("Resumo da formação dos valores");
    await expect(memoryCards.nth(0)).toContainText("Simples Tradicional");
    await expect(hibridoColumn).toContainText("Simples Híbrido");
    await expect(memoryCards.nth(0)).toContainText("Tributo");
    await expect(memoryCards.nth(0)).toContainText("Valor Anual");
    for (const label of ["IRPJ", "CSLL", "CPP", "ISS", "CBS"]) {
      await expect(memoryCards.nth(0).getByText(label, { exact: true })).toBeVisible();
    }
    for (const label of ["PIS", "COFINS", "ICMS", "IPI", "IBS"]) {
      await expect(memoryCards.nth(0).getByText(label, { exact: true })).toHaveCount(0);
    }
    await expect(memoryCards.nth(0).getByRole("button", { name: /Ver memória detalhada/i })).toHaveCount(0);
    await expectMemoryCardsStacked(page);
    const sectionHeight = await memorySection.evaluate((el) => el.getBoundingClientRect().height);
    expect(sectionHeight).toBeLessThan(1200);
    await hibridoColumn.getByRole("button", { name: /Ver memória detalhada/i }).click();
    await expect(hibridoColumn).toContainText("Formação do Total Híbrido");
    await expect(hibridoColumn).toContainText("Memória da CBS");
    await expect(hibridoColumn).toContainText("CBS Líquida");
    await expect(hibridoColumn).not.toContainText("IBS em 2027");
    await expect(memorySection).toContainText("Observação: Nesta premissa do simulador, o IBS permanece recolhido dentro do DAS");
    for (const label of ["DAS Original", "(-) CBS retirada", "(=) DAS reduzido", "(+) CBS Líquida", "TOTAL HÍBRIDO", "Alíquota Legal", "Redução Legal", "Alíquota Aplicada", "Receita Tributável", "Débito (9,21%)", "Compras com Crédito", "Crédito (9,21%)", "CBS Líquida"]) {
      const item = hibridoColumn.getByText(label, { exact: true }).first();
      await expect(item).toBeVisible();
    }
    await page.setViewportSize({ width: 1600, height: 1100 });
    await expectNoHorizontalScroll(page);
    await expectMemoryCardsStacked(page);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await expectNoHorizontalScroll(page);
    await expectMemoryCardsStacked(page);
    await page.screenshot({ path: `${OUT}/hibrido-dashboard-desktop-1440.png`, fullPage: true });
    await page.setViewportSize({ width: 1366, height: 1000 });
    await expectNoHorizontalScroll(page);
    await expectMemoryCardsStacked(page);
    await page.setViewportSize({ width: 1280, height: 1000 });
    await expectNoHorizontalScroll(page);
    await expectMemoryCardsStacked(page);
    await page.screenshot({ path: `${OUT}/hibrido-dashboard-desktop-1280.png`, fullPage: true });
    await page.setViewportSize({ width: 1024, height: 1000 });
    await expectNoHorizontalScroll(page);
    await expectMemoryCardsStacked(page);
    await page.setViewportSize({ width: 900, height: 1000 });
    await expectNoHorizontalScroll(page);
    await expectMemoryCardsStacked(page);
    await page.screenshot({ path: `${OUT}/hibrido-dashboard-tablet.png`, fullPage: true });
    await page.setViewportSize({ width: 768, height: 1000 });
    await expectNoHorizontalScroll(page);
    await expectMemoryCardsStacked(page);

    await page.locator("label:has-text('Declaro que revisei os dados informados')").click();
    const popupPromise = page.waitForEvent("popup");
    await page.locator("button:has-text('Gerar relatório em PDF')").click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    const html = (await popup.locator("body").innerText()).toLowerCase();
    expect(html).not.toContain("sem recalcular tributos na interface");
    expect(html).not.toContain("dados consumidos do motor");
    expect(html).not.toContain("pendente");
    expect(html).not.toContain("status");
    expect(html).not.toContain("resultado condicionado");
    expect(html).toContain("premissas da simulação");
    expect(html).toContain("resultado executivo");
    expect(html).toContain("ibs (2027)");
    expect(html).toContain("não produz impacto financeiro nesta simulação");
    expect(html).toContain("permanece recolhido dentro do das nesta premissa do simulador");
    expect(html).toContain("memória resumida");
    expect(html).not.toContain("das reduzido + cbs líquida + ibs");
    expect(html).not.toContain("+ ibs líquido");
    await popup.pdf({ path: `${OUT}/hibrido-atualizado.pdf`, format: "A4", printBackground: true });
    await popup.close();
  });

  test("compras elevadas tornam o híbrido vencedor em card, conclusão e PDF", async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await login(page);
    await openHibrido(page);
    await fillEconomicos(page, "120000000", "80000000", "6920-6/01");
    const r = calcHibrido("120000000", "80000000");
    const cbsLiquida = money(r.simplesHibrido.cbsLiquida);
    const dasReduzido = money(r.simplesHibrido.dasReduzido);
    const hibTotal = money(r.simplesHibrido.total);

    await expect(page.locator("[data-testid='impact-card']")).toHaveAttribute("data-tone", "green");
    await expect(page.locator("[data-testid='impact-card']")).toContainText("Economia");
    await expect(page.locator("[data-testid='impact-card']")).toContainText("Simples Híbrido");
    await expect(page.locator("[data-testid='executive-conclusion']")).toContainText("O Simples Híbrido apresentou menor carga tributária");
    const hybridMemoryCard = page.locator("[data-testid='calculation-memory-section'] [data-testid='memory-card']").nth(1);
    await expect(hybridMemoryCard).toContainText("CBS Líquida");
    await expect(hybridMemoryCard).toContainText(cbsLiquida);
    await expect(hybridMemoryCard).toContainText(dasReduzido);
    await expect(hybridMemoryCard).toContainText(hibTotal);

    await page.locator("label:has-text('Declaro que revisei os dados informados')").click();
    const popupPromise = page.waitForEvent("popup");
    await page.locator("button:has-text('Gerar relatório em PDF')").click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    const html = (await popup.locator("body").innerText()).toLowerCase();
    expect(html).toContain("economia anual");
    expect(html).toContain("regime recomendado");
    expect(html).toContain("simples híbrido");
    expect(html).toContain(cbsLiquida.toLowerCase());
    expect(html).toContain(dasReduzido.toLowerCase());
    expect(html).toContain(hibTotal.toLowerCase());
    expect(html).toContain("o simples híbrido apresentou menor carga tributária");
    await popup.close();
  });

  test("mobile empilha a memória", async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 390, height: 900 });
    await login(page);
    await openHibrido(page);
    await fillEconomicos(page, "120000000", "20000000", "6920-6/01");
    await expect(page.locator("[data-testid='result-section']")).toBeVisible();
    await expectMemoryCardsStacked(page);
    const order = await page.locator("[data-testid='calculation-memory-section'] [data-testid='memory-card'] h3").allTextContents();
    expect(order).toEqual(["Simples Tradicional", "Simples Híbrido"]);
    await expect(page.locator("text=Sem recalcular tributos na interface; dados consumidos do motor.")).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: `${OUT}/hibrido-dashboard-mobile.png`, fullPage: true });
  });

  test("sem benefício não renderiza bloco e comércio exibe composição aplicável", async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1366, height: 1000 });
    await login(page);
    await openHibrido(page);
    await fillEconomicos(page, "120000000", "20000000", "4711-3/00");
    await expect(page.locator("[data-testid='benefit-section']")).toHaveCount(0);
    await expect(page.locator("text=Sem benefício")).toHaveCount(0);
    await expect(page.locator("text=Não aplicável")).toHaveCount(0);
    const traditionalColumn = page.locator("[data-testid='calculation-memory-section'] [data-testid='memory-card']").nth(0);
    for (const label of ["IRPJ", "CSLL", "CPP", "ICMS", "CBS"]) {
      await expect(traditionalColumn.getByText(label, { exact: true })).toBeVisible();
    }
    for (const label of ["ISS", "PIS", "COFINS", "IPI", "IBS"]) {
      await expect(traditionalColumn.getByText(label, { exact: true })).toHaveCount(0);
    }
    await expectNoHorizontalScroll(page);
  });
});