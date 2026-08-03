import { test, expect } from "@playwright/test";

const EMAIL = process.env.EMAIL_TEST;
const PASSWORD = process.env.PASSWORD_TEST;

test.describe("Auth Flow", () => {
  test.skip(!(EMAIL && PASSWORD), "Defina EMAIL_TEST e PASSWORD_TEST para executar os testes E2E");
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
    await expect(page.locator("h1")).toContainText("CompareTributo");
    await expect(page.locator("h2")).toContainText("Entrar");

    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for redirect to /dashboard
    await page.waitForURL("**/dashboard", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // ===== 2. Dashboard Verification =====
    await expect(page.locator("h1")).toContainText("Nova Simulação Tributária");
    await expect(page.locator("text=Identificação da Empresa").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Consultar" })).toBeVisible();
    const cards = page.locator("button:has(h3)");
    await expect(cards).toHaveCount(3);

    // Verify sidebar
    await expect(page.getByRole("button", { name: "Sair" }).first()).toBeVisible();

    // Verify iframe exists
    const iframe = page.locator('iframe[title="calc-engine"]');
    await expect(iframe).toHaveAttribute("src", "/comparador.html");

    // ===== 3. Fill Form =====
    // Fill company fields (visible by default in "Dados da Empresa")
    await page.fill("#cnpj", "11222333000181");
    await page.fill("#cnae", "4711301");

    // Fill economic fields
    await page.fill("#rbt12Input", "1500000");
    await page.fill("#comprasInput", "600000");
    await page.fill("#salarios", "30000");
    await page.fill("#prolabore", "10000");

    // Select the analysis card after the form is complete
    const generateBtn = cards.first();
    await generateBtn.scrollIntoViewIfNeeded();
    await generateBtn.click();

    // ===== 4. Wait for Results =====
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

    const simplesMemoryCard = page.locator("[data-testid='calculation-memory-section'] [data-testid='memory-card']").first();
    await expect(simplesMemoryCard).toContainText("Simples Nacional", { timeout: 30000 });
    for (const label of ["IRPJ", "CSLL", "PIS", "COFINS", "CPP", "ICMS"]) {
      await expect(simplesMemoryCard.getByText(label, { exact: true })).toBeVisible();
    }
    for (const label of ["ISS", "IPI", "CBS", "IBS"]) {
      await expect(simplesMemoryCard.getByText(label, { exact: true })).toHaveCount(0);
    }

    // ===== 6. Logout =====
    await page.getByRole("button", { name: "Sair" }).first().click();
    await page.waitForURL("**/auth/login", { timeout: 15000 });
    await expect(page.locator("h2")).toContainText("Entrar");

    // ===== 7. Dashboard blocked after logout =====
    await page.goto("/dashboard");
    await page.waitForURL("**/auth/login", { timeout: 15000 });
    await expect(page.locator("h2")).toContainText("Entrar");
  });
});
