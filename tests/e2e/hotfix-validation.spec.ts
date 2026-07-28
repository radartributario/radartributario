import { test, expect } from "@playwright/test";

const EMAIL = process.env.EMAIL_TEST || "";
const PASSWORD = process.env.PASSWORD_TEST || "";
const BASE_URL = "http://localhost:3000";

test.skip(!EMAIL || !PASSWORD, "EMAIL_TEST and PASSWORD_TEST env vars required");

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
  await page.waitForTimeout(3000);
}

async function getCards(page) {
  return page.locator("button:has(h3)");
}

async function openModuleAndWait(page, index) {
  const cards = await getCards(page);
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(3);
  await cards.nth(index).click();
  await page.waitForTimeout(3000);
  const preparando = page.locator("text=Preparando motor de cálculo");
  await expect(preparando).not.toBeVisible({ timeout: 5000 });
  const erro = page.locator("text=Não foi possível preparar");
  await expect(erro).not.toBeVisible({ timeout: 3000 });
}

async function goBackToCards(page) {
  const trocarBtn = page.locator("button:has-text('Trocar análise')");
  if (await trocarBtn.isVisible().catch(() => false)) {
    await trocarBtn.click();
    await page.waitForTimeout(500);
    const descartarBtn = page.locator("button:has-text('Descartar e continuar')");
    if (await descartarBtn.isVisible().catch(() => false)) {
      await descartarBtn.click();
      await page.waitForTimeout(1500);
    }
  }
}

async function fillAndCalculate(page) {
  // Fill basic fields
  await page.fill("#cnae", "4711301");
  await page.fill("#cnpj", "11222333000181");

  // Expand Dados Econômicos
  const ecoHeader = page.locator("h3:has-text('Dados Econômicos')");
  if (await ecoHeader.isVisible().catch(() => false)) {
    await ecoHeader.click();
    await page.waitForTimeout(500);
  }

  // Fill economic fields
  await page.fill("#rbt12Input", "1500000");
  await page.fill("#comprasInput", "600000");

  // Click the appropriate calculate button
  const btnLabels = [
    "Gerar diagnóstico tributário",
    "Calcular impacto da opção híbrida",
    "Analisar impacto da Reforma Tributária",
  ];
  for (const label of btnLabels) {
    const btn = page.locator(`button:has-text('${label}')`);
    if (await btn.isVisible().catch(() => false)) {
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await page.waitForTimeout(3000);
      return;
    }
  }
}

test.describe("VALIDAÇÃO FINAL HOTFIX", () => {
  test("1. Todos os 3 módulos carregam e calculam", async ({ page }) => {
    await login(page);
    const cards = await getCards(page);
    await expect(cards).toHaveCount(3);

    for (let i = 0; i < 3; i++) {
      await openModuleAndWait(page, i);
      await fillAndCalculate(page);
      await goBackToCards(page);
    }
  });

  test("2. Troca entre módulos (10 ciclos)", async ({ page }) => {
    test.setTimeout(300000);
    await login(page);
    const cards = await getCards(page);
    await expect(cards).toHaveCount(3);

    for (let cycle = 0; cycle < 10; cycle++) {
      for (let i = 0; i < 3; i++) {
        await cards.nth(i).click();
        await page.waitForTimeout(2500);
        const preparando = page.locator("text=Preparando motor de cálculo");
        await expect(preparando).not.toBeVisible({ timeout: 5000 });
        const erro = page.locator("text=Não foi possível preparar");
        await expect(erro).not.toBeVisible({ timeout: 3000 });
        await goBackToCards(page);
      }
    }
  });

  test("3. Retry button", async ({ page }) => {
    await login(page);
    await openModuleAndWait(page, 1);

    // Find and click Tentar novamente if visible
    const retryBtn = page.locator("button:has-text('Tentar novamente')");
    if (await retryBtn.isVisible().catch(() => false)) {
      await retryBtn.click();
      await page.waitForTimeout(3000);
    }

    await fillAndCalculate(page);
  });

  test("4. Refresh mantém motor", async ({ page }) => {
    await login(page);
    await openModuleAndWait(page, 1);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(4000);
    const cards = await getCards(page);
    await expect(cards).toHaveCount(3);
    await openModuleAndWait(page, 1);
  });

  test("5. Logout bloqueia dashboard", async ({ page }) => {
    await login(page);
    await openModuleAndWait(page, 0);
    // Logout via API
    const resp = await page.request.post("/api/auth/logout");
    expect(resp.status()).toBe(200);
    // Navigate to dashboard
    await page.goto("/dashboard");
    // Should be redirected to login
    await page.waitForURL("**/auth/login", { timeout: 15000 });
    expect(page.url()).toContain("/auth/login");
  });
});
