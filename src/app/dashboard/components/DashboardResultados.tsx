"use client";

import { useState, useCallback } from "react";
import { Receipt, TrendingUp, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import DashboardResultadosHibrido from "./DashboardResultadosHibrido";
import DashboardResultadosReforma from "./DashboardResultadosReforma";
import CalculationMemory from "./CalculationMemory";
import type { MemoryDetailGroup } from "./CalculationMemory";
import { calculateIrpjAdditional } from "./irpjAdditional";
import { buildMemorySimplesAtualCard } from "./MemorySimplesAtual";
import { buildTaxCompositionItems } from "./taxComposition";
import { LEGAL_CHECKBOX_TEXT, LEGAL_FOOTER_TEXT } from "./legalTexts";
import {
  fmt, fmtPct,
  CardConclusao, ResumoExecutivo, MoneyValue
} from "./DashboardDS";
import type { TipoComparacao } from "./ResultadosTypes";

interface Props {
  results: Record<string, unknown> | null;
  formData: Record<string, string>;
  onEdit: () => void;
  onGeneratePdf: () => void;
  tipoComparacao: TipoComparacao;
  pdfLoading: boolean;
  pdfError: string | null;
  engineReady: boolean;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseCurrencyInput(value: string | undefined): number {
  if (!value) return 0;
  return parseFloat(value.replace(/\./g, "").replace(",", ".")) || 0;
}

function presumedBaseRows(detail: Record<string, unknown> | undefined, taxLabel: string, taxRate: number, taxValue: number): NonNullable<MemoryDetailGroup["rows"]> {
  if (!detail) return [];
  const n = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
  const rows: NonNullable<MemoryDetailGroup["rows"]> = [
    { label: `${taxLabel} - Receita ate o limite`, value: `R$ ${fmt(n(detail.receitaNormal))}` },
    { label: `${taxLabel} - Presuncao normal`, value: fmtPct(n(detail.presuncaoNormal) * 100) },
    { label: `${taxLabel} - Base normal`, value: `R$ ${fmt(n(detail.baseNormal))}` },
  ];
  if (n(detail.receitaExcedente) > 0) {
    rows.push(
      { label: `${taxLabel} - Receita excedente`, value: `R$ ${fmt(n(detail.receitaExcedente))}` },
      { label: `${taxLabel} - Presuncao majorada`, value: fmtPct(n(detail.presuncaoMajorada) * 100) },
      { label: `${taxLabel} - Base majorada`, value: `R$ ${fmt(n(detail.baseMajorada))}` },
    );
  }
  rows.push(
    { label: `${taxLabel} - Base total`, value: `R$ ${fmt(n(detail.baseTotal))}`, emphasis: true },
    { label: `${taxLabel} - Aliquota`, value: fmtPct(taxRate) },
    { label: `${taxLabel} - Valor`, value: `R$ ${fmt(taxValue)}`, emphasis: true },
  );
  return rows;
}

function getDasCompositionRows(anexo: string, das: number, sublimiteIcms: boolean, sublimiteIss: boolean) {
  const cofinsPisRatio = { pis: 0.65 / 3.65, cofins: 3 / 3.65 };
  const shares: Record<string, { label: string; pct: number }[]> = {
    "Anexo I": [
      { label: "IRPJ", pct: 0.055 }, { label: "CSLL", pct: 0.035 },
      { label: "PIS", pct: 0.155 * cofinsPisRatio.pis }, { label: "COFINS", pct: 0.155 * cofinsPisRatio.cofins },
      { label: "CPP", pct: 0.415 }, { label: "ICMS", pct: 0.34 },
    ],
    "Anexo II": [
      { label: "IRPJ", pct: 0.055 }, { label: "CSLL", pct: 0.035 },
      { label: "PIS", pct: 0.14 * cofinsPisRatio.pis }, { label: "COFINS", pct: 0.14 * cofinsPisRatio.cofins },
      { label: "CPP", pct: 0.375 }, { label: "IPI", pct: 0.075 }, { label: "ICMS", pct: 0.32 },
    ],
    "Anexo III": [
      { label: "IRPJ", pct: 0.04 }, { label: "CSLL", pct: 0.035 },
      { label: "PIS", pct: 0.156 * cofinsPisRatio.pis }, { label: "COFINS", pct: 0.156 * cofinsPisRatio.cofins },
      { label: "CPP", pct: 0.434 }, { label: "ISS", pct: 0.335 },
    ],
    "Anexo IV": [
      { label: "IRPJ", pct: 0.188 }, { label: "CSLL", pct: 0.152 },
      { label: "PIS", pct: 0.198 * cofinsPisRatio.pis }, { label: "COFINS", pct: 0.198 * cofinsPisRatio.cofins },
      { label: "ISS", pct: 0.462 },
    ],
    "Anexo V": [
      { label: "IRPJ", pct: 0.25 }, { label: "CSLL", pct: 0.15 },
      { label: "PIS", pct: 0.172 * cofinsPisRatio.pis }, { label: "COFINS", pct: 0.172 * cofinsPisRatio.cofins },
      { label: "CPP", pct: 0.288 }, { label: "ISS", pct: 0.14 },
    ],
  };
  const baseRows = shares[anexo] || shares["Anexo III"];
  const rows = baseRows.map(row => {
    const removedBySublimite = (row.label === "ICMS" && sublimiteIcms) || (row.label === "ISS" && sublimiteIss);
    return { label: row.label, value: removedBySublimite ? 0 : das * row.pct };
  });
  return rows;
}

export default function DashboardResultados({
  results,
  formData,
  onEdit,
  onGeneratePdf,
  tipoComparacao,
  pdfLoading,
  pdfError,
  engineReady,
}: Props) {

  // All hooks must be unconditional — before any early return
  const [confirmed, setConfirmed] = useState(false);
  const [hipotetica, setHipotetica] = useState(false);
  const [pdfLocalError, setPdfLocalError] = useState("");

  const handlePdf = useCallback(() => {
    if (!confirmed) { setPdfLocalError("Confirme as premissas antes de gerar o PDF."); return; }
    if (!engineReady) { setPdfLocalError("Motor de cálculo não está pronto."); return; }
    setPdfLocalError("");
    onGeneratePdf();
  }, [confirmed, engineReady, onGeneratePdf]);

  const r = results || {};
  const showPdfError = pdfLocalError || pdfError;

  function renderSimplesPresumido() {
    if (results) {
      const sn = r.sn;
      const lp = r.lp;
      if (!isRecord(sn)) return <div className="bg-red-50 border border-red-200 rounded-xl p-4"><p className="text-base text-red-600">Dados do Simples Nacional ausentes</p><button onClick={onEdit} className="mt-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 px-6 rounded-xl font-semibold">Editar dados</button></div>;
      if (!isRecord(lp)) return <div className="bg-red-50 border border-red-200 rounded-xl p-4"><p className="text-base text-red-600">Dados do Lucro Presumido ausentes</p><button onClick={onEdit} className="mt-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 px-6 rounded-xl font-semibold">Editar dados</button></div>;
      const snTotal = typeof sn.total === "number" ? sn.total : NaN;
      const lpTotal = typeof lp.total === "number" ? lp.total : NaN;
      if (!isFinite(snTotal) || isNaN(snTotal)) return <div className="bg-red-50 border border-red-200 rounded-xl p-4"><p className="text-base text-red-600">Total do Simples Nacional inválido</p><button onClick={onEdit} className="mt-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 px-6 rounded-xl font-semibold">Editar dados</button></div>;
      if (!isFinite(lpTotal) || isNaN(lpTotal)) return <div className="bg-red-50 border border-red-200 rounded-xl p-4"><p className="text-base text-red-600">Total do Lucro Presumido inválido</p><button onClick={onEdit} className="mt-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 px-6 rounded-xl font-semibold">Editar dados</button></div>;
    }

    const sn = (r.sn || {}) as Record<string, unknown>;
    const lp = (r.lp || {}) as Record<string, unknown>;
    const rec = (r.rec || {}) as Record<string, unknown>;
    const sublimite = (r.sublimite || {}) as Record<string, unknown>;

    const snTotal = typeof sn.total === "number" ? sn.total : 0;
    const lpTotal = typeof lp.total === "number" ? lp.total : 0;
    const sublimiteIcms = sn.sublimiteIcms === true;
    const sublimiteIss = sn.sublimiteIss === true;
    const temSublimite = sublimiteIcms || sublimiteIss;
    const snLabel = typeof sn.label === "string" ? sn.label : "SIMPLES NACIONAL";

    const rbtStr = formData?.rbt12Input || "";
    const rbt12 = parseCurrencyInput(rbtStr);

    const snAliquotaEfetiva = typeof sn.aliquota === "number" ? sn.aliquota : (rbt12 > 0 ? snTotal / rbt12 * 100 : 0);
    const lpAliquotaEfetiva = typeof lp.aliquota === "number" ? lp.aliquota : (rbt12 > 0 ? lpTotal / rbt12 * 100 : 0);

    const elegibilidade = isRecord(r.elegibilidade) ? r.elegibilidade : {};
    const snElegivel = elegibilidade.snElegivel !== false;
    const snBlocked = !snElegivel;

    const winner = snBlocked && !hipotetica
      ? "Lucro Presumido"
      : snTotal < lpTotal ? "Simples Nacional" : lpTotal < snTotal ? "Lucro Presumido" : null;
    const economia = snTotal > 0 || lpTotal > 0 ? Math.abs(snTotal - lpTotal) : 0;
    const economiaMensal = economia / 12;
    const diffPct = Math.max(snTotal, lpTotal) > 0 ? economia / Math.max(snTotal, lpTotal) : 0;

    const tipoAtivLP = (formData?.tipoAtivLP || "").toLowerCase();
    const issPctForm = parseFloat((formData?.aliquotaISS || "2.5").replace(",", ".")) || 2.5;
      const comprasVal = parseCurrencyInput(formData?.comprasInput || "0");
      const icmsPctForm = parseFloat((formData?.aliquotaICMS || "18").replace(",", ".")) || 18;
      const ipiPctForm = parseFloat((formData?.aliquotaIPI || "0").replace(",", ".")) || 0;
      const anexoSN = typeof sn.anexo === "string" ? sn.anexo : "—";
    const fatorRUsado = typeof r.anexoFR === "string" && r.anexoFR.length > 0;
    const fatorRTexto = fatorRUsado
      ? "Enquadramento definido conforme o Fator R."
      : `Esta simulação foi realizada considerando enquadramento no ${anexoSN}, conforme as premissas informadas.`;
    const dasComposicaoBase = typeof sn.das === "number" ? sn.das : (typeof sn.dasAnual === "number" ? sn.dasAnual : 0);
    const dasRows = getDasCompositionRows(anexoSN, dasComposicaoBase, sublimiteIcms, sublimiteIss);
    const maxTotal = Math.max(snBlocked && !hipotetica ? 0 : snTotal, lpTotal, 1);
    const snBarPct = Math.max(4, ((snBlocked && !hipotetica ? 0 : snTotal) / maxTotal) * 100);
    const lpBarPct = Math.max(4, (lpTotal / maxTotal) * 100);
      const municipio = [formData?.municipio, formData?.estado].filter(Boolean).join("/") || "—";
      const economiaCincoAnos = economia * 5;
      const lpPresIRPJ = typeof lp.presIRPJ === "number" ? lp.presIRPJ : 0;
      const lpPresCSLL = typeof lp.presCSLL === "number" ? lp.presCSLL : 0;
      const lpBaseIRPJ = typeof lp.baseIRPJ === "number" ? lp.baseIRPJ : rbt12 * (lpPresIRPJ / 100);
      const lpBaseCSLL = typeof lp.baseCSLL === "number" ? lp.baseCSLL : rbt12 * (lpPresCSLL / 100);
      const lpIrpjAdditional = calculateIrpjAdditional(lpBaseIRPJ);
      const lpBaseAdic = lpIrpjAdditional.baseExcedente;
      const lpIrpjAdic = (lp.irpjAdic as number) || lpIrpjAdditional.valor;
      const lpFederalRows = [
        ...presumedBaseRows(lp.basePresumidaIRPJDetalhe as Record<string, unknown> | undefined, "IRPJ", 15, (lp.irpj15 as number) || 0),
        ...presumedBaseRows(lp.basePresumidaCSLLDetalhe as Record<string, unknown> | undefined, "CSLL", 9, (lp.csll as number) || 0),
        ...(((lp.ipi as number) || 0) > 0
          ? [{ label: "IPI", value: "" }, { label: "Base", value: `R$ ${fmt(rbt12)}` }, { label: "Alíquota", value: fmtPct(ipiPctForm) }, { label: "Débito", value: `R$ ${fmt((lp.ipi as number) || 0)}` }, { label: "Crédito", value: `R$ ${fmt(0)}` }, { label: "IPI Líquido", value: `R$ ${fmt((lp.ipi as number) || 0)}`, emphasis: true }]
          : []),
        ...(lpIrpjAdic > 0 ? [{ label: "IRPJ Adicional", value: "" }, { label: "Receita/Base Presumida", value: `R$ ${fmt(lpBaseIRPJ)}` }, { label: "Limite legal", value: `R$ ${fmt(60000)}` }, { label: "Base excedente", value: `R$ ${fmt(lpBaseAdic)}` }, { label: "Alíquota 10%", value: fmtPct(10) }, { label: "Valor do adicional", value: `R$ ${fmt(lpIrpjAdic)}`, emphasis: true }] : []),
      ];
      const lpDetails = [
        ...(((lp.icms as number) || 0) > 0 ? [{ title: "Tributos Estaduais", rows: [{ label: "ICMS", value: "" }, { label: "Base", value: `R$ ${fmt(rbt12)}` }, { label: "Alíquota", value: fmtPct(icmsPctForm) }, { label: "Débito", value: `R$ ${fmt(rbt12 * icmsPctForm / 100)}` }, { label: "Crédito", value: `R$ ${fmt(Math.max(0, rbt12 * icmsPctForm / 100 - ((lp.icms as number) || 0)))}` }, { label: "ICMS Líquido", value: `R$ ${fmt((lp.icms as number) || 0)}`, emphasis: true }] }] : []),
        ...(lpFederalRows.length ? [{ title: "Tributos Federais", rows: lpFederalRows }] : []),
      ];
    const winnerDisplay = winner || "os regimes ficaram equivalentes";
    const winnerBullets = winner === "Simples Nacional"
      ? [
        "Menor carga tributária total",
        "Tributação concentrada no DAS",
        "Menor incidência relativa de IRPJ e CSLL",
        `Economia anual estimada de R$ ${fmt(economia)}`,
      ]
      : winner === "Lucro Presumido"
      ? [
        "Menor carga tributária total",
        "Cálculo separado por tributo com base nas premissas informadas",
        "Carga efetiva consolidada inferior ao Simples Nacional",
        `Economia anual estimada de R$ ${fmt(economia)}`,
      ]
      : [
        "Cargas tributárias equivalentes nas premissas informadas",
        "A decisão deve considerar obrigações acessórias e projeções futuras",
      ];

    let justification = "";
    if (winner && rbt12 > 0) {
      if (snBlocked && !hipotetica) {
        justification = `O Lucro Presumido é o regime aplicável: a empresa não é elegível ao Simples Nacional. Carga efetiva estimada de ${fmtPct(lpAliquotaEfetiva)}.`;
      } else if (winner === "Simples Nacional") {
        justification = `O Simples Nacional apresentou menor carga estimada porque sua alíquota efetiva de ${fmtPct(snAliquotaEfetiva)} ficou abaixo da carga consolidada de ${fmtPct(lpAliquotaEfetiva)} apurada no Lucro Presumido.`;
        if (typeof sn.anexo === "string" && sn.anexo) justification += ` Anexo: ${sn.anexo}.`;
        if (typeof sn.fatorR === "string" && sn.fatorR && sn.fatorR !== "—") justification += ` Fator R: ${sn.fatorR}`;
        justification += ` Diferença anual: R$ ${fmt(economia)} (${fmtPct(diffPct * 100)}).`;
      } else {
        justification = `O Lucro Presumido apresentou menor carga estimada com alíquota efetiva de ${fmtPct(lpAliquotaEfetiva)} contra ${fmtPct(snAliquotaEfetiva)} do Simples Nacional.`;
        justification += ` Diferença anual: R$ ${fmt(economia)} (${fmtPct(diffPct * 100)}).`;
      }
    }

    const statusCalculo = typeof r.statusCalculo === "string" ? r.statusCalculo : "VALIDO";
    const dadosInsuficientes = statusCalculo === "DADOS_INSUFICIENTES";
    const showCards = (snTotal > 0 || lpTotal > 0) && !dadosInsuficientes;
    const showWinner = showCards && (!snBlocked || hipotetica);
    const isAumentoSN = winner === "Lucro Presumido";

    return (
      <div className="space-y-6">

        {!!r.cnaeAviso && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-base text-amber-700">A empresa possui CNAEs de naturezas distintas. Confirme o tipo de atividade utilizado na simulação.</p>
          </div>
        )}

        {showCards && (
          <ResumoExecutivo
            card1={{
              titulo: temSublimite ? snLabel : "Simples Nacional",
              total: snBlocked && !hipotetica ? 0 : snTotal,
              rotuloTotal: snBlocked && !hipotetica ? "Não Elegível" : "Total anual estimado",
              corBorda: snBlocked ? "border-red-200" : "border-emerald-200",
              corFundo: snBlocked && !hipotetica ? "bg-red-50" : "bg-emerald-50",
              corTitulo: snBlocked && !hipotetica ? "text-red-700" : "text-emerald-700",
              corValor: snBlocked && !hipotetica ? "text-red-500" : "text-emerald-900",
              icone: <Receipt className="w-5 h-5 text-blue-600" />,
              linhas: snBlocked && !hipotetica
                ? [{ label: "Status", valor: "Não Elegível", cor: "text-red-600" }]
                : [
                  { label: "Média mensal", valor: "R$ " + fmt(typeof sn.media === "number" ? sn.media : snTotal / 12) },
                  { label: "Alíquota efetiva", valor: fmtPct(snAliquotaEfetiva), cor: "text-emerald-700" },
                  { label: "Receita bruta", valor: "R$ " + fmt(rbt12) },
                ]
            }}
            card2={{
              titulo: "Lucro Presumido",
              total: lpTotal,
              rotuloTotal: "Total anual estimado",
              corBorda: "border-blue-200",
              corFundo: "bg-blue-50",
              corTitulo: "text-blue-700",
              corValor: "text-blue-900",
              icone: <TrendingUp className="w-5 h-5 text-blue-600" />,
              linhas: [
                { label: "Média mensal", valor: "R$ " + fmt(typeof lp.media === "number" ? lp.media : lpTotal / 12) },
                { label: "Alíquota efetiva", valor: fmtPct(lpAliquotaEfetiva), cor: "text-blue-700" },
                { label: "Receita bruta", valor: "R$ " + fmt(rbt12) },
              ]
            }}
            cardImpacto={{
              isAumento: isAumentoSN,
              valorAnual: economia,
              rotulo: isAumentoSN ? "Aumento no SN" : "Economia no SN",
              valorMensal: economiaMensal,
              variacao: diffPct * 100,
              flagMenorCarga: winner || "—",
            }}
          />
        )}

        {showCards && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm" data-testid="premises-section">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-6 h-6 text-blue-600 shrink-0" />
              <h2 className="text-xl font-bold text-slate-800">Premissas da Simulação</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-sm">
              {[
                ["Receita", "R$ " + fmt(rbt12)],
                ["Compras", "R$ " + fmt(comprasVal)],
                ["CNAE", formData.cnae || "—"],
                ["Anexo", anexoSN],
                ["Município", `${municipio} (${issPctForm.toFixed(2).replace(".", ",")}%)`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-center min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500 block">{label}</span>
                  <strong className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-slate-800 tabular-nums [font-variant-numeric:tabular-nums]">{value}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {showWinner && false && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-start gap-3 mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <h2 className="text-xl font-bold text-slate-800">Por que {winnerDisplay} foi o mais econômico?</h2>
                <p className="text-sm text-slate-500 mt-1">Análise gerencial com base nos valores calculados para esta simulação.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {winnerBullets.map((item, index) => (
                <div key={index} className="flex items-start gap-2 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span className="text-slate-700 text-sm leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {showCards && false && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Comparação Visual</h2>
                  <p className="text-sm text-slate-500">Barras proporcionais ao total de tributos calculado.</p>
                </div>
              </div>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-sm mb-2"><span className="font-semibold text-emerald-800">Simples Nacional</span><span>R$ {fmt(snBlocked && !hipotetica ? 0 : snTotal)}</span></div>
                  <div className="h-4 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${snBarPct}%` }} /></div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2"><span className="font-semibold text-blue-800">Lucro Presumido</span><span>R$ {fmt(lpTotal)}</span></div>
                  <div className="h-4 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-blue-500" style={{ width: `${lpBarPct}%` }} /></div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Economia</h2>
              <div className="space-y-4">
                <div><p className="text-sm text-slate-500">Economia Mensal</p><MoneyValue value={economiaMensal} size="md" color="text-emerald-700" /></div>
                <div><p className="text-sm text-slate-500">Economia Anual</p><MoneyValue value={economia} size="md" color="text-emerald-700" /></div>
                <div><p className="text-sm text-slate-500">Economia em 5 anos</p><MoneyValue value={economiaCincoAnos} size="md" color="text-emerald-700" /></div>
              </div>
            </div>
          </div>
        )}

        {snBlocked && showCards && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={hipotetica} onChange={e => setHipotetica(e.target.checked)}
                className="w-5 h-5 accent-amber-500 shrink-0" />
              <div>
                <span className="text-base font-semibold text-amber-800">Simulação Hipotética</span>
                <p className="text-sm text-amber-600">Calcular como se a empresa fosse elegível ao Simples Nacional</p>
              </div>
            </label>
          </div>
        )}

        {dadosInsuficientes && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-amber-800">Situação do Sublimite Pendente</h3>
                <p className="text-base text-amber-700 mt-2 leading-relaxed">{(rec.reason as string) || (sublimite.justificativaLegal as string) || "Não foi possível concluir a comparação porque a data de início dos efeitos do sublimite não foi determinada."}</p>
              </div>
            </div>
          </div>
        )}

        {showCards && (
          <CalculationMemory
            description="Formação resumida dos regimes comparados."
            observation="A memória detalhada permanece disponível para conferência de bases, alíquotas e valores finais."
            cards={[
              buildMemorySimplesAtualCard({ title: temSublimite ? snLabel : "Simples Nacional", tone: "current", items: dasRows, total: snBlocked && !hipotetica ? 0 : snTotal, effectiveRate: snBlocked && !hipotetica ? 0 : snAliquotaEfetiva, observation: fatorRTexto }),
              {
                title: "Lucro Presumido",
                tone: "compared",
                items: buildTaxCompositionItems({ scenario: { ...lp, irpjAdic: lpIrpjAdic, baseAdic: lpBaseAdic }, revenue: rbt12, baseIRPJ: lpBaseIRPJ, baseCSLL: lpBaseCSLL, presIRPJ: lpPresIRPJ, presCSLL: lpPresCSLL, rates: { iss: issPctForm, icms: icmsPctForm, ipi: ipiPctForm } }),
                total: lpTotal,
                effectiveRate: lpAliquotaEfetiva,
                details: lpDetails,
              },
            ]}
          />
        )}

        {showCards && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Comparação Visual</h2>
                  <p className="text-sm text-slate-500">Barras proporcionais ao total de tributos calculado.</p>
                </div>
              </div>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between gap-4 text-sm mb-2"><span className="font-semibold text-emerald-800">Simples Nacional</span><span className="whitespace-nowrap tabular-nums">R$ {fmt(snBlocked && !hipotetica ? 0 : snTotal)}</span></div>
                  <div className="h-4 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${snBarPct}%` }} /></div>
                </div>
                <div>
                  <div className="flex justify-between gap-4 text-sm mb-2"><span className="font-semibold text-blue-800">Lucro Presumido</span><span className="whitespace-nowrap tabular-nums">R$ {fmt(lpTotal)}</span></div>
                  <div className="h-4 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-blue-500" style={{ width: `${lpBarPct}%` }} /></div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Economia</h2>
              <div className="space-y-4">
                <div><p className="text-sm text-slate-500">Economia Mensal</p><MoneyValue value={economiaMensal} size="md" color="text-emerald-700" /></div>
                <div><p className="text-sm text-slate-500">Economia Anual</p><MoneyValue value={economia} size="md" color="text-emerald-700" /></div>
                <div><p className="text-sm text-slate-500">Economia em 5 anos</p><MoneyValue value={economiaCincoAnos} size="md" color="text-emerald-700" /></div>
              </div>
            </div>
          </div>
        )}

        {showPdfError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-base text-red-600">{showPdfError}</p>
          </div>
        )}

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            <p className="text-lg font-semibold text-slate-700">Conferência da Simulação</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-base mb-4">
            <div><span className="text-slate-400">Receita:</span> <MoneyValue value={rbt12} size="sm" /></div>
            <div><span className="text-slate-400">Atividade:</span> <strong>{tipoAtivLP || "—"}</strong></div>
            <div><span className="text-slate-400">Total SN:</span> <MoneyValue value={snTotal} size="sm" /></div>
            <div><span className="text-slate-400">Total LP:</span> <MoneyValue value={lpTotal} size="sm" /></div>
            <div className="sm:col-span-2"><span className="text-slate-400">Regime com menor carga:</span> <strong>{winner || "—"}</strong></div>
          </div>
        </div>

        {showWinner && justification && (
          <CardConclusao isAumento={isAumentoSN} texto={justification} vencedor={winner || "—"} impactoAnual={economia} impactoPct={diffPct * 100} />
        )}

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
          <label className="flex items-center gap-3 text-base cursor-pointer">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
              className="w-5 h-5 accent-green-600 shrink-0" />
            <span className="text-slate-700">{LEGAL_CHECKBOX_TEXT}</span>
          </label>
          <p className="border-t border-slate-200 pt-4 text-sm leading-relaxed text-slate-500">
            {LEGAL_FOOTER_TEXT}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={onEdit} type="button"
            className="flex-1 bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-700 py-4 rounded-2xl text-base font-semibold transition-colors">
            Editar dados da simulação
          </button>
          <button onClick={handlePdf} type="button" disabled={pdfLoading || !confirmed}
            className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-2xl text-base font-semibold transition-colors">
            {pdfLoading ? "Gerando relatório..." : !confirmed ? "Confirme as premissas acima" : "Gerar relatório em PDF"}
          </button>
        </div>
      </div>
    );
  }

  // Early returns after ALL hooks
  if (tipoComparacao === "SIMPLES_TRADICIONAL_VS_HIBRIDO") {
    return (
      <DashboardResultadosHibrido
        results={results}
        onEdit={onEdit}
        onGeneratePdf={onGeneratePdf}
        pdfLoading={pdfLoading}
        pdfError={pdfError}
      />
    );
  }

  if (tipoComparacao === "PRESUMIDO_ATUAL_VS_REFORMA") {
    return (
      <DashboardResultadosReforma
        results={results}
        onEdit={onEdit}
        onGeneratePdf={onGeneratePdf}
        pdfLoading={pdfLoading}
        pdfError={pdfError}
      />
    );
  }

  return renderSimplesPresumido();
}
