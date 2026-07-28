"use client";

import { useState, useCallback } from "react";
import { Scale, Receipt, TrendingUp, CheckCircle2, AlertCircle } from "lucide-react";
import DashboardResultadosHibrido from "./DashboardResultadosHibrido";
import DashboardResultadosReforma from "./DashboardResultadosReforma";
import {
  fmt, fmtPct,
  HeaderComparacao, CardConclusao, ResumoExecutivo, MoneyValue
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
    if (!engineReady) { setPdfLocalError("Motor de c\u00E1lculo n\u00E3o est\u00E1 pronto."); return; }
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
      if (!isFinite(snTotal) || isNaN(snTotal)) return <div className="bg-red-50 border border-red-200 rounded-xl p-4"><p className="text-base text-red-600">Total do Simples Nacional inv\u00E1lido</p><button onClick={onEdit} className="mt-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 px-6 rounded-xl font-semibold">Editar dados</button></div>;
      if (!isFinite(lpTotal) || isNaN(lpTotal)) return <div className="bg-red-50 border border-red-200 rounded-xl p-4"><p className="text-base text-red-600">Total do Lucro Presumido inv\u00E1lido</p><button onClick={onEdit} className="mt-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 px-6 rounded-xl font-semibold">Editar dados</button></div>;
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
    const rbt12 = rbtStr ? parseFloat(rbtStr.replace(/\./g, "").replace(",", ".")) || 0 : 0;

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

    let justification = "";
    if (winner && rbt12 > 0) {
      if (snBlocked && !hipotetica) {
        justification = `O Lucro Presumido \u00E9 o regime aplic\u00E1vel: a empresa n\u00E3o \u00E9 eleg\u00EDvel ao Simples Nacional. Carga efetiva estimada de ${fmtPct(lpAliquotaEfetiva)}.`;
      } else if (winner === "Simples Nacional") {
        justification = `O Simples Nacional apresentou menor carga estimada porque sua al\u00EDquota efetiva de ${fmtPct(snAliquotaEfetiva)} ficou abaixo da carga consolidada de ${fmtPct(lpAliquotaEfetiva)} apurada no Lucro Presumido.`;
        if (typeof sn.anexo === "string" && sn.anexo) justification += ` Anexo: ${sn.anexo}.`;
        if (typeof sn.fatorR === "string" && sn.fatorR && sn.fatorR !== "\u2014") justification += ` Fator R: ${sn.fatorR}.`;
        justification += ` Diferen\u00E7a anual: R$ ${fmt(economia)} (${fmtPct(diffPct * 100)}).`;
      } else {
        justification = `O Lucro Presumido apresentou menor carga estimada com al\u00EDquota efetiva de ${fmtPct(lpAliquotaEfetiva)} contra ${fmtPct(snAliquotaEfetiva)} do Simples Nacional.`;
        justification += ` Diferen\u00E7a anual: R$ ${fmt(economia)} (${fmtPct(diffPct * 100)}).`;
      }
    }

    const statusCalculo = typeof r.statusCalculo === "string" ? r.statusCalculo : "VALIDO";
    const dadosInsuficientes = statusCalculo === "DADOS_INSUFICIENTES";
    const showCards = (snTotal > 0 || lpTotal > 0) && !dadosInsuficientes;
    const showWinner = showCards && (!snBlocked || hipotetica);
    const isAumentoSN = winner === "Lucro Presumido";

    return (
      <div className="space-y-6">

        <HeaderComparacao
          titulo="Compara\u00E7\u00E3o: Simples Nacional \u00D7 Lucro Presumido"
          descricao="An\u00E1lise comparativa entre os regimes tribut\u00E1rios do Simples Nacional e do Lucro Presumido, considerando a carga tribut\u00E1ria total de cada regime com base nas premissas informadas."
          icone={<Scale className="w-7 h-7 text-blue-300 mt-0.5 shrink-0" />}
        />

        {!!r.cnaeAviso && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-base text-amber-700">A empresa possui CNAEs de naturezas distintas. Confirme o tipo de atividade utilizado na simula\u00E7\u00E3o.</p>
          </div>
        )}

        {showCards && (
          <ResumoExecutivo
            card1={{
              titulo: temSublimite ? snLabel : "Simples Nacional",
              total: snBlocked && !hipotetica ? 0 : snTotal,
              rotuloTotal: snBlocked && !hipotetica ? "N\u00E3o Eleg\u00EDvel" : "Total anual estimado",
              corBorda: snBlocked ? "border-red-200" : "border-emerald-200",
              corFundo: snBlocked && !hipotetica ? "bg-red-50" : "bg-emerald-50",
              corTitulo: snBlocked && !hipotetica ? "text-red-700" : "text-emerald-700",
              corValor: snBlocked && !hipotetica ? "text-red-500" : "text-emerald-900",
              icone: <Receipt className="w-5 h-5 text-blue-600" />,
              linhas: snBlocked && !hipotetica
                ? [{ label: "Status", valor: "N\u00E3o Eleg\u00EDvel", cor: "text-red-600" }]
                : [
                  { label: "M\u00E9dia mensal", valor: "R$ " + fmt(typeof sn.media === "number" ? sn.media : snTotal / 12) },
                  { label: "Al\u00EDquota efetiva", valor: fmtPct(snAliquotaEfetiva), cor: "text-emerald-700" },
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
                { label: "M\u00E9dia mensal", valor: "R$ " + fmt(typeof lp.media === "number" ? lp.media : lpTotal / 12) },
                { label: "Al\u00EDquota efetiva", valor: fmtPct(lpAliquotaEfetiva), cor: "text-blue-700" },
              ]
            }}
            cardImpacto={{
              isAumento: isAumentoSN,
              valorAnual: economia,
              rotulo: isAumentoSN ? "Aumento no SN" : "Economia no SN",
              valorMensal: economiaMensal,
              variacao: diffPct * 100,
              flagMenorCarga: winner || "\u2014",
            }}
          />
        )}

        {snBlocked && showCards && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={hipotetica} onChange={e => setHipotetica(e.target.checked)}
                className="w-5 h-5 accent-amber-500 shrink-0" />
              <div>
                <span className="text-base font-semibold text-amber-800">Simula\u00E7\u00E3o Hipot\u00E9tica</span>
                <p className="text-sm text-amber-600">Calcular como se a empresa fosse eleg\u00EDvel ao Simples Nacional</p>
              </div>
            </label>
          </div>
        )}

        {showWinner && justification && (
          <CardConclusao isAumento={isAumentoSN} texto={justification} vencedor={winner || "\u2014"} impactoAnual={economia} impactoPct={diffPct * 100} />
        )}

        {dadosInsuficientes && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-amber-800">Situa\u00E7\u00E3o do Sublimite Pendente</h3>
                <p className="text-base text-amber-700 mt-2 leading-relaxed">{(rec.reason as string) || (sublimite.justificativaLegal as string) || "N\u00E3o foi poss\u00EDvel concluir a compara\u00E7\u00E3o porque a data de in\u00EDcio dos efeitos do sublimite n\u00E3o foi determinada."}</p>
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
            <p className="text-lg font-semibold text-slate-700">Confer\u00EAncia da Simula\u00E7\u00E3o</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-base mb-4">
            <div><span className="text-slate-400">Receita:</span> <MoneyValue value={rbt12} size="sm" /></div>
            <div><span className="text-slate-400">Atividade:</span> <strong>{tipoAtivLP || "\u2014"}</strong></div>
            <div><span className="text-slate-400">Total SN:</span> <MoneyValue value={snTotal} size="sm" /></div>
            <div><span className="text-slate-400">Total LP:</span> <MoneyValue value={lpTotal} size="sm" /></div>
            <div className="sm:col-span-2"><span className="text-slate-400">Regime com menor carga:</span> <strong>{winner || "\u2014"}</strong></div>
          </div>
          <label className="flex items-center gap-3 text-base cursor-pointer">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
              className="w-5 h-5 accent-green-600 shrink-0" />
            <span className="text-slate-700">Confirmei as premissas e os resultados apresentados.</span>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={onEdit} type="button"
            className="flex-1 bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-700 py-4 rounded-2xl text-base font-semibold transition-colors">
            Editar dados da simula\u00E7\u00E3o
          </button>
          <button onClick={handlePdf} type="button" disabled={pdfLoading || !confirmed}
            className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-2xl text-base font-semibold transition-colors">
            {pdfLoading ? "Gerando relat\u00F3rio..." : !confirmed ? "Confirme as premissas acima" : "Gerar relat\u00F3rio em PDF"}
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
