import { expect, test } from "@playwright/test";

const EMAIL = process.env.EMAIL_TEST;
const PASSWORD = process.env.PASSWORD_TEST;

test.skip(!(EMAIL && PASSWORD), "Defina EMAIL_TEST e PASSWORD_TEST para executar os testes E2E");
const OUT = "C:/Users/TECHNO~1/AppData/Local/Temp/opencode";

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

async function calculatePotential(page) {
  await page.fill("#cnae", "6920-6/01");
  await page.fill("#cnpj", "11222333000181");
  const ecoHeader = page.locator("h3:has-text('Dados Econômicos')");
  if (await ecoHeader.isVisible().catch(() => false)) await ecoHeader.click();
  await page.fill("#rbt12Input", "120000000");
  await page.fill("#comprasInput", "20000000");
  await page.fill("#salarios", "0");
  await page.fill("#prolabore", "0");
  const btn = page.locator("button:has(h3)").nth(1);
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await expect(page.locator("[data-testid='executive-conclusion']")).toBeVisible({ timeout: 60000 });
}

async function calculateHighPurchases(page) {
  await page.fill("#cnae", "6920-6/01");
  await page.fill("#cnpj", "11222333000181");
  const ecoHeader = page.locator("h3:has-text('Dados Econômicos')");
  if (await ecoHeader.isVisible().catch(() => false)) await ecoHeader.click();
  await page.fill("#rbt12Input", "120000000");
  await page.fill("#comprasInput", "80000000");
  await page.fill("#salarios", "0");
  await page.fill("#prolabore", "0");
  const btn = page.locator("button:has(h3)").nth(1);
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await expect(page.locator("[data-testid='executive-conclusion']")).toBeVisible({ timeout: 60000 });
}

async function calculateCommerce(page) {
  await page.fill("#cnae", "4711-3/00");
  await page.fill("#cnpj", "11222333000181");
  const ecoHeader = page.locator("h3:has-text('Dados Econômicos')");
  if (await ecoHeader.isVisible().catch(() => false)) await ecoHeader.click();
  await page.fill("#rbt12Input", "120000000");
  await page.fill("#comprasInput", "20000000");
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
    await calculatePotential(page);

    await expect(page.locator("text=Resultado Executivo").first()).toBeVisible();
    await expect(page.locator("text=Premissas Utilizadas na Simulação").first()).toBeVisible();
    await expect(page.locator("text=Menor carga tributária").first()).toBeVisible();
    await expect(page.locator("[data-testid='impact-card']")).toHaveAttribute("data-tone", "red");
    await expect(page.locator("[data-testid='impact-card']")).toContainText("Aumento de Carga");
    await expect(page.locator("[data-testid='impact-card']")).toContainText("Simples Tradicional");
    await expect(page.locator("text=Memória de Cálculo").first()).toBeVisible();
    await expect(page.locator("text=Resultado Executivo").first()).toBeVisible();
    await expect(page.locator("text=Comparação Visual").first()).toBeVisible();
    await expect(page.locator("text=Benefício Fiscal").first()).toBeVisible();
    await expectSectionOrder(page);
    await expectNoPendingLanguage(page);
    await expect(page.locator("text=R$ 156.360,00").first()).toBeVisible();
    await expect(page.locator("text=R$ 187.021,32").first()).toBeVisible();
    await expect(page.locator("text=13,03%").first()).toBeVisible();
    await expect(page.locator("text=15,59%").first()).toBeVisible();
    await expect(page.locator("text=Sem recalcular tributos na interface; dados consumidos do motor.")).toHaveCount(0);
    for (const value of ["R$ 30.661,32", "R$ 2.555,11", "R$ 156.360,00", "R$ 25.658,68", "R$ 130.701,32", "R$ 56.320,00", "R$ 187.021,32"]) {
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
    await expect(memoryCards.nth(0).getByText("PIS", { exact: true })).toHaveCount(0);
    await expect(memoryCards.nth(0).getByText("COFINS", { exact: true })).toHaveCount(0);
    await expect(memoryCards.nth(0).getByText("ICMS", { exact: true })).toHaveCount(0);
    await expect(memoryCards.nth(0).getByText("IPI", { exact: true })).toHaveCount(0);
    await expect(memoryCards.nth(0).getByText("IBS", { exact: true })).toHaveCount(0);
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
    const sequencia = ["DAS Original", "(-) CBS retirada", "(=) DAS reduzido", "(+) CBS Líquida", "TOTAL HÍBRIDO", "Alíquota Legal", "Redução Legal", "Alíquota Aplicada", "Receita Tributável", "Débito (6,16%)", "Compras com Crédito", "Crédito (8,80%)", "CBS Líquida"];
    for (const label of sequencia) {
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
    await calculateHighPurchases(page);

    await expect(page.locator("[data-testid='impact-card']")).toHaveAttribute("data-tone", "green");
    await expect(page.locator("[data-testid='impact-card']")).toContainText("Economia");
    await expect(page.locator("[data-testid='impact-card']")).toContainText("Simples Híbrido");
    await expect(page.locator("[data-testid='executive-conclusion']")).toContainText("O Simples Híbrido apresentou menor carga tributária");
    const hybridMemoryCard = page.locator("[data-testid='calculation-memory-section'] [data-testid='memory-card']").nth(1);
    await expect(hybridMemoryCard).toContainText("CBS Líquida");
    await expect(hybridMemoryCard).toContainText("R$ 3.520,00");
    await expect(hybridMemoryCard).toContainText("R$ 130.701,32");
    await expect(hybridMemoryCard).toContainText("R$ 134.221,32");

    await page.locator("label:has-text('Declaro que revisei os dados informados')").click();
    const popupPromise = page.waitForEvent("popup");
    await page.locator("button:has-text('Gerar relatório em PDF')").click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    const html = (await popup.locator("body").innerText()).toLowerCase();
    expect(html).toContain("economia anual");
    expect(html).toContain("regime recomendado");
    expect(html).toContain("simples híbrido");
    expect(html).toContain("r$ 3.520,00");
    expect(html).toContain("r$ 130.701,32");
    expect(html).toContain("r$ 134.221,32");
    expect(html).toContain("o simples híbrido apresentou menor carga tributária");
    await popup.close();
  });

  test("mobile empilha a memória", async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 390, height: 900 });
    await login(page);
    await openHibrido(page);
    await calculatePotential(page);
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
    await calculateCommerce(page);
    await expect(page.locator("[data-testid='benefit-section']")).toHaveCount(0);
    await expect(page.locator("text=Sem benefício")).toHaveCount(0);
    await expect(page.locator("text=Não aplicável")).toHaveCount(0);
    const traditionalColumn = page.locator("[data-testid='calculation-memory-section'] [data-testid='memory-card']").nth(0);
    await expect(traditionalColumn.getByText("IRPJ", { exact: true })).toBeVisible();
    await expect(traditionalColumn.getByText("CSLL", { exact: true })).toBeVisible();
    await expect(traditionalColumn.getByText("CPP", { exact: true })).toBeVisible();
    await expect(traditionalColumn.getByText("ICMS", { exact: true })).toBeVisible();
    await expect(traditionalColumn.getByText("CBS", { exact: true })).toBeVisible();
    await expect(traditionalColumn.getByText("ISS", { exact: true })).toHaveCount(0);
    await expect(traditionalColumn.getByText("PIS", { exact: true })).toHaveCount(0);
    await expect(traditionalColumn.getByText("COFINS", { exact: true })).toHaveCount(0);
    await expect(traditionalColumn.getByText("IPI", { exact: true })).toHaveCount(0);
    await expect(traditionalColumn.getByText("IBS", { exact: true })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });
});
