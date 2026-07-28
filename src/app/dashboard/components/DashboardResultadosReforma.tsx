"use client";

import { useState, useCallback } from "react";
import { Scale, Receipt, TrendingUp } from "lucide-react";
import {
  fmt, fmtPct,
  HeaderComparacao, ResumoExecutivo
} from "./DashboardDS";

interface Props {
  results: Record<string, unknown> | null;
  onEdit: () => void;
  onGeneratePdf?: () => void;
  pdfLoading?: boolean;
  pdfError?: string | null;
}

export default function DashboardResultadosReforma({
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

  const atual = (r.lucroPresumidoAtual || {}) as Record<string, unknown>;
  const futuro = (r.cenarioFuturo || {}) as Record<string, unknown>;
  const comp = (r.comparacaoFinanceira || {}) as Record<string, unknown>;
  const mem = (r.memoriaCalculo || {}) as Record<string, unknown>;

  const atualTotal = typeof atual.total === "number" ? atual.total : 0;
  const futuroTotal = typeof futuro.total === "number" ? futuro.total : 0;
  const isAumento = comp.tipo === "AUMENTO";

  if (!atualTotal && !futuroTotal) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-base text-slate-400">Nenhum resultado dispon\u00EDvel. Preencha os dados e gere o diagn\u00F3stico.</p>
      </div>
    );
  }

  const receita = typeof atual.rbt12 === "number" ? atual.rbt12 : 0;
  const aliqAtual = receita > 0 ? (atualTotal / receita * 100) : 0;
  const aliqFuturo = receita > 0 ? (futuroTotal / receita * 100) : 0;
  const impactoAnual = typeof comp.valorAnual === "number" ? comp.valorAnual : 0;
  const impactoMensal = typeof comp.valorMensal === "number" ? comp.valorMensal : 0;
  const impactoPct = typeof comp.percentual === "number" ? comp.percentual : 0;

  const previsaoSem = typeof mem.previsaoSem === "object" && mem.previsaoSem !== null
    ? (mem.previsaoSem as Record<string, unknown>) : null;
  const previsaoCom = typeof mem.previsaoCom === "object" && mem.previsaoCom !== null
    ? (mem.previsaoCom as Record<string, unknown>) : null;

  const economiaLabel = isAumento ? "Aumento anual" : "Economia anual";
  const vencedor = !isAumento ? "Cen\u00E1rio Atual" : "Cen\u00E1rio Futuro";

  return (
    <div className="space-y-6">

      <HeaderComparacao
        titulo="Compara\u00E7\u00E3o\u00A0Tribut\u00E1ria\u00A0com\u00A0a\u00A0Reforma"
        descricao="An\u00E1lise comparativa entre o sistema tribut\u00E1rio atual (Lucro Presumido) e o cen\u00E1rio futuro ap\u00F3s a implementa\u00E7\u00E3o da Reforma Tribut\u00E1ria, considerando as altera\u00E7\u00F5es na CBS e IBS."
        icone={<Scale className="w-7 h-7 text-blue-300 mt-0.5 shrink-0" />}
      />

      <ResumoExecutivo
        card1={{
          titulo: "Cen\u00E1rio Atual (LP)",
          total: atualTotal,
          rotuloTotal: "Total anual estimado",
          corBorda: "border-slate-200",
          corFundo: "bg-slate-50",
          corTitulo: "text-slate-700",
          corValor: "text-slate-900",
          icone: <Receipt className="w-5 h-5 text-blue-600" />,
          linhas: [
            { label: "Total mensal", valor: "R$ " + fmt(atualTotal / 12) },
            { label: "Al\u00EDquota efetiva", valor: fmtPct(aliqAtual), cor: "text-blue-700" },
          ]
        }}
        card2={{
          titulo: "Cen\u00E1rio Futuro (P\u00F3s-Reforma)",
          total: futuroTotal,
          rotuloTotal: "Total anual estimado",
          corBorda: "border-amber-200",
          corFundo: "bg-amber-50",
          corTitulo: "text-amber-800",
          corValor: "text-amber-900",
          icone: <TrendingUp className="w-5 h-5 text-amber-600" />,
          linhas: [
            { label: "Total mensal", valor: "R$ " + fmt(futuroTotal / 12) },
            { label: "Al\u00EDquota efetiva", valor: fmtPct(aliqFuturo), cor: "text-amber-800" },
          ]
        }}
        cardImpacto={{
          isAumento: isAumento,
          valorAnual: impactoAnual,
          rotulo: economiaLabel,
          valorMensal: impactoMensal,
          variacao: impactoPct,
          flagMenorCarga: vencedor,
        }}
      />

      {previsaoSem && previsaoCom && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-slate-700 mb-3">Mem\u00F3ria de C\u00E1lculo</h3>
          <div className="space-y-2 text-base">
            <div className="flex justify-between"><span className="text-slate-400">Situa\u00E7\u00E3o Atual</span><span className="font-semibold text-slate-800">R$ {fmt(typeof previsaoSem.total === "number" ? previsaoSem.total : 0)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Ap\u00F3s Reforma</span><span className="font-semibold text-slate-800">R$ {fmt(typeof previsaoCom.total === "number" ? previsaoCom.total : 0)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="text-slate-400">Diferen\u00E7a</span>
              <span className={`font-bold ${isAumento ? "text-amber-600" : "text-green-600"}`}>
                {isAumento ? "+" : "\u2013"}R$ {fmt(impactoAnual)}
              </span>
            </div>
          </div>
        </div>
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
