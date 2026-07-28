"use client";

import { useState, useCallback } from "react";
import { Scale, Receipt, TrendingUp } from "lucide-react";
import {
  fmt, fmtPct,
  HeaderComparacao, CardConclusao, CardCBS, MemoriaCalculo, ResumoExecutivo
} from "./DashboardDS";

interface Props {
  results: Record<string, unknown> | null;
  onEdit: () => void;
  onGeneratePdf?: () => void;
  pdfLoading?: boolean;
  pdfError?: string | null;
}

export default function DashboardResultadosHibrido({
  results,
  onEdit,
  onGeneratePdf,
  pdfLoading,
  pdfError,
}: Props) {
  // Hooks first — unconditionally
  const [confirmed, setConfirmed] = useState(false);

  const handlePdf = useCallback(() => {
    if (!confirmed) return;
    if (onGeneratePdf) onGeneratePdf();
  }, [confirmed, onGeneratePdf]);

  // Early return for error/no-data AFTER hooks
  const r = results || {};

  if (r.error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-lg text-red-600 font-medium">Erro no c\u00E1lculo: {(r.error as string)}</p>
        <button onClick={onEdit}
          className="mt-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 px-6 rounded-xl font-semibold transition-colors">
          Editar dados
        </button>
      </div>
    );
  }

  const snTrad = (r.simplesTradicional || {}) as Record<string, unknown>;
  const hib = (r.simplesHibrido || {}) as Record<string, unknown>;
  const comp = (r.comparacaoFinanceira || {}) as Record<string, unknown>;
  const cbs = (r.CBS || {}) as Record<string, unknown>;
  const mem = (r.memoriaCalculo || {}) as Record<string, unknown>;
  const ano = typeof r.anoSimulacao === "string" ? r.anoSimulacao : "2027";

  const snTotal = typeof snTrad.total === "number" ? snTrad.total : 0;
  const hibTotal = typeof hib.total === "number" ? hib.total : 0;
  const isAumento = comp.tipo === "AUMENTO";

  if (!snTotal && !hibTotal) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-base text-slate-400">Nenhum resultado dispon\u00EDvel. Preencha os dados e gere o diagn\u00F3stico.</p>
      </div>
    );
  }

  const receita = typeof snTrad.rbt12 === "number" ? snTrad.rbt12 : 0;
  const aliqSn = typeof snTrad.aliquota === "number" ? snTrad.aliquota : 0;
  const aliqHib = receita > 0 ? (hibTotal / receita * 100) : 0;
  const impactoAnual = typeof comp.valorAnual === "number" ? comp.valorAnual : 0;
  const impactoMensal = typeof comp.valorMensal === "number" ? comp.valorMensal : 0;
  const impactoPct = typeof comp.percentual === "number" ? comp.percentual : 0;

  const conclusao = r.conclusao as Record<string, unknown> | undefined;

  return (
    <div className="space-y-6">

      <HeaderComparacao
        titulo={`Compara\u00E7\u00E3o: Simples Tradicional \u00D7 Simples H\u00EDbrido (${ano})`}
        descricao="No Simples H\u00EDbrido, a CBS deixa de ser recolhida dentro do DAS e passa a ser apurada pelo regime regular. O DAS \u00E9 reduzido pela parcela correspondente da CBS e, posteriormente, \u00E9 adicionada a CBS l\u00EDquida apurada fora do DAS."
        icone={<Scale className="w-7 h-7 text-blue-300 mt-0.5 shrink-0" />}
      />

      <ResumoExecutivo
        card1={{
          titulo: "Simples Tradicional",
          total: snTotal,
          rotuloTotal: "Total anual estimado",
          corBorda: "border-slate-200",
          corFundo: "bg-slate-50",
          corTitulo: "text-slate-700",
          corValor: "text-slate-900",
          icone: <Receipt className="w-5 h-5 text-blue-600" />,
          linhas: [
            { label: "Total mensal", valor: "R$ " + fmt(snTotal / 12) },
            { label: "Al\u00EDquota efetiva", valor: fmtPct(aliqSn), cor: "text-blue-700" },
          ]
        }}
        card2={{
          titulo: "Simples H\u00EDbrido",
          total: hibTotal,
          rotuloTotal: "Total anual estimado",
          corBorda: "border-amber-200",
          corFundo: "bg-amber-50",
          corTitulo: "text-amber-800",
          corValor: "text-amber-900",
          icone: <TrendingUp className="w-5 h-5 text-amber-600" />,
          linhas: [
            { label: "Total mensal", valor: "R$ " + fmt(hibTotal / 12) },
            { label: "Al\u00EDquota efetiva", valor: fmtPct(aliqHib), cor: "text-amber-800" },
          ]
        }}
        cardImpacto={{
          isAumento: isAumento,
          valorAnual: impactoAnual,
          rotulo: isAumento ? "Aumento anual" : "Economia anual",
          valorMensal: impactoMensal,
          variacao: impactoPct,
          flagMenorCarga: conclusao?.vencedor as string | undefined,
        }}
      />

      <CardCBS cbs={cbs as Record<string, number>} />

      {typeof mem.das !== "undefined" && (
        <MemoriaCalculo
          etapas={[
            { label: "DAS integral", valor: "R$ " + fmt(typeof hib.dasIntegral === "number" ? hib.dasIntegral : 0) },
            { label: "(\u2013) CBS retirada do DAS", valor: "\u2013R$ " + fmt(typeof hib.parcelaCbsRetiradaDoDas === "number" ? hib.parcelaCbsRetiradaDoDas : 0), cor: "bg-amber-50 border-amber-200" },
            { label: "DAS ajustado", valor: "R$ " + fmt(typeof hib.dasReduzido === "number" ? hib.dasReduzido : 0), cor: "bg-slate-100 border-slate-300" },
            { operador: "+" },
            { label: "CBS l\u00EDquida", valor: "R$ " + fmt(typeof cbs.liquida === "number" ? cbs.liquida : 0), cor: "bg-cyan-50 border-cyan-200" },
            { label: "Total Simples H\u00EDbrido", valor: "R$ " + fmt(hibTotal), cor: "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300 font-bold" },
          ]}
        />
      )}

      {!!conclusao?.texto && (
        <CardConclusao
          isAumento={isAumento}
          texto={conclusao.texto as string}
          vencedor={conclusao.vencedor as string}
          impactoAnual={impactoAnual}
          impactoPct={impactoPct}
        />
      )}

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <label className="flex items-center gap-3 text-base cursor-pointer">
          <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
            className="w-5 h-5 accent-green-600 shrink-0" />
          <span className="text-slate-700">Confirmei as premissas e os resultados apresentados.</span>
        </label>
      </div>

      {pdfError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-base text-red-600">{pdfError}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={onEdit}
          className="flex-1 bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-700 py-4 rounded-2xl text-base font-semibold transition-colors">
          Editar dados da simula\u00E7\u00E3o
        </button>
        {onGeneratePdf && (
          <button onClick={handlePdf} type="button" disabled={pdfLoading || !confirmed}
            className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-2xl text-base font-semibold transition-colors">
            {pdfLoading ? "Gerando relat\u00F3rio..." : !confirmed ? "Confirme as premissas acima" : "Gerar relat\u00F3rio em PDF"}
          </button>
        )}
      </div>
    </div>
  );
}
