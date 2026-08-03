"use client";

import { useState, useCallback } from "react";
import { Receipt, TrendingUp } from "lucide-react";
import { CardConclusao, fmt, fmtPct, ResumoExecutivo } from "./DashboardDS";
import MemoryReforma from "./MemoryReforma";
import type { MemoryDetailGroup } from "./CalculationMemory";
import { calculateIrpjAdditional } from "./irpjAdditional";
import { buildTaxCompositionItems } from "./taxComposition";
import { LEGAL_CHECKBOX_TEXT, LEGAL_FOOTER_TEXT } from "./legalTexts";

interface Props {
  results: Record<string, unknown> | null;
  onEdit: () => void;
  onGeneratePdf?: () => void;
  pdfLoading?: boolean;
  pdfError?: string | null;
}

type AnyRecord = Record<string, unknown>;

const n = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
const s = (value: unknown, fallback = "-") => typeof value === "string" && value.trim() ? value : fallback;

function presumedBaseRows(detail: AnyRecord | undefined, taxLabel: string, taxRate: number, taxValue: number): NonNullable<MemoryDetailGroup["rows"]> {
  if (!detail) return [];
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

function Section({ title, children, subtitle }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm" aria-labelledby={title.replace(/\s+/g, "-").toLowerCase()}>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 id={title.replace(/\s+/g, "-").toLowerCase()} className="text-xl font-bold text-slate-800">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Graph({ bars }: { bars: { label: string; total: number; aliquota: number; tone: string }[] }) {
  const max = Math.max(...bars.map((bar) => bar.total), 1);
  return (
    <Section title="Comparação Visual" subtitle="Barras proporcionais ao total de tributos calculado.">
      <div className="space-y-4" role="img" aria-label={bars.map((bar) => `${bar.label}: R$ ${fmt(bar.total)}, ${fmtPct(bar.aliquota)}`).join("; ")}>
        {bars.map((bar) => (
          <div key={bar.label}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm mb-2">
              <strong className="text-slate-700">{bar.label}</strong>
              <span className="font-mono text-slate-600">R$ {fmt(bar.total)} | {fmtPct(bar.aliquota)}</span>
            </div>
            <div className="h-4 rounded-full bg-slate-100 overflow-hidden">
              <div className={`${bar.tone} h-full rounded-full`} style={{ width: `${Math.max(8, bar.total / max * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function PremisesSummary({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm" data-testid="premises-section">
      <h2 className="text-xl font-bold text-slate-800">Premissas Utilizadas</h2>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-5 gap-3">
        {rows.map((row) => <div key={row.label} className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-center min-w-0"><span className="text-xs font-bold uppercase tracking-wide text-slate-500 block">{row.label}</span><strong className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-slate-800 tabular-nums [font-variant-numeric:tabular-nums]">{row.value}</strong></div>)}
      </div>
    </section>
  );
}

function BenefitSummary({ beneficio }: { beneficio: AnyRecord }) {
  const hasBenefit = n(beneficio.pctReducao) > 0 || beneficio.potencial === true;
  const baseLegal = s(beneficio.baseLegal, "LC 214/2025").replace(/,?\s*Art\.\s*\d+.*$/i, "");
  return (
    <section className={`${hasBenefit ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"} rounded-2xl border p-6 shadow-sm`} data-testid="benefit-section">
      <h2 className={`${hasBenefit ? "text-emerald-800" : "text-slate-800"} text-xl font-bold`}>Benefício Fiscal</h2>
      {hasBenefit ? <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm"><div className="rounded-xl bg-white/80 border border-white px-4 py-3"><strong className="text-emerald-700">✓ Redução de {fmtPct(n(beneficio.pctReducao))} nas alíquotas da CBS e IBS</strong></div><div className="rounded-xl bg-white/80 border border-white px-4 py-3 font-semibold text-slate-800">{baseLegal}</div><div className="rounded-xl bg-white/80 border border-white px-4 py-3 font-semibold text-slate-800">Art. {s(beneficio.artigo, "127")}{beneficio.inciso ? `, ${s(beneficio.inciso)}` : ", VII"}</div></div> : <p className="mt-2 text-sm text-slate-600">Sem benefício fiscal identificado.</p>}
    </section>
  );
}

export default function DashboardResultadosReforma({ results, onEdit, onGeneratePdf, pdfLoading, pdfError }: Props) {
  const [confirmed, setConfirmed] = useState(false);

  const handlePdf = useCallback(() => {
    if (!confirmed) return;
    if (onGeneratePdf) onGeneratePdf();
  }, [confirmed, onGeneratePdf]);

  const r = results || {};
  if (r.error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-lg text-red-600 font-medium">Erro no cálculo: {String(r.error)}</p>
        <button onClick={onEdit} className="mt-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 px-6 rounded-xl font-semibold transition-colors">Editar dados</button>
      </div>
    );
  }

  const atual = (r.lucroPresumidoAtual || {}) as AnyRecord;
  const futuro = (r.cenarioFuturo || {}) as AnyRecord;
  const premissas = (r.premissas || {}) as AnyRecord;
  const beneficio = (premissas.beneficioProfissional || {}) as AnyRecord;
  const cbs = (r.CBS || {}) as AnyRecord;
  const ibs = (r.IBS || {}) as AnyRecord;
  const cenariosBeneficio = (r.cenariosBeneficio || null) as AnyRecord | null;
  const cenarioComRaw = (cenariosBeneficio?.comBeneficioConfirmado || null) as AnyRecord | null;
  const cenarioSemRaw = (cenariosBeneficio?.semBeneficioConfirmado || null) as AnyRecord | null;
  const status = beneficio.status;
  const pendente = status === "PENDENTE" && !!cenarioComRaw && !!cenarioSemRaw;
  const confirmado = status === "APLICADO";
  const negado = status === "NAO_APLICADO";
  const receita = n(atual.rbt12) || n(premissas.rbt12);
  const atualTotal = n(atual.total);
  if (!atualTotal && !n(futuro.total)) {
    return <div className="flex flex-col items-center justify-center py-20 gap-4"><p className="text-base text-slate-400">Nenhum resultado disponível. Preencha os dados e gere o diagnóstico.</p></div>;
  }

  const cenarioCom = cenarioComRaw || (confirmado ? { ...futuro, CBS: cbs, IBS: ibs } : null);
  const cenarioSem = cenarioSemRaw || (negado || (!confirmado && !pendente) ? { ...futuro, CBS: cbs, IBS: ibs } : null);
  const cbsCom = (cenarioCom?.CBS || {}) as AnyRecord;
  const ibsCom = (cenarioCom?.IBS || {}) as AnyRecord;
  const cbsSem = (cenarioSem?.CBS || {}) as AnyRecord;
  const ibsSem = (cenarioSem?.IBS || {}) as AnyRecord;
  const issPct = receita > 0 ? n(atual.iss) / receita * 100 : 0;
  const aliquotaAtual = receita > 0 ? atualTotal / receita * 100 : 0;
  const showCom = !!cenarioCom && (pendente || confirmado);
  const showSem = !!cenarioSem && (negado || (!confirmado && !pendente));

  const primaryScenario = showCom ? cenarioCom : showSem ? cenarioSem : futuro;
  const primaryCbs = showCom ? cbsCom : showSem ? cbsSem : cbs;
  const primaryIbs = showCom ? ibsCom : showSem ? ibsSem : ibs;
  const primaryTitle = showCom ? "Pós-Reforma com benefício" : showSem ? "Pós-Reforma sem benefício" : "Cenário com Reforma";
  const primaryTotal = n(primaryScenario?.total);
  const primaryAliquota = receita > 0 ? primaryTotal / receita * 100 : 0;
  const diffAnual = Math.abs(primaryTotal - atualTotal);
  const diffMensal = diffAnual / 12;
  const diffPct = atualTotal > 0 ? diffAnual / atualTotal * 100 : 0;
  const isAumento = primaryTotal > atualTotal;
  const menorCarga = primaryTotal < atualTotal ? primaryTitle : atualTotal < primaryTotal ? "Lucro Presumido atual" : "Cargas equivalentes";

  const bars = [
    { label: "Lucro Presumido atual", total: atualTotal, aliquota: aliquotaAtual, tone: "bg-slate-500" },
    { label: primaryTitle, total: primaryTotal, aliquota: primaryAliquota, tone: primaryTotal < atualTotal ? "bg-emerald-500" : "bg-blue-500" },
  ];

  const baseIRPJ = n(atual.baseIRPJ) || receita * 0.32;
  const baseCSLL = n(atual.baseCSLL) || receita * 0.32;
  const irpjAdditional = calculateIrpjAdditional(baseIRPJ);
  const baseAdic = irpjAdditional.baseExcedente;
  const irpjAdic = n(atual.irpjAdic) || irpjAdditional.valor;
  const compras = n(cbs.creditos && typeof cbs.creditos === "object" ? (cbs.creditos as AnyRecord).compras : 0);
  const icmsPct = receita > compras ? n(atual.icms) / Math.max(receita - compras, 1) * 100 : 0;

  const conclusion = `O ${menorCarga} apresentou menor carga tributária para as premissas informadas.${n(beneficio.pctReducao) > 0 ? " A redução prevista pela LC 214/2025 depende do atendimento dos requisitos legais." : ""}`;
  const cbsAliq = n(primaryCbs.aliq);
  const ibsAliq = n(primaryIbs.aliq);
  const cbsAliqPadrao = n(primaryCbs.aliqPadrao) || cbsAliq;
  const ibsAliqPadrao = n(primaryIbs.aliqPadrao) || ibsAliq;
  const cbsAliqCompras = n(primaryCbs.aliqCompras) || cbsAliqPadrao;
  const ibsAliqCompras = n(primaryIbs.aliqCompras) || ibsAliqPadrao;
  const cbsReducao = n((primaryCbs.reducao as AnyRecord | undefined)?.pct) || n((premissas.cbsReducao as AnyRecord | undefined)?.pct) || (n(beneficio.pctReducao) > 0 ? n(beneficio.pctReducao) : 0);
  const hasReducao = cbsReducao > 0;
  const lpFederalRows = [
    ...(n(atual.ipi) > 0
      ? [{ label: "IPI", value: "" }, { label: "Base", value: `R$ ${fmt(receita)}` }, { label: "Alíquota", value: fmtPct(receita > 0 ? n(atual.ipi) / receita * 100 : 0) }, { label: "Débito", value: `R$ ${fmt(n(atual.ipi))}` }, { label: "Crédito", value: `R$ ${fmt(0)}` }, { label: "IPI Líquido", value: `R$ ${fmt(n(atual.ipi))}`, emphasis: true }]
      : []),
    ...(irpjAdic > 0 ? [{ label: "IRPJ Adicional", value: "" }, { label: "Receita/Base Presumida", value: `R$ ${fmt(baseIRPJ)}` }, { label: "Limite legal", value: `R$ ${fmt(60000)}` }, { label: "Base excedente", value: `R$ ${fmt(baseAdic)}` }, { label: "Alíquota 10%", value: fmtPct(10) }, { label: "Valor do adicional", value: `R$ ${fmt(irpjAdic)}`, emphasis: true }] : []),
  ];
  const lpCurrentDetails = [
    { title: "Bases presumidas majoradas", rows: [
      ...presumedBaseRows(atual.basePresumidaIRPJDetalhe as AnyRecord | undefined, "IRPJ", 15, n(atual.irpj15)),
      ...presumedBaseRows(atual.basePresumidaCSLLDetalhe as AnyRecord | undefined, "CSLL", 9, n(atual.csll)),
    ] },
    ...(n(atual.icms) > 0 ? [{ title: "Tributos Estaduais", rows: [{ label: "ICMS", value: "" }, { label: "Base", value: `R$ ${fmt(receita)}` }, { label: "Alíquota", value: fmtPct(icmsPct) }, { label: "Débito", value: `R$ ${fmt(n(atual.icms) + compras * icmsPct / 100)}` }, { label: "Crédito", value: `R$ ${fmt(compras * icmsPct / 100)}` }, { label: "ICMS Líquido", value: `R$ ${fmt(n(atual.icms))}`, emphasis: true }] }] : []),
    ...(lpFederalRows.length ? [{ title: "Tributos Federais", rows: lpFederalRows }] : []),
  ];
  const cbsRows = [...(hasReducao ? [{ label: "Alíquota Legal", value: fmtPct(cbsAliqPadrao) }, { label: "Redução Legal", value: fmtPct(cbsReducao) }, { label: "Alíquota Aplicada", value: fmtPct(cbsAliq) }] : []), { label: "Receita Tributável", value: `R$ ${fmt(receita)}` }, { label: `Débito (${fmtPct(cbsAliq)})`, value: `R$ ${fmt(n(primaryCbs.debito))}` }, { label: "Compras com Crédito", value: `R$ ${fmt(compras)}` }, { label: `Crédito (${fmtPct(cbsAliqCompras)})`, value: `R$ ${fmt(n(primaryCbs.credito))}` }, { label: "CBS Líquida", value: `R$ ${fmt(n(primaryCbs.liquida))}`, emphasis: true }];
  const ibsRows = [...(hasReducao ? [{ label: "Alíquota Legal", value: fmtPct(ibsAliqPadrao) }, { label: "Redução Legal", value: fmtPct(cbsReducao) }, { label: "Alíquota Aplicada", value: fmtPct(ibsAliq) }] : []), { label: "Receita Tributável", value: `R$ ${fmt(receita)}` }, { label: `Débito (${fmtPct(ibsAliq)})`, value: `R$ ${fmt(n(primaryIbs.debito))}` }, { label: "Compras com Crédito", value: `R$ ${fmt(compras)}` }, { label: `Crédito (${fmtPct(ibsAliqCompras)})`, value: `R$ ${fmt(n(primaryIbs.credito))}` }, { label: "IBS Líquido", value: `R$ ${fmt(n(primaryIbs.liquido))}`, emphasis: true }];
  const postIrpj = n(primaryScenario?.irpj15) || n(atual.irpj15);
  const postIrpjAdic = n(primaryScenario?.irpjAdic) || irpjAdic;
  const postCsll = n(primaryScenario?.csll) || n(atual.csll);
  const postIss = n(primaryScenario?.iss) || n(atual.iss);
  const postIcms = n(primaryScenario?.icms) || n(atual.icms);
  const postIpi = n(primaryScenario?.ipi);
  const postCbs = n(primaryScenario?.cbs) || n(primaryCbs.liquida);
  const postIbs = n(primaryScenario?.ibs) || n(primaryIbs.liquido);
  const postReformItems = buildTaxCompositionItems({ scenario: { ...primaryScenario, irpj15: postIrpj, irpjAdic: postIrpjAdic, csll: postCsll, iss: postIss, icms: postIcms, ipi: postIpi, cbs: postCbs, ibs: postIbs, baseAdic }, revenue: receita, baseIRPJ, baseCSLL, rates: { iss: issPct, icms: icmsPct, cbs: cbsAliq, ibs: ibsAliq } });

  return (
    <div className="space-y-6">
      <ResumoExecutivo
        card1={{ titulo: "Lucro Presumido atual", total: atualTotal, rotuloTotal: "Total anual estimado", corBorda: menorCarga === "Lucro Presumido atual" ? "border-emerald-200" : "border-blue-200", corFundo: menorCarga === "Lucro Presumido atual" ? "bg-emerald-50" : "bg-blue-50", corTitulo: menorCarga === "Lucro Presumido atual" ? "text-emerald-700" : "text-blue-700", corValor: menorCarga === "Lucro Presumido atual" ? "text-emerald-900" : "text-blue-900", icone: <Receipt className="w-5 h-5 text-blue-600" />, linhas: [{ label: "Média mensal", valor: "R$ " + fmt(atualTotal / 12) }, { label: "Alíquota efetiva", valor: fmtPct(aliquotaAtual), cor: "text-blue-700" }, { label: "ISS considerado", valor: fmtPct(issPct) }] }}
        card2={{ titulo: primaryTitle, total: primaryTotal, rotuloTotal: "Total anual estimado", corBorda: menorCarga === primaryTitle ? "border-emerald-200" : "border-blue-200", corFundo: menorCarga === primaryTitle ? "bg-emerald-50" : "bg-blue-50", corTitulo: menorCarga === primaryTitle ? "text-emerald-700" : "text-blue-700", corValor: menorCarga === primaryTitle ? "text-emerald-900" : "text-blue-900", icone: <TrendingUp className="w-5 h-5 text-blue-600" />, linhas: [{ label: "Média mensal", valor: "R$ " + fmt(primaryTotal / 12) }, { label: "Alíquota efetiva", valor: fmtPct(primaryAliquota), cor: "text-blue-700" }, { label: "CBS", valor: "R$ " + fmt(n(primaryScenario?.cbs)) }, { label: "IBS", valor: "R$ " + fmt(n(primaryScenario?.ibs)) }] }}
        cardImpacto={{ isAumento, valorAnual: diffAnual, rotulo: isAumento ? "Diferença anual" : "Economia anual", valorMensal: diffMensal, variacao: diffPct, flagMenorCarga: menorCarga }}
      />

      <PremisesSummary rows={[{ label: "Receita", value: `R$ ${fmt(receita)}` }, { label: "Compras", value: `R$ ${fmt(compras)}` }, { label: "CNAE", value: s(premissas.cnaeFormatado) }, { label: "Anexo", value: "Lucro Presumido" }, { label: "Município (ISS)", value: `${s(premissas.municipio)} (${fmtPct(issPct)})` }]} />

      {(n(beneficio.pctReducao) > 0 || beneficio.potencial === true) && <BenefitSummary beneficio={beneficio} />}

      <MemoryReforma
        description="Comparação da formação dos tributos."
        observation="Alíquota Efetiva representa a participação real de cada tributo sobre a receita bruta utilizada na simulação."
        cards={[
          {
            title: "Lucro Presumido atual",
            tone: "current",
            items: buildTaxCompositionItems({ scenario: { ...atual, irpjAdic, baseAdic }, revenue: receita, baseIRPJ, baseCSLL, rates: { iss: issPct, icms: icmsPct } }),
            total: atualTotal,
            effectiveRate: aliquotaAtual,
            details: lpCurrentDetails,
          },
          {
            title: primaryTitle,
            tone: "compared",
            items: postReformItems,
            total: primaryTotal,
            effectiveRate: primaryAliquota,
            details: [{ title: "Memória da CBS", rows: cbsRows }, { title: "Memória do IBS", rows: ibsRows }],
          },
        ]}
      />

      <Graph bars={bars} />

      <CardConclusao isAumento={isAumento} texto={conclusion} vencedor={menorCarga} impactoAnual={diffAnual} impactoPct={diffPct} />

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
        <label className="flex items-center gap-3 text-base cursor-pointer">
          <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="w-5 h-5 accent-green-600 shrink-0" />
          <span className="text-slate-700">{LEGAL_CHECKBOX_TEXT}</span>
        </label>
        <p className="border-t border-slate-200 pt-4 text-sm leading-relaxed text-slate-500">{LEGAL_FOOTER_TEXT}</p>
      </div>

      {pdfError && <div className="bg-red-50 border border-red-200 rounded-xl p-4"><p className="text-base text-red-600">{pdfError}</p></div>}

      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={onEdit} className="flex-1 bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-700 py-4 rounded-2xl text-base font-semibold transition-colors">Editar dados da simulação</button>
        {onGeneratePdf && <button onClick={handlePdf} type="button" disabled={pdfLoading || !confirmed} className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-2xl text-base font-semibold transition-colors">{pdfLoading ? "Gerando relatório..." : !confirmed ? "Confirme a leitura acima" : "Gerar relatório em PDF"}</button>}
      </div>
    </div>
  );
}
