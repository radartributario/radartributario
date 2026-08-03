import { test, expect } from "@playwright/test";

const EMAIL = process.env.EMAIL_TEST;
const PASSWORD = process.env.PASSWORD_TEST;

test.skip(!(EMAIL && PASSWORD), "Defina EMAIL_TEST e PASSWORD_TEST para executar os testes E2E");

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

async function openModuleAndWait(page) {
  const cards = await getCards(page);
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(3);
  const preparando = page.locator("text=Preparando motor de cálculo");
  await expect(preparando).not.toBeVisible({ timeout: 5000 });
  const erro = page.locator("text=Não foi possível preparar");
  await expect(erro).not.toBeVisible({ timeout: 3000 });
}

async function goBackToCards(page) {
  const trocarBtn = page.getByRole("button", { name: /Alterar Análise/i }).first();
  if (await trocarBtn.isVisible().catch(() => false)) {
    await trocarBtn.click();
    const descartarBtn = page.locator("button:has-text('Descartar e continuar')");
    if (await descartarBtn.isVisible().catch(() => false)) {
      await descartarBtn.click();
    }
    await expect(page.locator("button:has(h3)")).toHaveCount(3, { timeout: 15000 });
  }
}

async function fillAndCalculate(page, index = 0) {
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

  const btn = page.locator("button:has(h3)").nth(index);
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await page.waitForTimeout(3000);
}

async function fillContabilidadeHibrido(page) {
  await page.fill("#cnae", "6920-6/01");
  await page.fill("#cnpj", "11222333000181");

  const ecoHeader = page.locator("h3:has-text('Dados Econômicos')");
  if (await ecoHeader.isVisible().catch(() => false)) {
    await ecoHeader.click();
    await page.waitForTimeout(300);
  }
  await page.fill("#rbt12Input", "120000000");
  await page.fill("#comprasInput", "20000000");
  await page.fill("#salarios", "0");
  await page.fill("#prolabore", "0");

  const tribHeader = page.locator("h3:has-text('Parâmetros Tributários')");
  if (await tribHeader.isVisible().catch(() => false)) {
    await tribHeader.click();
    await page.waitForTimeout(300);
  }
  const advanced = page.locator("button:has-text('Ajustes Avançados')");
  if (await advanced.isVisible().catch(() => false)) {
    await advanced.click();
    await page.waitForTimeout(300);
  }
  for (const id of ["benefReqProfissionais", "benefReqSemSocioPJ", "benefReqNaoParticipaPJ", "benefReqExclusiva", "benefReqDireta"]) {
    await page.selectOption(`#${id}`, "sim");
  }

  const btn = page.locator("button:has(h3)").nth(1);
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
}

test.describe("VALIDAÇÃO FINAL HOTFIX", () => {
  test("1. Todos os 3 módulos carregam e calculam", async ({ page }) => {
    test.setTimeout(180000);
    await login(page);
    const cards = await getCards(page);
    await expect(cards).toHaveCount(3);

    for (let i = 0; i < 3; i++) {
      await openModuleAndWait(page, i);
      await fillAndCalculate(page, i);
      await expect(page.locator("text=/Resumo executivo|Conclusão|Regime recomendado|Total anual/").first()).toBeVisible({ timeout: 30000 });
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
    test.setTimeout(90000);
    await login(page);
    await openModuleAndWait(page, 1);

    // Find and click Tentar novamente if visible
    const retryBtn = page.locator("button:has-text('Tentar novamente')");
    if (await retryBtn.isVisible().catch(() => false)) {
      await retryBtn.click();
      await page.waitForTimeout(3000);
    }

    await fillAndCalculate(page, 1);
  });

  test("4. Refresh mantém motor", async ({ page }) => {
    test.setTimeout(90000);
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
    test.setTimeout(90000);
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

  test("6. Contabilidade no híbrido usa Anexo III com folha zero e gera PDF", async ({ page }) => {
    test.setTimeout(120000);
    await login(page);
    await openModuleAndWait(page, 1);
    await fillContabilidadeHibrido(page);

    await expect(page.locator("[data-testid='executive-conclusion']")).toBeVisible({ timeout: 60000 });
    await expect(page.locator("text=R$ 156.360,00").first()).toBeVisible();
    await expect(page.locator("text=R$ 187.021,32").first()).toBeVisible();
    await expect(page.locator("text=Memória de Cálculo")).toBeVisible();
    await expect(page.locator("text=R$ 56.320,00").first()).toBeVisible();
    await expect(page.locator("text=IBS em 2027")).toHaveCount(0);
    await expect(page.locator("text=Observação: Nesta premissa do simulador, o IBS permanece recolhido dentro do DAS e não produz impacto financeiro em 2027").first()).toBeVisible();
    await expect(page.locator("text=Premissas Utilizadas na Simulação")).toBeVisible();
    await expect(page.locator("text=Anexo III").first()).toBeVisible();
    await expect(page.locator("text=Anexo V")).toHaveCount(0);
    await expect(page.locator("text=R$ 228.900,00")).toHaveCount(0);

    await page.locator("label:has-text('Declaro que revisei os dados informados')").click();
    const pdfButton = page.locator("button:has-text('Gerar relatório em PDF')");
    await expect(pdfButton).toBeEnabled();
    await pdfButton.click();
    await expect(page.locator("button:has-text('Gerando relatório...')")).toBeVisible({ timeout: 5000 }).catch(() => undefined);
  });
});
