import assert from "node:assert";
import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { chromium } from "@playwright/test";
import { form, loadEngine, pdfFor } from "./helpers/tributaryAuditHelpers.mjs";

const outputDir = join(process.cwd(), "test-output", "pdfs");

function cases(engine) {
  const input = form({
    rbt12Input: "6.100.000,00",
    comprasInput: "2.200.000,00",
    aliquotaISS: "5",
    aliquotaICMS: "18",
    anoSIM: "2027",
  });
  return [
    ["simples-vs-presumido", engine.calcularComparacaoSimplesPresumido(input), input],
    ["simples-vs-hibrido", engine.calcularComparacaoSimplesHibrido(input), input],
    ["presumido-vs-reforma", engine.calcularComparacaoPresumidoReforma(input), input],
  ];
}

async function inspectPdfLayout(html, pdfName) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    await page.setContent(html, { waitUntil: "load" });
    const pdfPath = join(outputDir, `${pdfName}.pdf`);
    await page.pdf({ path: pdfPath, format: "A4", printBackground: true, preferCSSPageSize: true });
    assert.ok(statSync(pdfPath).size > 10_000, `${pdfName}: PDF de teste nao foi gerado corretamente`);

    const report = await page.evaluate(() => {
      const pages = [...document.querySelectorAll(".page")];
      return {
        pageCount: pages.length,
        footCount: document.querySelectorAll(".page > .foot").length,
        annexCount: document.querySelectorAll(".annex-page").length,
        annexTablesWithHeader: [...document.querySelectorAll(".annex-page table")].every((table) => table.querySelector("thead th") && table.querySelector("tbody tr")),
        overflowHiddenPages: pages.filter((page) => getComputedStyle(page).overflow === "hidden").length,
        tablesOutsideMargins: [...document.querySelectorAll(".page table")].filter((table) => {
          const pageEl = table.closest(".page");
          const footer = pageEl.querySelector(".foot");
          const tableRect = table.getBoundingClientRect();
          const footerRect = footer.getBoundingClientRect();
          return tableRect.bottom > footerRect.top - 2;
        }).length,
      };
    });

    assert.ok(report.pageCount >= 2, `${pdfName}: memoria analitica deve ir para anexo tecnico`);
    assert.equal(report.footCount, report.pageCount, `${pdfName}: todas as paginas devem ter rodape`);
    assert.ok(report.annexCount >= 1, `${pdfName}: anexo tecnico ausente`);
    assert.equal(report.annexTablesWithHeader, true, `${pdfName}: tabelas do anexo devem repetir cabecalho`);
    assert.equal(report.overflowHiddenPages, 0, `${pdfName}: pagina nao pode usar overflow hidden`);
    assert.equal(report.tablesOutsideMargins, 0, `${pdfName}: tabela ultrapassou area util antes do rodape`);
  } finally {
    await browser.close();
  }
}

describe("PDF - paginacao e anti-corte", () => {
  it("gera PDFs paginados para todos os modulos sem cortar tabelas", async () => {
    mkdirSync(outputDir, { recursive: true });
    const engine = loadEngine();
    for (const [name, result, input] of cases(engine)) {
      const html = await pdfFor(engine, result, input);
      assert.ok(html.includes("ANEXO TÉCNICO – MEMÓRIA DE CÁLCULO"), `${name}: titulo do anexo ausente`);
      assert.ok(html.includes("Memória Resumida"), `${name}: memoria resumida ausente`);
      await inspectPdfLayout(html, name);
    }
  });
});
