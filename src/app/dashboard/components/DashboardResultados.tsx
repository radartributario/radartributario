"use client";

import { useState, useCallback } from "react";
import { Scale, Receipt, TrendingUp, CheckCircle2, AlertCircle, FileText } from "lucide-react";
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
    const issPctForm = parseFloat((formData?.aliquotaISS || "2.5").replace(",", ".")) || 2.5;
    const comprasVal = parseFloat((formData?.comprasInput || "0").replace(/\./g, "").replace(",", ".")) || 0;

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

        <HeaderComparacao
          titulo="Comparação: Simples Nacional × Lucro Presumido"
          descricao="Análise comparativa entre os regimes tributários do Simples Nacional e do Lucro Presumido, considerando a carga tributária total de cada regime com base nas premissas informadas."
          icone={<Scale className="w-7 h-7 text-blue-300 mt-0.5 shrink-0" />}
        />

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

        {showWinner && justification && (
          <CardConclusao isAumento={isAumentoSN} texto={justification} vencedor={winner || "—"} impactoAnual={economia} impactoPct={diffPct * 100} />
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

        {showCards && !snBlocked && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-6 h-6 text-slate-600 shrink-0" />
              <h2 className="text-xl font-bold text-slate-800">Detalhamento Lucro Presumido</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 pr-4 font-semibold text-slate-500">Tributo</th>
                    <th className="text-right py-2 px-4 font-semibold text-slate-500">Base de Cálculo</th>
                    <th className="text-right py-2 px-4 font-semibold text-slate-500">% Presunção</th>
                    <th className="text-right py-2 px-4 font-semibold text-slate-500">Alíquota Legal</th>
                    <th className="text-right py-2 px-4 font-semibold text-slate-500">Alíquota Efetiva</th>
                    <th className="text-right py-2 px-4 font-semibold text-slate-500">Valor Anual</th>
                    <th className="text-right py-2 pl-4 font-semibold text-slate-500">Valor Mensal</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const presIRPJ = (lp.presIRPJ as number) || 0;
                    const presCSLL = (lp.presCSLL as number) || 0;
                    const baseIRPJ = rbt12 * presIRPJ / 100;
                    const baseAdicIRPJ = Math.max(0, baseIRPJ - 240000);
                    const baseCSLL = rbt12 * presCSLL / 100;
                    const irpjAnual = (lp.irpj15 as number) || 0;
                    const irpjAdicAnual = (lp.irpjAdic as number) || 0;
                    const csllAnual = (lp.csll as number) || 0;
                    const pisCofinsAnual = (lp.pisCofins as number) || 0;
                    const issAnual = (lp.iss as number) || 0;
                    const icmsAnual = (lp.icms as number) || 0;
                    const rows: { tributo: string; base: number; pres: string; legal: string; efetiva: string; anual: number }[] = [
                      { tributo: "IRPJ (15%)", base: baseIRPJ, pres: presIRPJ.toFixed(0) + "%", legal: "15%", efetiva: fmtPct(rbt12 > 0 ? irpjAnual / rbt12 * 100 : 0), anual: irpjAnual },
                      { tributo: "IRPJ Adicional (10%)", base: baseAdicIRPJ, pres: presIRPJ.toFixed(0) + "%", legal: "10%", efetiva: fmtPct(rbt12 > 0 ? irpjAdicAnual / rbt12 * 100 : 0), anual: irpjAdicAnual },
                      { tributo: "CSLL", base: baseCSLL, pres: presCSLL.toFixed(0) + "%", legal: "9%", efetiva: fmtPct(rbt12 > 0 ? csllAnual / rbt12 * 100 : 0), anual: csllAnual },
                      { tributo: "PIS", base: rbt12, pres: "—", legal: "0,65%", efetiva: fmtPct(rbt12 > 0 ? (pisCofinsAnual * 0.65 / 3.65) / rbt12 * 100 : 0), anual: pisCofinsAnual * 0.65 / 3.65 },
                      { tributo: "COFINS", base: rbt12, pres: "—", legal: "3,00%", efetiva: fmtPct(rbt12 > 0 ? (pisCofinsAnual * 3 / 3.65) / rbt12 * 100 : 0), anual: pisCofinsAnual * 3 / 3.65 },
                      { tributo: "ISS", base: rbt12, pres: "—", legal: issPctForm.toFixed(2).replace(".", ",") + "%", efetiva: fmtPct(rbt12 > 0 ? issAnual / rbt12 * 100 : 0), anual: issAnual },
                      { tributo: "ICMS", base: rbt12, pres: "—", legal: "—", efetiva: fmtPct(rbt12 > 0 ? icmsAnual / rbt12 * 100 : 0), anual: icmsAnual },
                    ];
                    if ((lp.encargos as number) > 0) {
                      const encAnual = (lp.encargos as number) || 0;
                      rows.push({ tributo: "Encargos s/ folha", base: 0, pres: "—", legal: "—", efetiva: fmtPct(rbt12 > 0 ? encAnual / rbt12 * 100 : 0), anual: encAnual });
                    }
                    return rows.map((row, i) => (
                      <tr key={i} className={i < rows.length - 1 ? "border-b border-slate-100" : ""}>
                        <td className="py-2 pr-4 text-slate-700">{row.tributo}</td>
                        <td className="text-right py-2 px-4 text-slate-600 font-mono">{row.base > 0 ? "R$ " + fmt(row.base) : "—"}</td>
                        <td className="text-right py-2 px-4 text-slate-600">{row.pres}</td>
                        <td className="text-right py-2 px-4 text-slate-600">{row.legal}</td>
                        <td className="text-right py-2 px-4 text-blue-700 font-semibold">{row.efetiva}</td>
                        <td className="text-right py-2 px-4 text-slate-800 font-semibold font-mono">R$ {fmt(row.anual)}</td>
                        <td className="text-right py-2 pl-4 text-slate-600 font-mono">R$ {fmt(row.anual / 12)}</td>
                      </tr>
                    ));
                  })()}
                  <tr className="border-t-2 border-slate-300 font-bold">
                    <td className="py-2 pr-4 text-slate-800">Total LP</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td className="text-right py-2 px-4 text-blue-700">{fmtPct(lpAliquotaEfetiva)}</td>
                    <td className="text-right py-2 px-4 text-slate-900 font-mono">R$ {fmt(lpTotal)}</td>
                    <td className="text-right py-2 pl-4 text-slate-700 font-mono">R$ {fmt(lpTotal / 12)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200 space-y-1 text-sm text-slate-500">
              <p>ISS: alíquota de <strong>{issPctForm.toFixed(1).replace(".", ",")}%</strong> informada no formulário. Base: receita bruta total (R$ {fmt(rbt12)}).</p>
              {comprasVal > 0 && (
                <p>Compras informadas: <strong>R$ {fmt(comprasVal)}</strong>. Neste cenário de prestação de serviços, esse valor não reduziu o DAS do Simples Nacional nem gerou créditos de PIS/Cofins no Lucro Presumido, que apura esses tributos pelo regime cumulativo (sem direito a crédito).</p>
              )}
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
          <label className="flex items-center gap-3 text-base cursor-pointer">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
              className="w-5 h-5 accent-green-600 shrink-0" />
            <span className="text-slate-700">Confirmei as premissas e os resultados apresentados.</span>
          </label>
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
