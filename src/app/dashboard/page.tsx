"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ProgressBar from "./components/ProgressBar";
import SimulacaoForm, { defaultFormData, type FormData } from "./components/SimulacaoForm";
import DashboardResultados from "./components/DashboardResultados";
import ModoSelecao from "./components/ModoSelecao";
import { useComparadorEngine } from "./hooks/useComparadorEngine";
import { safeStorageGet, safeStorageSet, saveResult, loadResult, clearSensitiveData } from "./components/StorageUtils";
import { STORAGE_KEYS } from "./components/ResultadosTypes";
import type { TipoComparacao } from "./components/ResultadosTypes";

const nomeAnalise: Record<TipoComparacao, string> = {
  SIMPLES_VS_PRESUMIDO: "Simples Nacional × Lucro Presumido",
  SIMPLES_TRADICIONAL_VS_HIBRIDO: "Simples tradicional × Simples híbrido",
  PRESUMIDO_ATUAL_VS_REFORMA: "Lucro Presumido atual × Reforma Tributária",
};

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
  const [user, setUser] = useState<{ email: string } | null>({ email: "dev@local" });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [tipoComparacao, setTipoComparacao] = useState<TipoComparacao>(getInitialTipo);
  const [formData, setFormData] = useState<FormData>(getInitialFormData);
  const [showConfirmTroca, setShowConfirmTroca] = useState(false);
  const [pendingTipo, setPendingTipo] = useState<TipoComparacao | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const engine = useComparadorEngine(iframeRef, tipoComparacao);

  // These effects only write to external storage — not setState
  useEffect(() => { safeStorageSet(STORAGE_KEYS.TIPO, tipoComparacao); }, [tipoComparacao]);
  useEffect(() => { safeStorageSet(STORAGE_KEYS.SIMULACAO, formData); }, [formData]);

  // Save results to storage when engine produces them
  useEffect(() => {
    if (engine.results) {
      saveResult(tipoComparacao, engine.results);
    }
  }, [engine.results, tipoComparacao]);

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

  const handleSelectTipo = useCallback((tipo: TipoComparacao) => {
    if (tipo === tipoComparacao) {
      setStep(1);
      return;
    }
    const hasData = Object.values(formData).some(v => v && v !== "0" && v !== "");
    if (hasData && step > 0) {
      setPendingTipo(tipo);
      setShowConfirmTroca(true);
    } else {
      confirmChangeTipo(tipo);
    }
  }, [tipoComparacao, formData, step, confirmChangeTipo]);

  const handleGenerate = useCallback(() => {
    if (!engine.ready) {
      setEngineError("Preparando motor de cálculo...");
      return;
    }
    engine.calculate(formData);
    setStep(2);
  }, [formData, engine]);

  const handleEdit = useCallback(() => {
    setStep(1);
  }, []);

  const handleTrocarAnalise = useCallback(() => {
    const hasData = Object.values(formData).some(v => v && v !== "0" && v !== "");
    if (hasData) {
      setPendingTipo(null);
      setShowConfirmTroca(true);
    } else {
      setStep(0);
    }
  }, [formData]);

  const confirmVoltarHome = useCallback(() => {
    setFormData(defaultFormData());
    engine.resetState();
    setShowConfirmTroca(false);
    setStep(0);
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
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center text-white text-sm font-bold">CT</div>
          <span className="font-bold text-slate-800">Compare Tributo</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <button onClick={() => step > 0 ? setStep(0) : null}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              step === 0 ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
            }`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            Análise
          </button>
          <button onClick={() => step >= 1 ? setStep(1) : null}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              step === 1 ? "bg-blue-50 text-blue-700" : step > 1 ? "text-slate-600 hover:bg-slate-50" : "text-slate-400 cursor-not-allowed"
            }`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.676 4.5 3.896 4.5 5.118V19.5h15V5.118c0-1.222-.807-2.442-1.907-2.546A48.715 48.715 0 0012 2.25z" />
            </svg>
            Dados
          </button>
          <button onClick={() => step === 2 ? setStep(2) : null}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              step === 2 ? "bg-blue-50 text-blue-700" : "text-slate-400 cursor-not-allowed"
            }`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            Resultados
          </button>
        </nav>
        <div className="p-4 border-t border-slate-100">
          <div className="text-xs text-slate-400 truncate mb-2">{user?.email}</div>
          <button onClick={handleLogout} className="w-full text-left text-sm text-red-500 hover:text-red-600 font-medium">Sair</button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <h1 className="text-lg font-semibold text-slate-800">
            {step === 0
              ? "Selecione a Análise"
              : step === 1
              ? nomeAnalise[tipoComparacao]
              : "Diagnóstico Tributário"}
          </h1>
          <div className="flex items-center gap-3">
            {(step === 1 || step === 2) && (
              <button onClick={handleTrocarAnalise} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                Trocar análise
              </button>
            )}
            <span className="text-sm text-slate-400">{user?.email}</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <div className={step === 0 ? "max-w-5xl mx-auto" : "max-w-6xl w-[calc(100%-48px)] mx-auto"}>

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

            {step > 0 && <ProgressBar step={step} />}

            {engine.loading && (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3 text-slate-500">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  Calculando...
                </div>
              </div>
            )}

            {!engine.loading && step === 0 && <ModoSelecao onSelect={handleSelectTipo} />}

            {!engine.loading && step === 1 && (
              <SimulacaoForm data={formData} onChange={setFormData} onGenerate={handleGenerate} tipoComparacao={tipoComparacao} />
            )}

            {!engine.loading && step === 2 && (
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
