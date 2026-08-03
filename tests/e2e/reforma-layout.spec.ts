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

async function openReforma(page) {
  const cards = page.locator("button:has(h3)");
  await expect(cards).toHaveCount(3, { timeout: 30000 });
  await expect(page.locator("text=Preparando motor de cálculo")).not.toBeVisible({ timeout: 10000 });
}

async function fillBase(page) {
  await page.fill("#cnae", "6920-6/01");
  await page.fill("#cnpj", "11222333000181");
  const ecoHeader = page.locator("h3:has-text('Dados Econômicos')");
  if (await ecoHeader.isVisible().catch(() => false)) await ecoHeader.click();
  await page.fill("#rbt12Input", "120000000");
  await page.fill("#comprasInput", "20000000");
  await page.fill("#salarios", "0");
  await page.fill("#prolabore", "0");
  const tribHeader = page.locator("h3:has-text('Parâmetros Tributários')");
  if (await tribHeader.isVisible().catch(() => false)) await tribHeader.click();
}

async function setBenefit(page, status: "pendente" | "confirmado" | "negado") {
  if (status === "pendente") return;
  const advanced = page.locator("button:has-text('Ajustes Avançados')");
  if (await advanced.isVisible().catch(() => false)) await advanced.click();
  const ids = ["benefReqProfissionais", "benefReqSemSocioPJ", "benefReqNaoParticipaPJ", "benefReqExclusiva", "benefReqDireta"];
  if (status === "confirmado") {
    for (const id of ids) await page.selectOption(`#${id}`, "sim");
    return;
  }
  await page.selectOption("#benefReqProfissionais", "nao");
}

async function calculateReforma(page, status: "pendente" | "confirmado" | "negado") {
  await fillBase(page);
  await setBenefit(page, status);
  const btn = page.locator("button:has(h3)").nth(2);
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await expect(page.locator("text=Resultado Executivo")).toBeVisible({ timeout: 60000 });
}

async function savePdfFromButton(page, name: string) {
  await page.locator("label:has-text('Declaro')").click();
  const popupPromise = page.waitForEvent("popup");
  await page.locator("button:has-text('Gerar relatório em PDF')").click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  await expect(popup.locator("text=Resultado Executivo")).toBeVisible({ timeout: 15000 });
  await popup.pdf({ path: `${OUT}/${name}.pdf`, format: "A4", printBackground: true });
  await popup.close();
}

test.describe("Layout LP x Reforma", () => {
  test("estado pendente mostra cenários, gráfico, detalhes e PDF condicionado", async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await login(page);
    await openReforma(page);
    await calculateReforma(page, "pendente");

    await expect(page.locator("text=Lucro Presumido atual").first()).toBeVisible();
    await expect(page.locator("text=Pós-Reforma com benefício").first()).toBeVisible();
    await expect(page.locator("text=Benefício Fiscal").first()).toBeVisible();
    await expect(page.locator("text=Redução de 30,00% nas alíquotas da CBS e IBS").first()).toBeVisible();
    await expect(page.locator("text=30% da carga tributária")).toHaveCount(0);
    await expect(page.locator("text=Pós-Reforma sem benefício")).toHaveCount(0);
    await expect(page.locator("text=R$ 198.360,00").first()).toBeVisible();
    await expect(page.locator("text=R$ 211.520,00").first()).toBeVisible();
    await expect(page.locator("text=Impacto financeiro")).toHaveCount(0);
    await expect(page.locator("text=Comparação Visual")).toBeVisible();
    const memorySection = page.locator("[data-testid='calculation-memory-section']");
    const memoryCards = memorySection.locator("[data-testid='memory-card']");
    await expect(memorySection).toContainText("Memória de Cálculo");
    await expect(memorySection).toContainText("Comparação da formação dos tributos");
    await expect(memoryCards.nth(0)).toContainText("Lucro Presumido atual");
    await expect(memoryCards.nth(1)).toContainText("Pós-Reforma com benefício");
    await expect(page.locator("text=Alíquota Efetiva").first()).toBeVisible();
    await expect(page.locator("text=Resultado pendente")).toHaveCount(0);
    await expect(page.locator("text=Economia anual")).toHaveCount(0);

    await page.screenshot({ path: `${OUT}/reforma-pendente-desktop.png`, fullPage: true });
    await expect(memoryCards.nth(1).getByRole("button", { name: /Ver memória detalhada/i })).toBeVisible();
    await memoryCards.nth(1).getByRole("button", { name: /Ver memória detalhada/i }).click();
    await expect(memoryCards.nth(1)).toContainText("Memória da CBS");
    await expect(memoryCards.nth(1)).toContainText("Alíquota Aplicada");
    await expect(page.locator("text=ISS").first()).toBeVisible();
    await page.locator("text=Pós-Reforma com benefício").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/reforma-detalhamento-tributario.png`, fullPage: true });
    await page.locator("text=Comparação Visual").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/reforma-grafico.png`, fullPage: true });
    await savePdfFromButton(page, "reforma-pendente");
  });

  test("estado pendente empilha cards no mobile", async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 390, height: 900 });
    await login(page);
    await openReforma(page);
    await calculateReforma(page, "pendente");
    await expect(page.locator("text=Pós-Reforma com benefício").first()).toBeVisible();
    await page.screenshot({ path: `${OUT}/reforma-pendente-mobile.png`, fullPage: true });
  });

  test("estado confirmado mostra somente cenário com benefício e PDF correspondente", async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await login(page);
    await openReforma(page);
    await calculateReforma(page, "confirmado");
    await expect(page.locator("text=Benefício Fiscal").first()).toBeVisible();
    await expect(page.locator("text=Confirmado")).toHaveCount(0);
    await expect(page.locator("text=Pós-Reforma com benefício").first()).toBeVisible();
    await expect(page.locator("text=Pós-Reforma sem benefício")).toHaveCount(0);
    await expect(page.locator("text=R$ 211.520,00").first()).toBeVisible();
    await page.screenshot({ path: `${OUT}/reforma-beneficio-confirmado.png`, fullPage: true });
    await savePdfFromButton(page, "reforma-confirmado");
  });

  test("estado negado mostra somente cenário sem benefício", async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await login(page);
    await openReforma(page);
    await calculateReforma(page, "negado");
    await expect(page.locator("text=Benefício Fiscal").first()).toBeVisible();
    await expect(page.locator("text=Negado")).toHaveCount(0);
    await expect(page.locator("text=Pós-Reforma sem benefício").first()).toBeVisible();
    await expect(page.locator("text=Pós-Reforma com benefício")).toHaveCount(0);
    await expect(page.locator("text=R$ 243.560,00").first()).toBeVisible();
    await page.screenshot({ path: `${OUT}/reforma-beneficio-negado.png`, fullPage: true });
  });
});
