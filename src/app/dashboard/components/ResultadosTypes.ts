export type TipoComparacao =
  | "SIMPLES_VS_PRESUMIDO"
  | "SIMPLES_TRADICIONAL_VS_HIBRIDO"
  | "PRESUMIDO_ATUAL_VS_REFORMA"
  | "PRESUMIDO_ATUAL_VS_REFORMA_2033";

export interface SnResult {
  total: number;
  media: number;
  aliquota: number;
  dasAnual: number;
  das: number;
  encargos: number;
  anexo: string;
  fatorR: string;
  composicao: string;
  aliquotaDisplay: number;
  sublimiteIcms: boolean;
  sublimiteIss: boolean;
  sublimiteValor: number;
  label: string;
}

export interface LpResult {
  total: number;
  media: number;
  aliquota: number;
  irpj15: number;
  irpjAdic: number;
  csll: number;
  pisCofins: number;
  iss: number;
  icms: number;
  ipi: number;
  encargos: number;
  presIRPJ: number;
  presCSLL: number;
  federalTotal: number;
  municipalTotal: number;
  encargosTotal: number;
  aliquotaDisplay: number;
}

export interface CbsResult {
  total: number;
  media: number;
  aliqLabel: string;
  receita: number;
  bruta: number;
  creditos: number;
  liquida: number;
  aliqEfetiva: string;
  aliquotaDisplay: string;
}

export interface KpiResult {
  sn: number;
  lp: number;
  economia: number;
  ecoPct: number;
  ecoTag: string;
  winner: string;
}

export interface IndicadoresResult {
  vantagem: string;
  diffMes: number;
  carga: number;
}

export interface RecResult {
  title: string;
  sub: string;
  reason: string;
  parecer: string;
  icon: string;
  fatores: string;
}

export interface CbsImpactoResult {
  pisCofins: number;
  cbs: number;
  impacto: number;
  var: number;
  totalLp: number;
  totalRef: number;
  impactoTotal: number;
  parecer: string;
  compras: number;
  pctCreditavel: number;
  baseCreditavel: number;
  aliqCredito: string;
  creditoEstimado: number;
  receitaTrib: number;
  aliqSaida: string;
  pisCofinsAtual: number;
  impactoAnual: number;
}

export interface ReformaTotais {
  pisCofins: number;
  irpj: number;
  csll: number;
  iss: number;
  icms: number;
  encargos: number;
  cbs: number;
  total: number;
  impacto: number;
}

export interface ReformaResumo {
  atualTotal: number;
  atualAliq: number;
  cbsAliq: number;
  cbsLiquida: number;
  provavel: number;
  otimista: number;
  conservador: number;
  variacao: number;
}

export interface SnHibridoResult {
  dasReduzido: number;
  cbsFora: number;
  ibsFora: number;
  total: number;
  media: number;
  aliquota: number;
  economia: number;
  ecoPct: number;
}

export interface AnaliseSimplesPresumido {
  elegibilidade: { snElegivel: boolean; statusTxt: string };
  sn: SnResult;
  lp: LpResult;
  cbs: CbsResult;
  kpi: KpiResult;
  indicadores: IndicadoresResult;
  rec: RecResult;
  cbsImpacto: CbsImpactoResult;
  reformaTotais: ReformaTotais;
  reformaResumo: ReformaResumo;
  snHibrido: SnHibridoResult;
  fatorR: string;
  anexoFR: string;
  cnaeDesc: string;
  cnaeAviso: boolean;
  calcDAS: string;
  calcSN: string;
  calcLP: string;
  calcEconomia: string;
}

// ===== PROTOCOL TYPES =====

export interface EngineReadyMessage {
  type: "engineReady";
  engineVersion: string;
}

export interface CalculateRequest {
  type: "calcular";
  requestId: string;
  tipoComparacao: TipoComparacao;
  data: Record<string, string>;
}

export interface CalculateSuccessResponse {
  type: "resultado";
  requestId: string;
  tipoComparacao: TipoComparacao;
  success: true;
  data: Record<string, unknown>;
}

export interface CalculateErrorResponse {
  type: "resultado";
  requestId: string;
  tipoComparacao: TipoComparacao;
  success: false;
  error: { code: string; message: string };
}

export type CalculateResponse = CalculateSuccessResponse | CalculateErrorResponse;

export interface PdfRequest {
  type: "exportPdf";
  requestId: string;
  tipoComparacao: TipoComparacao;
  data: Record<string, string>;
  resultadoAtual: Record<string, unknown>;
}

export interface PdfSuccessResponse {
  type: "pdfHtml";
  requestId: string;
  tipoComparacao: TipoComparacao;
  success: true;
  html: string;
}

export interface PdfErrorResponse {
  type: "pdfHtml";
  requestId: string;
  tipoComparacao: TipoComparacao;
  success: false;
  error: { code: string; message: string };
}

export type PdfResponse = PdfSuccessResponse | PdfErrorResponse;

export interface EnginePingMessage {
  type: "enginePing";
}

export type EngineMessage =
  | EngineReadyMessage
  | CalculateResponse
  | PdfResponse;

export type AppMessage =
  | CalculateRequest
  | PdfRequest
  | EnginePingMessage;

export const STORAGE_SCHEMA_VERSION = 1;

export const STORAGE_KEYS = {
  SIMULACAO: "ct_simulacao",
  RESULTADOS_SIMPLES_VS_PRESUMIDO: "ct_resultados_SIMPLES_VS_PRESUMIDO",
  RESULTADOS_SIMPLES_TRADICIONAL_VS_HIBRIDO: "ct_resultados_SIMPLES_TRADICIONAL_VS_HIBRIDO",
  RESULTADOS_PRESUMIDO_ATUAL_VS_REFORMA: "ct_resultados_PRESUMIDO_ATUAL_VS_REFORMA",
  RESULTADOS_PRESUMIDO_ATUAL_VS_REFORMA_2033: "ct_resultados_PRESUMIDO_ATUAL_VS_REFORMA_2033",
  TIPO: "ct_tipo_comparacao",
} as const;

export function getStorageKeyForTipo(tipo: TipoComparacao): string {
  switch (tipo) {
    case "SIMPLES_VS_PRESUMIDO": return STORAGE_KEYS.RESULTADOS_SIMPLES_VS_PRESUMIDO;
    case "SIMPLES_TRADICIONAL_VS_HIBRIDO": return STORAGE_KEYS.RESULTADOS_SIMPLES_TRADICIONAL_VS_HIBRIDO;
    case "PRESUMIDO_ATUAL_VS_REFORMA": return STORAGE_KEYS.RESULTADOS_PRESUMIDO_ATUAL_VS_REFORMA;
    case "PRESUMIDO_ATUAL_VS_REFORMA_2033": return STORAGE_KEYS.RESULTADOS_PRESUMIDO_ATUAL_VS_REFORMA_2033;
  }
}
