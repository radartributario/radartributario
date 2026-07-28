"use client";

import { formatCurrencyBRL } from "./CurrencyInput";
import {
  TrendingUp, TrendingDown, Scale, FileText, Receipt, ShoppingCart,
  DollarSign, BarChart3, AlertCircle, CheckCircle2, Banknote, ArrowDown
} from "lucide-react";

// ===== DESIGN TOKENS =====
const DS = {
  container: "max-w-6xl w-[calc(100%-48px)] mx-auto",
  cardPadding: "p-6",
  cardRadius: "rounded-xl",
  cardShadow: "shadow-sm",
  cardBorder: "border",
  gridGap: "gap-5",
  fontMoney: "text-[clamp(1.75rem,2.2vw,2.5rem)] leading-tight",
  fontMoneySm: "text-[clamp(1.5rem,2vw,2.25rem)] leading-tight",
  fontCardTitle: "text-lg font-bold",
  fontSectionTitle: "text-xl font-bold",
  fontBody: "text-base",
  fontSmall: "text-sm",
} as const;

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
  md: "text-xl",
  lg: "text-[clamp(1.25rem,1.8vw,1.75rem)]",
  xl: "text-[clamp(1.75rem,2.2vw,2.5rem)]",
  xxl: "text-[clamp(2rem,2.8vw,3rem)]",
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
  valorAnual: number;
  rotulo: string;
  valorMensal: number;
  variacao: number;
  flagMenorCarga?: string;
}

interface ResumoExecutivoProps {
  card1: CardResumoProps;
  card2: CardResumoProps;
  cardImpacto: CardImpactoProps;
}
export function ResumoExecutivo({ card1, card2, cardImpacto }: ResumoExecutivoProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-6 h-6 text-blue-600 shrink-0" />
        <h2 className="text-xl font-bold text-slate-800">Resumo Executivo</h2>
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

export function CardImpacto({ isAumento, valorAnual, rotulo, valorMensal, variacao, flagMenorCarga }: CardImpactoProps) {
  const corBg = isAumento ? "bg-red-50" : "bg-emerald-50";
  const corBorda = isAumento ? "border-red-200" : "border-emerald-200";
  const corTexto = isAumento ? "text-red-800" : "text-emerald-800";
  const corLabel = isAumento ? "text-red-600" : "text-emerald-600";
  const corValor = isAumento ? "text-red-700" : "text-emerald-700";

  return (
    <div className={`${corBg} rounded-xl p-6 border ${corBorda} flex flex-col h-full`}>
      <div className="flex items-center gap-2 mb-3">
        {isAumento
          ? <TrendingUp className="w-5 h-5 text-red-500 shrink-0" />
          : <TrendingDown className="w-5 h-5 text-emerald-600 shrink-0" />
        }
        <h3 className={`text-lg font-bold ${corTexto}`}>
          {isAumento ? "Aumento de Carga" : "Economia"}
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
  texto: string;
  vencedor?: string;
  impactoAnual: number;
  impactoPct: number;
}
export function CardConclusao({ isAumento, texto, vencedor, impactoAnual, impactoPct }: ConclusaoProps) {
  const corBg = isAumento ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200";
  const badgeBg = isAumento ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800";
  const badgeIcon = isAumento
    ? <TrendingUp className="w-5 h-5 shrink-0" />
    : <TrendingDown className="w-5 h-5 shrink-0" />;

  return (
    <div className={`rounded-2xl p-6 border shadow-sm ${corBg}`}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-base font-bold ${badgeBg} shrink-0`}>
          {badgeIcon}
          {isAumento ? "Aumento de carga" : "Menor carga tributária"}
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

interface CardCBSProps { cbs: CBSData; }
export function CardCBS({ cbs }: CardCBSProps) {
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
            <h4 className="text-lg font-bold text-blue-800">CBS sobre Vendas</h4>
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
              <span className="text-blue-600 font-medium">Débito</span>
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
