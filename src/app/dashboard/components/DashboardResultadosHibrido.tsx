"use client";

import { useCallback, useState } from "react";
import { Receipt, TrendingUp } from "lucide-react";
import { CardConclusao, fmt, fmtPct, MoneyValue, ResumoExecutivo } from "./DashboardDS";
import { getComparisonDecision } from "./comparisonDecision";
import CalculationMemory from "./CalculationMemory";
import { buildMemorySimplesHibridoCard, buildMemorySimplesHibridoItems } from "./MemorySimplesHibrido";
import { LEGAL_CHECKBOX_TEXT, LEGAL_FOOTER_TEXT } from "./legalTexts";

interface Props {
  results: Record<string, unknown> | null;
  onEdit: () => void;
  onGeneratePdf?: () => void;
  pdfLoading?: boolean;
  pdfError?: string | null;
}

type AnyRecord = Record<string, unknown>;
type Row = { label: string; value: string; tone?: "slate" | "blue" | "green" | "red"; dividerBefore?: boolean; strong?: boolean };

const n = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
const text = (value: unknown, fallback = "-") => typeof value === "string" && value.trim() ? value : fallback;
const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;

function PremiseGrid({ rows }: { rows: Row[] }) {
  return <section className="rounded-3xl bg-white p-4 ring-1 ring-slate-200" data-testid="premises-section"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-700">Premissas Utilizadas na Simulação</p><div className="mt-3 grid grid-cols-1 overflow-hidden rounded-2xl ring-1 ring-slate-200 sm:grid-cols-5">{rows.map((row) => <div key={row.label} className="min-w-0 border-b border-slate-100 px-3 py-2 text-center last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">{row.label}</p><p className="mt-1 inline-flex max-w-full flex-nowrap justify-center overflow-hidden text-ellipsis whitespace-nowrap break-normal text-sm font-extrabold tabular-nums text-slate-950 [font-variant-numeric:tabular-nums] [overflow-wrap:normal] [word-break:keep-all]">{row.value}</p></div>)}</div></section>;
}

function BenefitBox({ beneficio }: { beneficio: AnyRecord }) {
  const baseLegal = text(beneficio.baseLegal, "LC 214/2025").replace(/,?\s*Art\.\s*\d+.*$/i, "");
  const artigo = beneficio.artigo ? `Art. ${beneficio.artigo}${beneficio.inciso ? `, ${beneficio.inciso}` : ""}` : "Art. 127, VII";
  return (
    <section className="rounded-3xl bg-emerald-50/70 p-4 ring-1 ring-emerald-200" data-testid="benefit-section">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700">✓</span>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-700">Benefício Fiscal</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">Redução de {fmtPct(n(beneficio.pctReducao))} nas alíquotas da CBS e do IBS.</p>
          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-500">Base legal</p>
          <p className="text-sm font-extrabold text-slate-800">{baseLegal} • {artigo}</p>
          <p className="mt-1 text-sm text-slate-600">Aplicação condicionada ao atendimento dos requisitos legais.</p>
        </div>
      </div>
    </section>
  );
}

function ComparisonVisual({ bars }: { bars: { label: string; value: number; tone: "green" | "blue" }[] }) {
  const max = Math.max(...bars.map((bar) => bar.value), 1);
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6" data-testid="comparison-visual">
      <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-slate-800">Comparação Visual</h2>
          <p className="text-sm text-slate-500">Barras proporcionais ao total de tributos calculado.</p>
        </div>
        <div className="space-y-5">
          {bars.map((bar) => (
            <div key={bar.label}>
              <div className="flex justify-between gap-4 text-sm mb-2"><span className={bar.tone === "green" ? "font-semibold text-emerald-800" : "font-semibold text-blue-800"}>{bar.label}</span><span className="font-semibold whitespace-nowrap tabular-nums">R$ {fmt(bar.value)}</span></div>
              <div className="h-4 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${bar.tone === "green" ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${Math.max(4, bar.value / max * 100)}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Diferença</h2>
        <div className="space-y-4">
          <div><p className="text-sm text-slate-500">Comparativo anual</p><p className="text-sm text-slate-700">Valores calculados pelo motor.</p></div>
          {bars.map((bar) => <div key={bar.label}><p className="text-sm text-slate-500">{bar.label}</p><MoneyValue value={bar.value} size="md" color={bar.tone === "green" ? "text-emerald-700" : "text-blue-700"} /></div>)}
        </div>
      </div>
    </div>
  );
}

export default function DashboardResultadosHibrido({ results, onEdit, onGeneratePdf, pdfLoading, pdfError }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const handlePdf = useCallback(() => {
    if (!confirmed) return;
    if (onGeneratePdf) onGeneratePdf();
  }, [confirmed, onGeneratePdf]);

  const r = results || {};
  if (r.error) return <div className="flex flex-col items-center justify-center gap-4 py-20"><p className="text-lg font-medium text-red-600">Erro no cálculo: {String(r.error)}</p><button onClick={onEdit} className="rounded-xl bg-slate-100 px-6 py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-200">Editar dados</button></div>;

  const snTrad = (r.simplesTradicional || {}) as AnyRecord;
  const hib = (r.simplesHibrido || {}) as AnyRecord;
  const cbs = (r.CBS || {}) as AnyRecord;
  const premissas = (r.premissas || {}) as AnyRecord;
  const beneficio = (premissas.beneficioProfissional || {}) as AnyRecord;
  const detalhamento = (r.detalhamento || {}) as AnyRecord;
  const cenariosBeneficio = (r.cenariosBeneficio || null) as AnyRecord | null;
  const cenarioComBeneficio = (cenariosBeneficio?.comBeneficioConfirmado || {}) as AnyRecord;
  const displayHib = { ...hib, ...((cenarioComBeneficio.simplesHibrido || {}) as AnyRecord) };
  const displayCbs = { ...cbs, ...((cenarioComBeneficio.CBS || {}) as AnyRecord) };
  const reducao = (displayCbs.reducao || premissas.cbsReducao || {}) as AnyRecord;
  const receita = n(snTrad.rbt12) || n(premissas.rbt12);
  const compras = n(premissas.compras) || n(displayCbs.baseCreditavel);
  const snTotal = n(snTrad.total);
  const hibTotal = n(displayHib.total);
  const decisao = getComparisonDecision({ regimeA: { name: "Simples Tradicional", total: snTotal }, regimeB: { name: "Simples Híbrido", total: hibTotal } });
  const menorCarga = decisao.winner?.name || "";
  const isEmpate = decisao.type === "empate";
  const isAumento = decisao.type === "aumento";
  const aliqSn = n(snTrad.aliquota);
  const aliqHib = n(displayHib.aliquota);
  const mediaSn = n(snTrad.media) || n(snTrad.mediaMensal);
  const mediaHib = n(displayHib.media) || n(displayHib.mediaMensal);
  const parcelaCbs = n(hib.parcelaCbsRetiradaDoDas);
  const rowsTrad = Array.isArray(detalhamento.simplesTradicional) ? detalhamento.simplesTradicional as AnyRecord[] : [];
  const cbsReducaoPct = n((displayCbs.reducao as AnyRecord | undefined)?.pct) || n((reducao as AnyRecord).pct);
  const cnaeNormalizado = text(premissas.cnaeNormalizado || premissas.cnaeFormatado, "").replace(/\D/g, "");
  const categoria = text(premissas.categoriaTributaria, "").toLowerCase();
  const isCommerce = categoria.includes("comercio") || cnaeNormalizado.startsWith("47") || cnaeNormalizado.startsWith("46") || cnaeNormalizado.startsWith("45");
  const isIndustry = categoria.includes("industria") || /^(1\d|2\d|3[0-3])/.test(cnaeNormalizado);
  const ibsHasImpact = n(displayHib.parcelaIbsRetiradaDoDas) > 0 || n(displayHib.ibsLiquido) > 0;
  const simpleTradItems = buildMemorySimplesHibridoItems(rowsTrad, isCommerce, isIndustry, ibsHasImpact);
  if (!snTotal && !hibTotal) return <div className="flex flex-col items-center justify-center gap-4 py-20"><p className="text-base text-slate-400">Nenhum resultado disponível. Preencha os dados e gere o diagnóstico.</p></div>;

  const premiseRows: Row[] = [
    { label: "Receita", value: `R$ ${fmt(receita)}` },
    { label: "Compras", value: `R$ ${fmt(compras)}` },
    { label: "CNAE", value: text(premissas.cnaeFormatado) },
    { label: "Anexo", value: text(snTrad.anexo || premissas.anexo) },
    { label: "Município (ISS)", value: `${text(premissas.municipio)} (${hasText(premissas.issPct) ? `${text(premissas.issPct)}%` : fmtPct(n(premissas.aliquotaISS))})` },
  ];
  const hasBenefit = beneficio.potencial === true;
  const cbsAliqPadrao = n(displayCbs.aliqPadrao) || n(premissas.aliqCbs);
  const cbsAliq = n(displayCbs.aliq);
  const cbsAliqCompras = n(displayCbs.aliqCompras);
  const cbsMemoryRows = [...(cbsReducaoPct > 0 ? [{ label: "Alíquota Legal", value: fmtPct(cbsAliqPadrao) }, { label: "Redução Legal", value: fmtPct(cbsReducaoPct) }, { label: "Alíquota Aplicada", value: fmtPct(cbsAliq) }] : []), { label: "Receita Tributável", value: `R$ ${fmt(receita)}` }, { label: `Débito (${fmtPct(cbsAliq)})`, value: `R$ ${fmt(n(displayCbs.debito))}` }, { label: "Compras com Crédito", value: `R$ ${fmt(compras)}` }, { label: `Crédito (${fmtPct(cbsAliqCompras)})`, value: `R$ ${fmt(n(displayCbs.credito))}` }, { label: "CBS Líquida", value: `R$ ${fmt(n(displayCbs.liquida))}`, emphasis: true }];

  return (
    <div className="space-y-6" data-testid="hibrido-dashboard">
      <div data-testid="result-section">
        <ResumoExecutivo
          card1={{
          titulo: "Simples Tradicional",
          total: snTotal,
          rotuloTotal: "Total anual estimado",
          corBorda: menorCarga === "Simples Tradicional" ? "border-emerald-200" : "border-blue-200",
          corFundo: menorCarga === "Simples Tradicional" ? "bg-emerald-50" : "bg-blue-50",
          corTitulo: menorCarga === "Simples Tradicional" ? "text-emerald-700" : "text-blue-700",
          corValor: menorCarga === "Simples Tradicional" ? "text-emerald-900" : "text-blue-900",
          icone: <Receipt className="w-5 h-5 text-blue-600" />,
          linhas: [
            { label: "Média mensal", valor: "R$ " + fmt(mediaSn) },
            { label: "Alíquota efetiva", valor: fmtPct(aliqSn), cor: "text-blue-700" },
            { label: "DAS", valor: "R$ " + fmt(n(snTrad.das) || snTotal) },
          ],
        }}
          card2={{
          titulo: "Simples Híbrido",
          total: hibTotal,
          rotuloTotal: "Total anual estimado",
          corBorda: menorCarga === "Simples Híbrido" ? "border-emerald-200" : "border-blue-200",
          corFundo: menorCarga === "Simples Híbrido" ? "bg-emerald-50" : "bg-blue-50",
          corTitulo: menorCarga === "Simples Híbrido" ? "text-emerald-700" : "text-blue-700",
          corValor: menorCarga === "Simples Híbrido" ? "text-emerald-900" : "text-blue-900",
          icone: <TrendingUp className="w-5 h-5 text-blue-600" />,
          linhas: [
            { label: "Média mensal", valor: "R$ " + fmt(mediaHib) },
            { label: "Alíquota efetiva", valor: fmtPct(aliqHib), cor: "text-blue-700" },
            { label: "DAS reduzido", valor: "R$ " + fmt(n(displayHib.dasReduzido)) },
            { label: "CBS líquida", valor: "R$ " + fmt(n(displayCbs.liquida)) },
          ],
        }}
          cardImpacto={{
          isAumento,
          isEmpate,
          valorAnual: decisao.annualDifference,
          rotulo: isEmpate ? "Diferença zero" : isAumento ? "Diferença anual" : "Economia anual",
          valorMensal: decisao.monthlyDifference,
          variacao: decisao.differencePercent,
          flagMenorCarga: isEmpate ? "Empate" : menorCarga,
        }}
        />
      </div>

      <PremiseGrid rows={premiseRows} />
      {hasBenefit && <BenefitBox beneficio={{ ...beneficio, ...reducao }} />}

      <CalculationMemory
        description="Resumo da formação dos valores."
        observation="Observação: Nesta premissa do simulador, o IBS permanece recolhido dentro do DAS e não produz impacto financeiro em 2027."
        cards={[
          buildMemorySimplesHibridoCard({ title: "Simples Tradicional", tone: "current", items: simpleTradItems, total: snTotal, effectiveRate: aliqSn, observation: `Receita: R$ ${fmt(receita)} | DAS anual: R$ ${fmt(snTotal)}` }),
          {
            title: "Simples Híbrido",
            tone: "compared",
            items: [{ label: "DAS reduzido", value: n(displayHib.dasReduzido) }, { label: "CBS Líquida", value: n(displayCbs.liquida) }],
            total: hibTotal,
            effectiveRate: aliqHib,
            details: [{ title: "Formação do Total Híbrido", rows: [{ label: "DAS Original", value: `R$ ${fmt(n(hib.dasIntegral) || snTotal)}` }, { label: "(-) CBS retirada", value: `R$ ${fmt(parcelaCbs)}` }, { label: "(=) DAS reduzido", value: `R$ ${fmt(n(displayHib.dasReduzido))}` }, { label: "(+) CBS Líquida", value: `R$ ${fmt(n(displayCbs.liquida))}` }, { label: "TOTAL HÍBRIDO", value: `R$ ${fmt(hibTotal)}` }] }, { title: "Memória da CBS", rows: cbsMemoryRows }],
          },
        ]}
      />

      <ComparisonVisual bars={[{ label: "Simples Tradicional", value: snTotal, tone: menorCarga === "Simples Tradicional" ? "green" : "blue" }, { label: "Simples Híbrido", value: hibTotal, tone: menorCarga === "Simples Híbrido" ? "green" : "blue" }]} />

      <div data-testid="executive-conclusion">
        <CardConclusao isAumento={isAumento} isEmpate={isEmpate} texto={isEmpate ? `Os dois cenários apresentaram a mesma carga tributária final para as premissas informadas.${hasBenefit ? " A redução prevista pela LC 214/2025 depende do atendimento dos requisitos legais." : ""}` : `O ${menorCarga} apresentou menor carga tributária para as premissas informadas.${hasBenefit ? " A redução prevista pela LC 214/2025 depende do atendimento dos requisitos legais." : ""}`} vencedor={isEmpate ? undefined : menorCarga} impactoAnual={decisao.annualDifference} impactoPct={decisao.differencePercent} />
      </div>

      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 space-y-4"><label className="flex cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="h-5 w-5 shrink-0 accent-green-600" /><span className="text-slate-700">{LEGAL_CHECKBOX_TEXT}</span></label><p className="border-t border-slate-200 pt-4 text-sm leading-relaxed text-slate-500">{LEGAL_FOOTER_TEXT}</p></div>
      {pdfError && <div className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="text-base text-red-600">{pdfError}</p></div>}
      <div className="flex flex-col gap-3 sm:flex-row"><button onClick={onEdit} className="flex-1 rounded-2xl border border-slate-300 bg-white py-3 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50">Editar dados da simulação</button>{onGeneratePdf && <button onClick={handlePdf} type="button" disabled={pdfLoading || !confirmed} className="flex-1 rounded-2xl bg-blue-700 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{pdfLoading ? "Gerando relatório..." : !confirmed ? "Confirme as premissas acima" : "Gerar relatório em PDF"}</button>}</div>
    </div>
  );
}
