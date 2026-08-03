"use client";

import { useState, useCallback, useEffect } from "react";
import CurrencyInput from "./CurrencyInput";
import type { TipoComparacao } from "./ModoSelecao";

export type FormData = Record<string, string>;

const MAIN_ECONOMIC_FIELDS = ["rbt12Input", "comprasInput", "anoSIM", "salarios", "prolabore"];
const MAIN_TAX_FIELDS = ["aliquotaISS", "aliquotaICMS", "aliquotaIPI"];
const AUTO_FIELDS = new Set(["razao", "fantasia", "cnae", "atividade", "municipio", "estado"]);

const FIELD_INPUT_CLASS = "w-full px-3 py-2 rounded-lg border bg-white border-[#A8B8CC] text-[#172033] text-sm shadow-[0_1px_3px_rgba(15,42,86,0.08)] focus:outline-none focus:ring-2 focus:ring-[#2155E5]/40 focus:border-[#2155E5]";
const AUTO_INPUT_CLASS = "w-full px-3 py-2 rounded-lg border border-[#BCC8D8] bg-[#E2E8F0] text-[#24364D] text-sm cursor-default focus:outline-none";

interface Props {
  data: FormData;
  onChange: (data: FormData) => void;
  onGenerate?: () => void;
  tipoComparacao?: TipoComparacao;
  showAllFields?: boolean;
  hideGenerate?: boolean;
  showHybridInfo?: boolean;
}

function cnaeToTipoAtiv(cnae: string): string {
  if (!cnae) return "";
  const digits = cnae.replace(/\D/g, "");
  const div = parseInt(digits.substring(0, 2)) || 0;
  if (div >= 10 && div <= 33) return "industria";
  if (div >= 41 && div <= 43) return "servicos";
  if (div >= 45 && div <= 47) return "comercio";
  // servicos range from autoClassifyCnae / getCnaeCategoria
  if (div >= 55 && div <= 56) return "servicos";
  if (div >= 58 && div <= 60) return "servicos";
  if (div >= 61 && div <= 63) return "servicos";
  if ((div >= 64 && div <= 66) || (div >= 68 && div <= 82)) return "servicos";
  if (div >= 85 && div <= 88) return "servicos";
  if (div >= 90 && div <= 96) return "servicos";
  return "servicos";
}

interface FieldDef {
  id: string;
  label: string;
  block: "empresa" | "economico" | "tributario";
  type?: "select" | "currency";
  options?: { v: string; l: string }[];
  defaultValue?: string;
  fullWidth?: boolean;
  mode?: TipoComparacao[];
}

const FIELDS: FieldDef[] = [
  { id: "razao", label: "Razão Social", block: "empresa" },
  { id: "fantasia", label: "Nome Fantasia", block: "empresa" },
  { id: "cnpj", label: "CNPJ", block: "empresa" },
  { id: "cnae", label: "CNAE Principal", block: "empresa" },
  { id: "atividade", label: "Atividade Principal", block: "empresa", fullWidth: true },
  { id: "municipio", label: "Município", block: "empresa" },
  { id: "estado", label: "Estado", block: "empresa" },
  { id: "regime", label: "Regime Atual", block: "empresa", type: "select", options: [
    { v: "Simples Nacional", l: "Simples Nacional" },
    { v: "Lucro Presumido", l: "Lucro Presumido" },
    { v: "Lucro Real", l: "Lucro Real" },
  ]},
  { id: "tipoAtivLP", label: "Tipo de Atividade (LP)", block: "empresa", type: "select", options: [
    { v: "servicos", l: "Serviços em Geral" },
    { v: "comercio", l: "Comércio" },
    { v: "industria", l: "Indústria" },
    { v: "transpCarga", l: "Transporte de Cargas" },
    { v: "transpPass", l: "Transporte (exceto cargas)" },
    { v: "hospitalar", l: "Serviços Hospitalares" },
    { v: "revenda", l: "Revenda de Combustíveis" },
  ]},
  { id: "anoSIM", label: "Ano da Simulação", block: "empresa" },
  // Sublimite (condicional)
  { id: "receitaAnoAnterior", label: "Receita do Ano Anterior (R$)", block: "economico", type: "currency" },
  { id: "receitaAcumulada", label: "Receita Acumulada Ano Atual (R$)", block: "economico", type: "currency" },
  { id: "mesUltrapassagem", label: "Mês da Ultrapassagem do Sublimite", block: "economico" },
  { id: "impedimentoIssJaProduzEfeitos", label: "ISS já está fora do DAS?", block: "economico", type: "select", options: [
    { v: "", l: "Não informado" },
    { v: "sim", l: "Sim, impedimento já vigente" },
    { v: "nao", l: "Não, ainda dentro do DAS" },
  ]},
  // Dados Econômicos
  { id: "rbt12Input", label: "Receita Bruta Total — 12 meses", block: "economico", type: "currency" },
  { id: "comprasInput", label: "Compras / Aquisições anuais (R$)", block: "economico", type: "currency" },
  { id: "salarios", label: "Salários (média mensal)", block: "economico", type: "currency" },
  { id: "prolabore", label: "Pró-labore (média mensal)", block: "economico", type: "currency" },
  { id: "inss", label: "INSS Patronal (%)", block: "economico", defaultValue: "20" },
  { id: "rat", label: "RAT (%)", block: "economico", defaultValue: "3" },
  { id: "terceiros", label: "Terceiros (%)", block: "economico", defaultValue: "3.3" },
  { id: "fgts", label: "FGTS (%)", block: "economico", defaultValue: "8" },
  // Parâmetros Tributários
  { id: "aliquotaISS", label: "Alíquota ISS (%)", block: "tributario", defaultValue: "2.5" },
  { id: "aliquotaICMS", label: "Alíquota ICMS (%)", block: "tributario", defaultValue: "0" },
  { id: "aliquotaIPI", label: "Alíquota IPI (%)", block: "tributario", defaultValue: "0" },
  { id: "segregacao", label: "% Serviços no Faturamento (LP)", block: "tributario" },
  { id: "refPctCbs", label: "Receita sujeita à CBS padrão (%)", block: "tributario", defaultValue: "100" },
  { id: "refAliqCbs", label: "Alíquota estimada da CBS (%)", block: "tributario", defaultValue: "8.8" },
  { id: "refPctRed", label: "Receita com alíquota reduzida (%)", block: "tributario", defaultValue: "0" },
  { id: "refPctRedVal", label: "Percentual de redução (%)", block: "tributario", defaultValue: "40" },
  { id: "refPctZero", label: "Receita com alíquota zero (%)", block: "tributario", defaultValue: "0" },
  { id: "refPisAliq", label: "PIS alíquota atual (%)", block: "tributario", defaultValue: "0.65" },
  { id: "refCofinsAliq", label: "COFINS alíquota atual (%)", block: "tributario", defaultValue: "3.0" },
  { id: "refCredMerc", label: "Compras de mercadorias (R$)", block: "tributario", type: "currency" },
  { id: "refCredServ", label: "Aquisição de serviços (R$)", block: "tributario", type: "currency" },
  { id: "refCredEnerg", label: "Energia elétrica (R$)", block: "tributario", type: "currency" },
  { id: "refCredAlug", label: "Aluguéis (R$)", block: "tributario", type: "currency" },
  { id: "refCredAtivo", label: "Ativo imobilizado (R$)", block: "tributario", type: "currency" },
  { id: "refCredOutras", label: "Outras despesas creditáveis (R$)", block: "tributario", type: "currency" },
  { id: "refCredSn", label: "Compras SN (sem crédito) (R$)", block: "tributario", type: "currency" },
  { id: "refCredPct", label: "Aproveitamento créditos (%)", block: "tributario", defaultValue: "100" },
  { id: "refCredManual", label: "Créditos manuais (R$)", block: "tributario", type: "currency" },
  // Opção híbrida (Simples + CBS fora do DAS)
  { id: "optOutPct", label: "% de opt-out do DAS", block: "tributario", defaultValue: "100", mode: ["SIMPLES_TRADICIONAL_VS_HIBRIDO"] },
  { id: "aliqCbsFora", label: "Alíquota CBS fora do DAS (%)", block: "tributario", defaultValue: "8.8", mode: ["SIMPLES_TRADICIONAL_VS_HIBRIDO"] },
  { id: "aliqCbsCompras", label: "Alíquota média da CBS nas aquisições (%)", block: "tributario", defaultValue: "8.8", mode: ["SIMPLES_TRADICIONAL_VS_HIBRIDO"] },
  { id: "benefReqProfissionais", label: "Sócios habilitados e registrados no conselho?", block: "tributario", type: "select", mode: ["SIMPLES_TRADICIONAL_VS_HIBRIDO", "PRESUMIDO_ATUAL_VS_REFORMA"], options: [
    { v: "", l: "Não respondido" }, { v: "sim", l: "Sim" }, { v: "nao", l: "Não" },
  ]},
  { id: "benefReqSemSocioPJ", label: "Sem pessoa jurídica como sócia?", block: "tributario", type: "select", mode: ["SIMPLES_TRADICIONAL_VS_HIBRIDO", "PRESUMIDO_ATUAL_VS_REFORMA"], options: [
    { v: "", l: "Não respondido" }, { v: "sim", l: "Sim" }, { v: "nao", l: "Não" },
  ]},
  { id: "benefReqNaoParticipaPJ", label: "Não participa de outra pessoa jurídica?", block: "tributario", type: "select", mode: ["SIMPLES_TRADICIONAL_VS_HIBRIDO", "PRESUMIDO_ATUAL_VS_REFORMA"], options: [
    { v: "", l: "Não respondido" }, { v: "sim", l: "Sim" }, { v: "nao", l: "Não" },
  ]},
  { id: "benefReqExclusiva", label: "Exerce exclusivamente atividade elegível?", block: "tributario", type: "select", mode: ["SIMPLES_TRADICIONAL_VS_HIBRIDO", "PRESUMIDO_ATUAL_VS_REFORMA"], options: [
    { v: "", l: "Não respondido" }, { v: "sim", l: "Sim" }, { v: "nao", l: "Não" },
  ]},
  { id: "benefReqDireta", label: "Serviços prestados diretamente por profissionais habilitados?", block: "tributario", type: "select", mode: ["SIMPLES_TRADICIONAL_VS_HIBRIDO", "PRESUMIDO_ATUAL_VS_REFORMA"], options: [
    { v: "", l: "Não respondido" }, { v: "sim", l: "Sim" }, { v: "nao", l: "Não" },
  ]},
];

export function defaultFormData(): FormData {
  const d: FormData = {};
  for (const f of FIELDS) {
    d[f.id] = f.defaultValue ?? "";
  }
  return d;
}

export function formatCNPJ(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4/$5");
}

export default function SimulacaoForm({ data, onChange, onGenerate, tipoComparacao = "SIMPLES_VS_PRESUMIDO", showAllFields = false, hideGenerate = false, showHybridInfo = true }: Props) {
  const [cnpjInput, setCnpjInput] = useState(data.cnpj || "");
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjError, setCnpjError] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const set = useCallback((id: string, val: string) => onChange({ ...data, [id]: val }), [data, onChange]);

  const handleCnpjChange = (value: string) => {
    const formatted = formatCNPJ(value);
    setCnpjInput(formatted);
    onChange({ ...data, cnpj: formatted });
  };

  const consultarCnpj = async () => {
    const clean = cnpjInput.replace(/\D/g, "");
    if (clean.length !== 14) { setCnpjError("CNPJ deve ter 14 dígitos"); return; }
    setCnpjLoading(true);
    setCnpjError("");
    try {
      const res = await fetch(`/api/cnpj/${clean}`);
      const d = await res.json();
      if (!res.ok) { setCnpjError(d.error || "Erro ao consultar"); return; }
      const upd: FormData = { ...data };
      upd.cnpj = formatCNPJ(cnpjInput);
      if (d.razao_social) upd.razao = d.razao_social;
      if (d.nome_fantasia) upd.fantasia = d.nome_fantasia;
      if (d.cnae_fiscal) {
        const cnaeStr = String(d.cnae_fiscal);
        upd.cnae = cnaeStr;
        upd.tipoAtivLP = cnaeToTipoAtiv(cnaeStr);
      }
      if (d.cnae_fiscal_descricao) upd.atividade = d.cnae_fiscal_descricao;
      if (d.municipio) upd.municipio = d.municipio;
      if (d.uf) upd.estado = d.uf;
      if (d.opcao_pelo_simples !== undefined) upd.regime = d.opcao_pelo_simples ? "Simples Nacional" : "Lucro Presumido";
      onChange(upd);
    } catch { setCnpjError("Erro de conexão"); }
    setCnpjLoading(false);
  };

  // Auto-fill tipoAtivLP only when CNAE changes AND tipoAtivLP is empty
  useEffect(() => {
    if (data.cnae && !data.tipoAtivLP) {
      const suggested = cnaeToTipoAtiv(data.cnae);
      if (suggested) {
        onChange({ ...data, tipoAtivLP: suggested });
      }
    }
  }, [data.cnae]);

  const validar = (): boolean => {
    const errs: string[] = [];
    if (!data.cnpj) errs.push("CNPJ é obrigatório");
    if (!data.cnae) errs.push("CNAE é obrigatório");
    if (!data.rbt12Input) errs.push("Receita Bruta Total é obrigatório");
    if (!data.tipoAtivLP) errs.push("Tipo de Atividade (LP) é obrigatório");
    if (data.anoSIM && data.anoSIM.length !== 4) errs.push("Ano da simulação deve ter 4 dígitos");
    setErrors(errs);
    return errs.length === 0;
  };

  const handleGenerate = () => { if (validar() && onGenerate) onGenerate(); };

  const renderField = (f: FieldDef) => {
    const val = data[f.id] ?? "";
    const isAuto = AUTO_FIELDS.has(f.id);
    if (f.type === "select" && f.options) {
      return (
        <select id={f.id} value={val} onChange={e => set(f.id, e.target.value)}
          className={FIELD_INPUT_CLASS}>
          {f.options.map(o => (
            <option key={o.v} value={o.v}>{o.l}</option>
          ))}
        </select>
      );
    }
    if (f.type === "currency") {
      return (
        <CurrencyInput
          id={f.id}
          value={val}
          onChange={v => set(f.id, v)}
          placeholder="0,00"
          className={FIELD_INPUT_CLASS}
        />
      );
    }
    return (
      <input id={f.id} type="text" value={val} onChange={e => set(f.id, e.target.value)}
        className={isAuto ? AUTO_INPUT_CLASS : FIELD_INPUT_CLASS} />
    );
  };

  const isHibrido = tipoComparacao === "SIMPLES_TRADICIONAL_VS_HIBRIDO";
  const isReforma = tipoComparacao === "PRESUMIDO_ATUAL_VS_REFORMA";

  const fieldsByBlock = (block: string) => FIELDS.filter(f => {
    if (f.block !== block) return false;
    if (f.mode && !showAllFields && !f.mode.includes(tipoComparacao)) return false;
    const SUBL_FIELDS = ["receitaAnoAnterior","receitaAcumulada","mesUltrapassagem","impedimentoIssJaProduzEfeitos"];
    if (SUBL_FIELDS.includes(f.id)) {
      const rbtStr = data.rbt12Input || "";
      const rbt = parseFloat(rbtStr.replace(/\./g,"").replace(",",".")) || 0;
      if (rbt <= 3600000) return false;
      if (tipoComparacao !== "SIMPLES_VS_PRESUMIDO") return false;
    }
    return true;
  });

  const byId = new Map(FIELDS.map(f => [f.id, f]));
  const fieldIsVisible = (field: FieldDef | undefined): field is FieldDef => !!field && fieldsByBlock(field.block).some(f => f.id === field.id);
  const companyFields = fieldsByBlock("empresa").filter(f => f.id !== "cnpj" && f.id !== "anoSIM");
  const simulationFields = MAIN_ECONOMIC_FIELDS.map(id => byId.get(id)).filter(fieldIsVisible);
  const taxFields = MAIN_TAX_FIELDS.map(id => byId.get(id)).filter(fieldIsVisible);
  const advancedFields = [...fieldsByBlock("economico").filter(f => !MAIN_ECONOMIC_FIELDS.includes(f.id)), ...fieldsByBlock("tributario").filter(f => !MAIN_TAX_FIELDS.includes(f.id))];

  const buttonLabel = isHibrido
    ? "Calcular impacto da opção híbrida"
    : isReforma
    ? "Analisar impacto da Reforma Tributária"
    : "Gerar diagnóstico tributário";

    return (
      <div className="space-y-8">
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
          {errors.map((e, i) => <p key={i} className="text-sm text-red-600">&#9888; {e}</p>)}
        </div>
      )}

      <div className="rounded-3xl border border-[#D4DCE8] bg-white p-6 shadow-[0_4px_12px_rgba(15,42,86,0.06)]">
        <div className="flex items-center gap-2 mb-1">
          <span className="h-6 w-1.5 rounded-full bg-[#2155E5]" />
          <h2 className="text-xl font-extrabold uppercase tracking-wide text-[#172033]">🏢 Identificação da Empresa</h2>
        </div>
        <p className="text-xs text-[#5B6B80] mb-3">Consulte o CNPJ para preencher automaticamente os dados cadastrais.</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input id="cnpj" type="text" value={cnpjInput} onChange={e => handleCnpjChange(e.target.value)}
            placeholder="00.000.000/0000-00" maxLength={18}
            className="flex-1 rounded-2xl border border-[#A8B8CC] bg-white px-4 py-3 text-sm text-[#172033] shadow-[0_1px_3px_rgba(15,42,86,0.08)] focus:outline-none focus:ring-2 focus:ring-[#2155E5]/40 focus:border-[#2155E5]" />
          <button onClick={consultarCnpj} disabled={cnpjLoading}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#2155E5] px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-900/20 transition-all hover:-translate-y-0.5 hover:bg-[#1846C7] hover:shadow-xl hover:shadow-blue-900/25 active:translate-y-0 active:bg-[#1239a8] disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none">
            {cnpjLoading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Consultando...</>
            ) : "Consultar"}
          </button>
        </div>
        {cnpjError && <p className="mt-2 text-sm text-red-600">{cnpjError}</p>}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {companyFields.map(f => (
            <div key={f.id} className={f.fullWidth ? "sm:col-span-2 lg:col-span-2" : ""}>
              <label className="block text-xs font-medium text-[#5B6B80] mb-1">{f.label}</label>
              {renderField(f)}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-[#D4DCE8] bg-white p-6 shadow-[0_4px_12px_rgba(15,42,86,0.06)]">
        <div className="flex items-center gap-2 mb-4">
          <span className="h-5 w-1.5 rounded-full bg-[#2155E5]" />
          <h3 className="text-base font-extrabold text-[#172033]">💰 Dados da Simulação</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {simulationFields.map(f => (
            <div key={f.id}>
              <label className="block text-xs font-medium text-[#5B6B80] mb-1">{f.label}</label>
              {renderField(f)}
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {taxFields.map(f => (
            <div key={f.id}>
              <label className="block text-xs font-medium text-[#5B6B80] mb-1">{f.label}</label>
              {renderField(f)}
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-[#D4DCE8] bg-white shadow-[0_4px_12px_rgba(15,42,86,0.06)]">
        <button type="button" onClick={() => setAdvancedOpen(value => !value)} className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-slate-50 transition-colors">
          <span className="flex items-center gap-2 text-base font-extrabold text-[#172033]">
            <span className="h-5 w-1.5 rounded-full bg-[#2155E5]" />
            ⚙️ Ajustes Avançados
          </span>
          <span className={`text-slate-400 transition-transform ${advancedOpen ? "rotate-180" : ""}`}>▼</span>
        </button>
        {advancedOpen && (
          <div className="border-t border-slate-100 px-5 pb-5 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {advancedFields.map(f => (
                <div key={f.id}>
                  <label className="block text-xs font-medium text-[#5B6B80] mb-1">{f.label}</label>
                  {renderField(f)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {isHibrido && showHybridInfo && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <strong className="font-semibold">Simulação Híbrida</strong>
          <p className="mt-1 text-amber-700">
            Neste cenário, a CBS deixa de ser recolhida dentro do DAS e passa a ser apurada pelo regime regular.
            O DAS é reduzido pela parcela correspondente da CBS e, posteriormente, é adicionada a CBS líquida apurada fora do DAS.
          </p>
        </div>
      )}

      {!hideGenerate && <button onClick={handleGenerate}
        className="w-full bg-[#2155E5] hover:bg-[#1846C7] active:bg-[#1239a8] text-white py-3.5 rounded-xl text-base font-semibold shadow-lg shadow-blue-900/20 transition-colors">
        {buttonLabel}
      </button>}
    </div>
  );
}
