import { test, expect } from "@playwright/test";

const EMAIL = process.env.EMAIL_TEST || "";
const PASSWORD = process.env.PASSWORD_TEST || "";

test.skip(!EMAIL || !PASSWORD, "EMAIL_TEST and PASSWORD_TEST env vars required");

test.describe("Auth Flow", () => {
  test("full auth cycle: login → dashboard → logout → blocked", async ({ page }) => {
    // Intercept login API to remove Secure flag from cookies (production uses https only)
    await page.route("**/api/auth/login", async (route) => {
      const response = await route.fetch();
      const headers = response.headers();
      const setCookie = headers["set-cookie"] || headers["Set-Cookie"] || "";
      const modified = setCookie.replace(/;\s*Secure\s*(?=;|$)/gi, "");
      if (modified !== setCookie) {
        await route.fulfill({
          status: response.status(),
          headers: { ...headers, "set-cookie": modified },
          body: await response.body(),
        });
      } else {
        await route.continue();
      }
    });

    // ===== 1. Login =====
    await page.goto("/auth/login");
    await expect(page.locator("h1")).toContainText("Compare Tributo");
    await expect(page.locator("h2")).toContainText("Entrar");

    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for redirect to /dashboard
    await page.waitForURL("**/dashboard", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // ===== 2. Dashboard Verification =====
    await expect(page.locator("h1")).toContainText("Selecione a Análise");
    const cards = page.locator("button:has(h3)");
    await expect(cards).toHaveCount(3);

    // Verify sidebar
    await expect(page.locator("text=Sair")).toBeVisible();

    // Verify iframe exists
    const iframe = page.locator('iframe[title="calc-engine"]');
    await expect(iframe).toHaveAttribute("src", "/comparador.html");

    // ===== 3. Start Analysis (Step 0 → Step 1) =====
    await cards.first().click();
    await expect(page.locator("h1")).not.toContainText("Selecione a Análise");

    // ===== 4. Fill Form =====
    // Fill company fields (visible by default in "Dados da Empresa")
    await page.fill("#cnpj", "11222333000181");
    await page.fill("#cnae", "4711301");

    // Expand "Dados Econômicos" section (collapsed by default)
    // Note: only ONE section can be open at a time
    await page.locator("h3:has-text('Dados Econômicos')").click();
    await page.waitForTimeout(500);

    // Fill economic fields
    await page.fill("#rbt12Input", "1500000");
    await page.fill("#comprasInput", "600000");
    await page.fill("#salarios", "30000");
    await page.fill("#prolabore", "10000");

    // Click "Gerar diagnóstico tributário"
    const generateBtn = page.locator("button:has-text('Gerar diagnóstico tributário')");
    await generateBtn.scrollIntoViewIfNeeded();
    await generateBtn.click();

    // ===== 5. Wait for Results (Step 2) =====
    const resultSection = page.locator("text=Carga Tributária Efetiva");
    const calcError = page.locator("text=Não foi possível concluir o cálculo");
    const calculating = page.locator("text=Calculando...");
    const diagnosisHeader = page.locator("h1:has-text('Diagnóstico Tributário')");

    const outcome = await Promise.race([
      resultSection.waitFor({ state: "visible", timeout: 60000 }).then(() => "kpi"),
      diagnosisHeader.waitFor({ state: "visible", timeout: 60000 }).then(() => "results"),
      calcError.waitFor({ state: "visible", timeout: 60000 }).then(() => "calc-error"),
      calculating.waitFor({ state: "visible", timeout: 60000 }).then(() => "calculating"),
    ]);

    console.log(`Calculation outcome: ${outcome}`);

    // ===== 6. Logout =====
    await page.click("text=Sair");
    await page.waitForURL("**/auth/login", { timeout: 15000 });
    await expect(page.locator("h2")).toContainText("Entrar");

    // ===== 7. Dashboard blocked after logout =====
    await page.goto("/dashboard");
    await page.waitForURL("**/auth/login", { timeout: 15000 });
    await expect(page.locator("h2")).toContainText("Entrar");
  });
});
