"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import SimulacaoForm, { defaultFormData, type FormData } from "./components/SimulacaoForm";
import DashboardResultados from "./components/DashboardResultados";
import ModoSelecao from "./components/ModoSelecao";
import { useComparadorEngine } from "./hooks/useComparadorEngine";
import { safeStorageGet, safeStorageSet, saveResult, loadResult, clearSensitiveData } from "./components/StorageUtils";
import { STORAGE_KEYS } from "./components/ResultadosTypes";
import type { TipoComparacao } from "./components/ResultadosTypes";

const VALID_TIPOS: TipoComparacao[] = ["SIMPLES_VS_PRESUMIDO","SIMPLES_TRADICIONAL_VS_HIBRIDO","PRESUMIDO_ATUAL_VS_REFORMA"];

const getInitialTipo = (): TipoComparacao => {
  if (typeof window === "undefined") return "SIMPLES_VS_PRESUMIDO";
  const saved = safeStorageGet<TipoComparacao>(STORAGE_KEYS.TIPO);
  return saved && VALID_TIPOS.includes(saved) ? saved : "SIMPLES_VS_PRESUMIDO";
};

const getInitialFormData = (): FormData => {
  if (typeof window === "undefined") return defaultFormData();
  const saved = safeStorageGet<FormData>(STORAGE_KEYS.SIMULACAO);
  return saved ? { ...defaultFormData(), ...saved } : defaultFormData();
};

export default function DashboardPage() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<1 | 2>(1);
  const [tipoComparacao, setTipoComparacao] = useState<TipoComparacao>(getInitialTipo);
  const [formData, setFormData] = useState<FormData>(getInitialFormData);
  const [showConfirmTroca, setShowConfirmTroca] = useState(false);
  const [pendingTipo, setPendingTipo] = useState<TipoComparacao | null>(null);
  const [pendingCalculateTipo, setPendingCalculateTipo] = useState<TipoComparacao | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pendingCalculateRef = useRef<TipoComparacao | null>(null);

  const engine = useComparadorEngine(iframeRef, tipoComparacao);

  useEffect(() => {
    let cancelled = false;
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/auth/login");
          return;
        }
        const data = await res.json();
        if (!cancelled) setUser({ email: data.email || "" });
      } catch {
        router.push("/auth/login");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadUser();
    return () => { cancelled = true; };
  }, [router]);

  // These effects only write to external storage — not setState
  useEffect(() => { safeStorageSet(STORAGE_KEYS.TIPO, tipoComparacao); }, [tipoComparacao]);
  useEffect(() => { safeStorageSet(STORAGE_KEYS.SIMULACAO, formData); }, [formData]);

  // Save results to storage when engine produces them
  useEffect(() => {
    if (engine.results) {
      saveResult(tipoComparacao, engine.results);
    }
  }, [engine.results, tipoComparacao]);

  useEffect(() => {
    if (!pendingCalculateTipo || pendingCalculateTipo !== tipoComparacao) return;
    if (!engine.ready) return;
    if (pendingCalculateRef.current === pendingCalculateTipo) return;
    pendingCalculateRef.current = pendingCalculateTipo;
    engine.calculate(formData);
    setTimeout(() => {
      pendingCalculateRef.current = null;
      setPendingCalculateTipo(null);
      setStep(2);
    }, 0);
  }, [pendingCalculateTipo, tipoComparacao, engine, formData]);

  // Engine ready timeout — uses ref to avoid setState in effect
  const engineTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (engine.ready) {
      if (engineTimeoutRef.current) {
        clearTimeout(engineTimeoutRef.current);
        engineTimeoutRef.current = null;
      }
      // Use setTimeout to defer setState, avoiding sync-set-state lint error
      if (engineError) {
        setTimeout(() => setEngineError(null), 0);
      }
      return;
    }
    if (engineError) return; // already showing an error
    engineTimeoutRef.current = setTimeout(() => {
      setEngineError("Não foi possível preparar o motor de cálculo. Atualize a página e tente novamente.");
    }, 10000);
    return () => {
      if (engineTimeoutRef.current) {
        clearTimeout(engineTimeoutRef.current);
        engineTimeoutRef.current = null;
      }
    };
  }, [engine.ready, engineError]);

  const confirmChangeTipo = useCallback((tipo: TipoComparacao) => {
    setTipoComparacao(tipo);
    setFormData(defaultFormData());
    engine.resetState();
    setShowConfirmTroca(false);
    setPendingTipo(null);
    setStep(1);
  }, [engine]);

  const validateBeforeCalculate = useCallback(() => {
    const missing: string[] = [];
    if (!formData.cnpj) missing.push("CNPJ");
    if (!formData.cnae) missing.push("CNAE");
    if (!formData.rbt12Input) missing.push("Receita Bruta");
    if (!formData.tipoAtivLP) missing.push("Tipo de Atividade");
    if (missing.length > 0) {
      setEngineError(`Preencha os campos obrigatórios antes de escolher a análise: ${missing.join(", ")}.`);
      return false;
    }
    return true;
  }, [formData]);

  const handleSelectTipo = useCallback((tipo: TipoComparacao) => {
    if (!validateBeforeCalculate()) return;
    if (!engine.ready) {
      setEngineError("Preparando motor de cálculo...");
      return;
    }
    setEngineError(null);
    engine.resetState();
    setTipoComparacao(tipo);
    setPendingCalculateTipo(tipo);
  }, [engine, validateBeforeCalculate]);

  const handleEdit = useCallback(() => {
    setStep(1);
  }, []);

  const handleTrocarAnalise = useCallback(() => {
    setStep(1);
  }, []);

  const confirmVoltarHome = useCallback(() => {
    setFormData(defaultFormData());
    engine.resetState();
    setShowConfirmTroca(false);
    setStep(1);
  }, [engine]);

  const handleNovaAnalise = useCallback(() => {
    setPendingTipo(null);
    setPendingCalculateTipo(null);
    pendingCalculateRef.current = null;
    setFormData(defaultFormData());
    engine.resetState();
    setEngineError(null);
    setShowConfirmTroca(false);
    setStep(1);
  }, [engine]);

  const handleGeneratePdf = useCallback(() => {
    if (!engine.ready) {
      setEngineError("Motor de cálculo não está pronto.");
      return;
    }
    if (!engine.results) {
      setEngineError("Não há resultados para gerar relatório.");
      return;
    }
    engine.generatePdf(formData, engine.results);
  }, [formData, engine]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Proceed with client-side cleanup even if request fails
    }
    clearSensitiveData();
    document.cookie = "sb-access-token=; path=/; max-age=0; SameSite=Lax";
    router.push("/auth/login");
    router.refresh();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Carregando...
        </div>
      </div>
    );
  }

  const displayResults = engine.results || loadResult(tipoComparacao);

  return (
    <div className="min-h-screen bg-[#F6F8FB] flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col shrink-0">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center text-white text-sm font-bold">CT</div>
          <span className="font-bold text-slate-800">CompareTributo</span>
        </div>
        <nav className="shrink-0 p-3 md:p-4 flex md:block gap-2 md:space-y-1 overflow-x-auto md:overflow-visible">
          <button onClick={() => setStep(1)}
            className={`min-w-max md:w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              step === 1 ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
            }`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            Simulação
          </button>
          <button onClick={() => setStep(1)}
            className={`min-w-max md:w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              step === 1 ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
            }`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.676 4.5 3.896 4.5 5.118V19.5h15V5.118c0-1.222-.807-2.442-1.907-2.546A48.715 48.715 0 0012 2.25z" />
            </svg>
            Dados
          </button>
          <button onClick={() => step === 2 ? setStep(2) : null}
            className={`min-w-max md:w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              step === 2 ? "bg-blue-50 text-blue-700" : "text-slate-400 cursor-not-allowed"
            }`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            Resultados
          </button>
          <div className="hidden md:block my-4 border-t border-slate-200" />
          <button
            type="button"
            onClick={handleNovaAnalise}
            className="flex h-12 min-w-max md:w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-extrabold uppercase tracking-wide text-white shadow-md shadow-blue-900/10 transition-colors hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
            </svg>
            Nova Simulação
          </button>
          <div className="hidden md:block mt-4 border-t border-slate-200" />
        </nav>
        <div className="hidden md:block p-4 border-t border-slate-100 mt-auto">
          <div className="text-xs text-slate-400 truncate mb-2">{user?.email}</div>
          <button onClick={handleLogout} className="w-full text-left text-sm text-red-500 hover:text-red-600 font-medium">Sair</button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="min-h-16 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-0 shrink-0 shadow-sm shadow-slate-900/5">
          <h1 className="text-lg font-bold text-slate-900">
            {step === 1 ? "Nova Simulação Tributária" : "Diagnóstico Tributário"}
          </h1>
          <div className="flex items-center gap-3 min-w-0">
            {step === 2 && (
              <button onClick={handleTrocarAnalise} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M7.977 14.652H2.985m18.03-9.295v4.992m0 0h-4.992m4.992 0-3.181-3.183a8.25 8.25 0 0 0-13.803 3.7" />
                </svg>
                Alterar Análise
              </button>
            )}
            <span className="hidden sm:inline text-sm text-slate-400 truncate">{user?.email}</span>
            <button onClick={handleLogout} className="md:hidden text-xs text-red-500 hover:text-red-600 font-medium">Sair</button>
          </div>
        </header>

          <div className="flex-1 overflow-auto p-4 sm:p-7">
          <div className="max-w-6xl w-full mx-auto">

            {engineError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-base text-red-600">{engineError}</p>
                {!engine.ready && (
                  <button onClick={() => { setEngineError(null); iframeRef.current?.contentWindow?.location.reload(); }} className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
                    Tentar novamente
                  </button>
                )}
              </div>
            )}

            {engine.loading && (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3 text-slate-500">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  Calculando...
                </div>
              </div>
            )}

            {!engine.loading && step === 1 && (
              <div className="space-y-10">
                <SimulacaoForm data={formData} onChange={setFormData} tipoComparacao={tipoComparacao} showAllFields hideGenerate showHybridInfo={false} />
                <ModoSelecao onSelect={handleSelectTipo} />
              </div>
            )}

            {!engine.loading && step === 2 && (
              <div className="space-y-6">
                {tipoComparacao === "SIMPLES_TRADICIONAL_VS_HIBRIDO" && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 shadow-sm">
                    <strong className="font-semibold">Simulação Híbrida</strong>
                    <p className="mt-1 text-amber-700">
                      Neste cenário, a CBS deixa de ser recolhida dentro do DAS e passa a ser apurada pelo regime regular.
                      O DAS é reduzido pela parcela correspondente da CBS e, posteriormente, é adicionada a CBS líquida apurada fora do DAS.
                    </p>
                  </div>
                )}
                <DashboardResultados
                  results={displayResults}
                  formData={formData}
                  onEdit={handleEdit}
                  onGeneratePdf={handleGeneratePdf}
                  tipoComparacao={tipoComparacao}
                  pdfLoading={engine.pdfLoading}
                  pdfError={engine.pdfError}
                  engineReady={engine.ready}
                />
              </div>
            )}

          </div>
        </div>
      </main>

      {showConfirmTroca && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-800">Descartar dados?</h3>
            <p className="text-sm text-slate-500">Os dados informados nesta simulação serão descartados. Deseja continuar?</p>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { setShowConfirmTroca(false); setPendingTipo(null); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={() => pendingTipo ? confirmChangeTipo(pendingTipo) : confirmVoltarHome()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                Descartar e continuar
              </button>
            </div>
          </div>
        </div>
      )}

      <iframe ref={iframeRef} src="/comparador.html" className="absolute w-px h-px -z-10 opacity-0" title="calc-engine" />
    </div>
  );
}
