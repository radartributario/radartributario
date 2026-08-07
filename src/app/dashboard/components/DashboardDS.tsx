"use client";

import { formatCurrencyBRL } from "./CurrencyInput";
import {
  TrendingUp, TrendingDown, Scale, FileText, Receipt, ShoppingCart,
  DollarSign, BarChart3, AlertCircle, CheckCircle2, ArrowDown
} from "lucide-react";

// ===== HELPERS =====

export function fmt(v: number): string {
  return formatCurrencyBRL(v);
}

export function fmtPct(v: number): string {
  if (!isFinite(v) || v == null) return "—";
  return v.toFixed(2).replace(".", ",") + "%";
}

export function fmtBaseLegal(b: BaseLegalInfo | null | undefined): string {
  if (!b) return "";
  let t = b.baseLegal || "";
  t = t.replace(/,/g, " –");
  if (!t.includes("art.") && b.artigo) {
    let art = "art. " + b.artigo;
    if (b.inciso) art += ", inciso " + b.inciso;
    if (b.paragrafo) art += ", " + b.paragrafo;
    t += " – " + art;
  }
  return t;
}

// ===== MONEY VALUE — componente único para valores financeiros =====

interface MoneyValueProps {
  value: number;
  size?: "sm" | "md" | "lg" | "xl" | "xxl";
  className?: string;
  color?: string;
}

const moneyFormat = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const sizeClasses: Record<string, string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-[clamp(1.1rem,1.5vw,1.45rem)]",
  xl: "text-[clamp(1.35rem,1.75vw,1.9rem)]",
  xxl: "text-[clamp(1.55rem,2.1vw,2.25rem)]",
};

export function MoneyValue({ value, size = "xl", className = "", color = "text-slate-900" }: MoneyValueProps) {
  return (
    <span
      className={`inline-block whitespace-nowrap overflow-visible shrink-0 font-bold leading-tight ${sizeClasses[size]} ${color} ${className}`}
      style={{ textOverflow: "clip", minWidth: 0 }}
    >
      {moneyFormat.format(value)}
    </span>
  );
}

// ===== ValorMonetario (backward compat) =====

interface VMProps { v: number; className?: string }
export function ValorMonetario({ v, className = "" }: VMProps) {
  const color = className.match(/text-\S+/)?.[0] || "text-slate-900";
  const size = className.includes("text-4xl") ? "xl" :
    className.includes("text-3xl") ? "lg" :
    className.includes("text-2xl") ? "md" :
    className.includes("text-lg") || className.includes("text-xl") ? "md" : "xl";
  return <MoneyValue value={v} size={size} className={className} color={color} />;
}

// ===== DETAIL ROW =====

interface DetailRowProps {
  label: string;
  value: number;
  color?: string;
  format?: "currency" | "percent" | "text";
  valueText?: string;
}
export function DetailRow({ label, value, color, format = "currency", valueText }: DetailRowProps) {
  return (
    <div className="flex justify-between items-baseline gap-4 py-1.5">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className={`font-semibold text-right whitespace-nowrap ${color || "text-slate-800"}`}>
        {format === "currency" ? <MoneyValue value={value} size="sm" /> :
         format === "percent" ? fmtPct(value) :
         valueText || String(value)}
      </span>
    </div>
  );
}

// ===== ROW (text-based, for legacy compat) =====

interface RowProps { label: string; value: string; color?: string }
export function Row({ label, value, color }: RowProps) {
  return (
    <div className="flex justify-between items-baseline gap-4 py-1.5">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className={`font-semibold text-right whitespace-nowrap ${color || "text-slate-800"}`}>{value}</span>
    </div>
  );
}

// ===== HEADER =====

interface HeaderProps {
  titulo: string;
  descricao: string;
  icone?: React.ReactNode;
}
export function HeaderComparacao({ titulo, descricao, icone }: HeaderProps) {
  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl px-8 py-7 text-white shadow-lg">
      <div className="flex items-start gap-4">
        {icone || <Scale className="w-7 h-7 text-blue-300 mt-0.5 shrink-0" />}
        <div className="min-w-0 flex-1">
          <h1 className="text-[clamp(1.5rem,2.2vw,2rem)] font-bold tracking-tight">{titulo}</h1>
          <p className="text-blue-200/80 text-base mt-1.5 leading-relaxed max-w-4xl">{descricao}</p>
        </div>
      </div>
    </div>
  );
}

// ===== BENEFIT CARD =====

interface BenefitCardProps {
  status?: "APLICADO" | "PENDENTE" | "NAO_APLICADO" | "NAO_ELEGIVEL" | string;
  percentual?: number;
  baseLegal?: string;
  atividade?: string;
  cnae?: string;
  beneficio?: string;
  explanation?: string;
}

export function BenefitCard({ status, percentual = 0, baseLegal, atividade, cnae, beneficio, explanation }: BenefitCardProps) {
  const isConfirmed = status === "APLICADO";
  const isPending = status === "PENDENTE";
  const isDenied = status === "NAO_APLICADO";
  const statusText = isConfirmed ? "Confirmado" : isPending ? "Pendente" : isDenied ? "Negado" : "Nao elegivel";
  const situation = isConfirmed ? "Benefício identificado" : isPending ? "Benefício pendente de confirmação" : "Empresa sem benefício específico";
  const tone = isConfirmed ? "emerald" : isPending ? "blue" : isDenied ? "amber" : "slate";
  const wrapper = tone === "emerald"
    ? "bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-300"
    : tone === "blue"
    ? "bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-300"
    : tone === "amber"
    ? "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300"
    : "bg-gradient-to-br from-slate-50 to-white border-slate-300";
  const iconBg = tone === "emerald" ? "bg-emerald-600" : tone === "blue" ? "bg-blue-700" : tone === "amber" ? "bg-amber-600" : "bg-slate-600";
  const Icon = isConfirmed ? CheckCircle2 : isPending ? AlertCircle : Scale;

  return (
    <section className={`rounded-2xl border-2 p-6 shadow-sm ${wrapper}`} aria-labelledby="beneficio-reforma-title" data-testid="benefit-card">
      <div className="flex flex-col lg:flex-row gap-5 lg:items-start lg:justify-between">
        <div className="flex items-start gap-4 min-w-0">
          <div className={`w-12 h-12 rounded-2xl ${iconBg} flex items-center justify-center shrink-0`}>
            <Icon className="w-6 h-6 text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.16em] uppercase text-slate-500">Benefício da Reforma Tributária</p>
            <h2 id="beneficio-reforma-title" className="text-2xl font-extrabold text-slate-900 mt-1">{situation}</h2>
            <p className="text-base text-slate-700 mt-2">{explanation || "A avaliação considera o CNAE, a atividade e as respostas sobre os requisitos legais informados pelo usuário."}</p>
          </div>
        </div>
        <div className="rounded-xl bg-white/80 border border-white p-4 min-w-[220px]">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Status</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{statusText}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <div className="rounded-xl bg-white/80 border border-white p-4"><p className="text-xs font-bold text-slate-500 uppercase">Atividade</p><p className="font-semibold text-slate-900 mt-1">{atividade || "-"}</p></div>
        <div className="rounded-xl bg-white/80 border border-white p-4"><p className="text-xs font-bold text-slate-500 uppercase">CNAE</p><p className="font-semibold text-slate-900 mt-1">{cnae || "-"}</p></div>
        <div className="rounded-xl bg-white/80 border border-white p-4"><p className="text-xs font-bold text-slate-500 uppercase">Benefício previsto</p><p className="font-semibold text-slate-900 mt-1">{beneficio || (percentual > 0 ? `Redução legal de ${percentual.toFixed(0)}%` : "Sem redução específica")}</p><p className="text-xs text-slate-600 mt-1">{percentual > 0 ? `${percentual.toFixed(0)}% nas alíquotas da CBS e do IBS` : "Sem benefício específico identificado"}</p></div>
        <div className="rounded-xl bg-white/80 border border-white p-4"><p className="text-xs font-bold text-slate-500 uppercase">Base legal</p><p className="font-semibold text-slate-900 mt-1">{baseLegal || "-"}</p></div>
      </div>
      {percentual > 0 && (
        <div className="mt-4 rounded-xl bg-white/70 border border-white p-4 text-sm text-slate-700">
          <strong>Redução legal:</strong> aplicada exclusivamente às alíquotas de CBS e IBS. Não reduz IRPJ, CSLL, ISS nem reduz a carga tributária total nessa mesma proporção.
        </div>
      )}
    </section>
  );
}

// ===== CARD DE RESUMO (individual) =====

interface CardResumoProps {
  titulo: string;
  total: number;
  rotuloTotal: string;
  linhas: { label: string; valor: string; cor?: string }[];
  corBorda: string;
  corFundo: string;
  corTitulo: string;
  corValor: string;
  icone?: React.ReactNode;
}
export function CardResumo({ titulo, total, rotuloTotal, linhas, corBorda, corFundo, corTitulo, corValor, icone }: CardResumoProps) {
  const corLabel = corValor.replace("900","600").replace("800","500").replace("700","500");
  return (
    <div className={`${corFundo} rounded-xl p-6 border ${corBorda} flex flex-col h-full`}>
      <div className="flex items-center gap-2 mb-3">
        {icone}
        <h3 className={`text-lg font-bold ${corTitulo}`}>{titulo}</h3>
      </div>
      <MoneyValue value={total} size="xl" color={corValor} />
      <p className={`text-base mt-0.5 mb-4 ${corLabel}`}>{rotuloTotal}</p>
      <div className="space-y-1">
        {linhas.map((l, i) => (
          <div key={i} className="flex justify-between items-baseline gap-4">
            <span className={corLabel}>{l.label}</span>
            <span className={`font-semibold text-right whitespace-nowrap ${l.cor || corValor}`}>{l.valor}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== RESUMO EXECUTIVO =====

interface CardImpactoProps {
  isAumento: boolean;
  isEmpate?: boolean;
  valorAnual: number;
  rotulo: string;
  valorMensal: number;
  variacao: number;
  flagMenorCarga?: string;
  titulo?: string;
}

interface ResumoExecutivoProps {
  card1: CardResumoProps;
  card2: CardResumoProps;
  cardImpacto: CardImpactoProps;
  titulo?: string;
}
export function ResumoExecutivo({ card1, card2, cardImpacto, titulo = "Resultado Executivo" }: ResumoExecutivoProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-6 h-6 text-blue-600 shrink-0" />
        <h2 className="text-xl font-bold text-slate-800">{titulo}</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <CardResumo {...card1} />
        <CardResumo {...card2} />
        <CardImpacto {...cardImpacto} />
      </div>
    </div>
  );
}

// ===== CARD DE IMPACTO =====

export function CardImpacto({ isAumento, isEmpate = false, valorAnual, rotulo, valorMensal, variacao, flagMenorCarga, titulo }: CardImpactoProps) {
  const corBg = isEmpate ? "bg-slate-50" : isAumento ? "bg-red-50" : "bg-emerald-50";
  const corBorda = isEmpate ? "border-slate-200" : isAumento ? "border-red-200" : "border-emerald-200";
  const corTexto = isEmpate ? "text-slate-800" : isAumento ? "text-red-800" : "text-emerald-800";
  const corLabel = isEmpate ? "text-slate-600" : isAumento ? "text-red-600" : "text-emerald-600";
  const corValor = isEmpate ? "text-slate-700" : isAumento ? "text-red-700" : "text-emerald-700";

  return (
    <div className={`${corBg} rounded-xl p-6 border ${corBorda} flex flex-col h-full`} data-testid="impact-card" data-tone={isEmpate ? "neutral" : isAumento ? "red" : "green"}>
      <div className="flex items-center gap-2 mb-3">
        {isEmpate
          ? <Scale className="w-5 h-5 text-slate-500 shrink-0" />
          : isAumento
          ? <TrendingUp className="w-5 h-5 text-red-500 shrink-0" />
          : <TrendingDown className="w-5 h-5 text-emerald-600 shrink-0" />
        }
        <h3 className={`text-lg font-bold ${corTexto}`}>
          {titulo || (isEmpate ? "Empate" : isAumento ? "Aumento de Carga" : "Economia")}
        </h3>
      </div>
      <MoneyValue value={valorAnual} size="xl" color={corValor} />
      <p className={`text-base mt-0.5 mb-4 ${corLabel}`}>{rotulo}</p>
      <div className="space-y-1">
        <div className="flex justify-between items-baseline gap-4">
          <span className={corLabel}>Diferença mensal</span>
          <MoneyValue value={valorMensal} size="sm" color={corValor} />
        </div>
        <div className="flex justify-between items-baseline gap-4">
          <span className={corLabel}>Variação</span>
          <span className={`font-bold text-lg whitespace-nowrap ${corValor}`}>{fmtPct(variacao)}</span>
        </div>
        {flagMenorCarga && (
          <div className="flex justify-between items-baseline gap-4 pt-2 border-t border-slate-200">
            <span className="text-slate-500">Menor carga</span>
            <span className="font-bold text-slate-800 whitespace-nowrap">{flagMenorCarga}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== CONCLUSÃO =====

interface ConclusaoProps {
  isAumento: boolean;
  isEmpate?: boolean;
  texto: string;
  vencedor?: string;
  impactoAnual: number;
  impactoPct: number;
  badgeTexto?: string;
}
export function CardConclusao({ isAumento, isEmpate = false, texto, vencedor, impactoAnual, impactoPct, badgeTexto }: ConclusaoProps) {
  const corBg = isEmpate ? "bg-slate-50 border-slate-200" : isAumento ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200";
  const badgeBg = isEmpate ? "bg-slate-100 text-slate-800" : isAumento ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800";
  const badgeIcon = isEmpate
    ? <Scale className="w-5 h-5 shrink-0" />
    : isAumento
    ? <TrendingUp className="w-5 h-5 shrink-0" />
    : <TrendingDown className="w-5 h-5 shrink-0" />;

  return (
    <div className={`rounded-2xl p-6 border shadow-sm ${corBg}`}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-base font-bold ${badgeBg} shrink-0`}>
          {badgeIcon}
          {badgeTexto || (isEmpate ? "Empate" : isAumento ? "Aumento de carga" : "Menor carga tributária")}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base leading-relaxed text-slate-700">{texto}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm font-semibold">
            <span className={isAumento ? "text-red-600" : "text-emerald-600"}>
              Impacto: <MoneyValue value={impactoAnual} size="sm" /> ({fmtPct(impactoPct)})
            </span>
            {vencedor && <span className="text-slate-500">Vencedor: <strong>{vencedor}</strong></span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== CBS DETALHADA =====

interface BaseLegalInfo {
  baseLegal?: string;
  artigo?: string;
  inciso?: string;
  paragrafo?: string;
  condicional?: boolean;
  requisitos?: string;
  pct?: number;
}

interface CBSData {
  debito?: number;
  credito?: number;
  liquida?: number;
  aliq?: number;
  aliqPadrao?: number;
  aliqCompras?: number;
  reducao?: BaseLegalInfo;
}

interface CardCBSProps { cbs: CBSData; labels?: { base?: string; debito?: string }; }
export function CardCBS({ cbs, labels }: CardCBSProps) {
  if (!cbs || !(cbs.debito || 0)) return null;
  return (
    <div className="bg-white rounded-2xl border border-cyan-200 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <Receipt className="w-6 h-6 text-cyan-600 shrink-0" />
        <h2 className="text-xl font-bold text-slate-800">CBS — Apuração Fora do DAS</h2>
      </div>

      {cbs.reducao ? (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5 mb-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-base font-bold text-emerald-800">ATIVIDADE POTENCIALMENTE BENEFICIADA</p>
              <p className="text-base text-emerald-700 mt-1 leading-relaxed">
                Esta atividade pode usufruir da redução da CBS prevista na {fmtBaseLegal(cbs.reducao)}.
              </p>
              {cbs.reducao.condicional && (
                <div className="flex items-start gap-2 mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-base font-semibold text-amber-800">Benefício condicional</p>
                    <p className="text-base text-amber-700">
                      A aplicação do benefício depende do atendimento dos requisitos legais previstos no {cbs.reducao.paragrafo ? cbs.reducao.paragrafo + " " : ""}do mesmo artigo.
                    </p>
                    {cbs.reducao.requisitos && (
                      <p className="text-base text-amber-600 mt-1 italic">{cbs.reducao.requisitos}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl p-4 mb-5">
          <p className="text-base text-slate-500">Premissa utilizada para esta simulação.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-5 h-5 text-blue-600 shrink-0" />
            <h4 className="text-lg font-bold text-blue-800">{labels?.base || "CBS sobre receitas tributáveis"}</h4>
          </div>
          <div className="space-y-2">
            <Row label="Alíquota padrão" value={fmtPct(cbs.aliqPadrao ?? 0)} />
            {cbs.reducao && (
              <Row label={`Redução aplicada (${cbs.reducao.pct ?? 0}%)`}
                value={fmtPct((cbs.aliqPadrao ?? 0) - (cbs.aliq ?? 0))} color="text-emerald-600" />
            )}
            <div className="flex justify-between items-baseline gap-4 pt-1">
              <span className="text-blue-600">Alíquota efetiva</span>
              <span className="font-bold text-xl text-blue-700 whitespace-nowrap">{fmtPct(cbs.aliq ?? 0)}</span>
            </div>
            <div className="flex justify-between items-baseline gap-4 pt-2 border-t border-blue-100">
              <span className="text-blue-600 font-medium">{labels?.debito || "Débito sobre receitas tributáveis"}</span>
              <span className="font-bold text-lg text-slate-800"><MoneyValue value={cbs.debito ?? 0} size="md" /></span>
            </div>
          </div>
        </div>

        <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-100">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="w-5 h-5 text-emerald-600 shrink-0" />
            <h4 className="text-lg font-bold text-emerald-800">CBS sobre Compras</h4>
          </div>
          <div className="space-y-2">
            <Row label="Alíquota nas aquisições"
              value={cbs.aliqCompras ? fmtPct(cbs.aliqCompras) : fmtPct(cbs.aliqPadrao ?? 0)} />
            <div className="flex justify-between items-baseline gap-4 pt-2 border-t border-emerald-100">
              <span className="text-emerald-600 font-medium">Créditos</span>
              <span className="font-bold text-lg text-slate-800"><MoneyValue value={cbs.credito ?? 0} size="md" /></span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl p-5 border border-cyan-200">
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold text-cyan-800">CBS Líquida</span>
          <MoneyValue value={cbs.liquida ?? 0} size="xl" color="text-cyan-800" />
        </div>
      </div>
    </div>
  );
}

// ===== MEMÓRIA DE CÁLCULO (FLUXO VISUAL) =====

type EtapaMemoria = { label: string; valor: string; cor?: string; operador?: never } | { operador: string; label?: never; valor?: never; cor?: never };
interface MemoriaCalculoProps {
  etapas: EtapaMemoria[];
  titulo?: string;
}
export function MemoriaCalculo({ etapas, titulo = "Memória de Cálculo" }: MemoriaCalculoProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <FileText className="w-6 h-6 text-slate-600 shrink-0" />
        <h2 className="text-xl font-bold text-slate-800">{titulo}</h2>
      </div>
      <div className="space-y-0">
        {etapas.map((e, i) => (
          <div key={i}>
            {i > 0 && !e.operador && (
              <div className="flex justify-center py-1">
                <ArrowDown className="w-5 h-5 text-slate-300 shrink-0" />
              </div>
            )}
            {e.operador === "+" && (
              <div className="flex justify-center py-0.5">
                <span className="text-sm font-bold text-slate-300 uppercase tracking-widest">+</span>
              </div>
            )}
            {e.label !== undefined ? (
              <div className={`rounded-xl p-4 border ${e.cor || "bg-slate-50 border-slate-200"}`}>
                <div className="flex justify-between items-center gap-4">
                  <span className="text-base text-slate-600 shrink-0">{e.label}</span>
                  <span className="text-xl font-bold text-slate-800 whitespace-nowrap">{e.valor}</span>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
