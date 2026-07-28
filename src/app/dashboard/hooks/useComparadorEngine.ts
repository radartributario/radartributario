import { useEffect, useRef, useState, useCallback } from "react";
import type {
  TipoComparacao,
  EngineMessage,
  AppMessage,
  CalculateRequest,
  CalculateResponse,
  CalculateSuccessResponse,
  CalculateErrorResponse,
  PdfRequest,
  PdfResponse,
  PdfErrorResponse,
} from "../components/ResultadosTypes";

const CALC_TIMEOUT = 30000;
const PDF_TIMEOUT = 30000;

interface EngineState {
  ready: boolean;
  engineVersion: string;
  loading: boolean;
  error: string | null;
  results: Record<string, unknown> | null;
  pdfLoading: boolean;
  pdfError: string | null;
  requestId: string | null;
}

export function useComparadorEngine(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  tipoComparacao: TipoComparacao
) {
  const [state, setState] = useState<EngineState>({
    ready: false,
    engineVersion: "",
    loading: false,
    error: null,
    results: null,
    pdfLoading: false,
    pdfError: null,
    requestId: null,
  });

  const currentRequestId = useRef<string | null>(null);
  const calcTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pdfTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const engineReadyRef = useRef(false);
  const disposedRef = useRef(false);

  const previousTipo = useRef(tipoComparacao);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const clearCalcTimeout = useCallback(() => {
    if (calcTimeoutRef.current) {
      clearTimeout(calcTimeoutRef.current);
      calcTimeoutRef.current = null;
    }
  }, []);

  const clearPdfTimeout = useCallback(() => {
    if (pdfTimeoutRef.current) {
      clearTimeout(pdfTimeoutRef.current);
      pdfTimeoutRef.current = null;
    }
  }, []);

  // Reset state when tipoComparacao changes
  useEffect(() => {
    if (tipoComparacao !== previousTipo.current) {
      previousTipo.current = tipoComparacao;
      clearCalcTimeout();
      clearPdfTimeout();
      currentRequestId.current = null;
      setState((prev) => ({
        ...prev,
        loading: false,
        error: null,
        pdfLoading: false,
        pdfError: null,
        requestId: null,
      }));
    }
  }, [tipoComparacao, clearCalcTimeout, clearPdfTimeout]);

  const resetState = useCallback(() => {
    clearCalcTimeout();
    currentRequestId.current = null;
    setState((prev) => ({
      ...prev,
      loading: false,
      error: null,
      pdfLoading: false,
      pdfError: null,
      requestId: null,
    }));
  }, [clearCalcTimeout]);

  const handleMessage = useCallback(
    (e: MessageEvent) => {
      if (disposedRef.current) return;

      // Validate origin
      if (e.origin !== origin) return;

      // Validate source
      if (e.source !== iframeRef.current?.contentWindow) return;

      if (!e.data || !e.data.type) return;

      const msg = e.data as EngineMessage;
      switch (msg.type) {
        case "engineReady": {
          engineReadyRef.current = true;
          setState((prev) => ({
            ...prev,
            ready: true,
            engineVersion: msg.engineVersion || "1.0.0",
          }));
          break;
        }

        case "resultado": {
          const resp = msg as CalculateResponse;
          if (resp.requestId !== currentRequestId.current) {
            console.warn("Ignoring stale response for requestId:", resp.requestId);
            return;
          }
          clearCalcTimeout();
          currentRequestId.current = null;
          if (resp.success) {
            setState((prev) => ({
              ...prev,
              loading: false,
              results: (msg as CalculateSuccessResponse).data,
              error: null,
              requestId: null,
            }));
          } else {
            const errResp = msg as CalculateErrorResponse;
            setState((prev) => ({
              ...prev,
              loading: false,
              results: null,
              error: errResp.error?.message || "Erro no cálculo",
              requestId: null,
            }));
          }
          break;
        }

        case "pdfHtml": {
          const pdfResp = msg as PdfResponse;
          if (pdfResp.requestId !== currentRequestId.current) {
            console.warn("Ignoring stale PDF response for requestId:", pdfResp.requestId);
            return;
          }
          clearPdfTimeout();
          currentRequestId.current = null;
          if (pdfResp.success) {
            if (pdfResp.html) {
              const w = window.open("", "_blank");
              if (w) {
                w.document.write(pdfResp.html);
                w.document.close();
                setTimeout(() => { w.focus(); w.print(); }, 300);
              } else {
                setState((prev) => ({ ...prev, pdfLoading: false, pdfError: "Pop-up bloqueado. Permita pop-ups para gerar o relatório." }));
              }
            }
            setState((prev) => ({ ...prev, pdfLoading: false, pdfError: null }));
          } else {
            const errResp = msg as PdfErrorResponse;
            setState((prev) => ({
              ...prev,
              pdfLoading: false,
              pdfError: errResp.error?.message || "Erro ao gerar relatório",
            }));
          }
          break;
        }
      }
    },
    [origin, iframeRef, clearCalcTimeout, clearPdfTimeout]
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [handleMessage]);

  // Send enginePing after mount so iframe resends engineReady if missed
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      const t = setTimeout(() => {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: "enginePing" }, origin);
        }
      }, 100);
      return () => clearTimeout(t);
    }
  }, [origin, iframeRef]);

  // Reload iframe if engine not ready after mount (handles Fast Refresh)
  useEffect(() => {
    if (!engineReadyRef.current && iframeRef.current) {
      const t = setTimeout(() => {
        if (!engineReadyRef.current && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.location.reload();
        }
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [iframeRef]);

  // Reset disposed on mount, cleanup on unmount (Strict Mode remounts)
  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      clearCalcTimeout();
      clearPdfTimeout();
    };
  }, [clearCalcTimeout, clearPdfTimeout]);

  const sendMessage = useCallback(
    (msg: AppMessage) => {
      if (!iframeRef.current?.contentWindow) return;
      iframeRef.current.contentWindow.postMessage(msg, origin);
    },
    [origin, iframeRef]
  );

  const calculate = useCallback(
    (data: Record<string, string>) => {
      if (!engineReadyRef.current) {
        setState((prev) => ({ ...prev, error: "Motor de cálculo não está pronto." }));
        return;
      }

      clearCalcTimeout();

      const requestId = crypto.randomUUID();
      currentRequestId.current = requestId;

      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
        results: null,
        requestId,
      }));

      const msg: CalculateRequest = {
        type: "calcular",
        requestId,
        tipoComparacao,
        data,
      };

      sendMessage(msg);

      calcTimeoutRef.current = setTimeout(() => {
        if (currentRequestId.current === requestId) {
          currentRequestId.current = null;
          setState((prev) => ({
            ...prev,
            loading: false,
            error: "Não foi possível concluir o cálculo. Tente novamente.",
            requestId: null,
          }));
          console.warn(`Calculation timeout for requestId=${requestId} tipo=${tipoComparacao} elapsed=${CALC_TIMEOUT}ms`);
        }
      }, CALC_TIMEOUT);
    },
    [tipoComparacao, sendMessage, clearCalcTimeout]
  );

  const generatePdf = useCallback(
    (data: Record<string, string>, resultadoAtual: Record<string, unknown>) => {
      if (!engineReadyRef.current) {
        setState((prev) => ({ ...prev, pdfError: "Motor de cálculo não está pronto." }));
        return;
      }

      clearPdfTimeout();

      const requestId = crypto.randomUUID();
      currentRequestId.current = requestId;

      setState((prev) => ({
        ...prev,
        pdfLoading: true,
        pdfError: null,
        requestId,
      }));

      const msg: PdfRequest = {
        type: "exportPdf",
        requestId,
        tipoComparacao,
        data,
        resultadoAtual,
      };

      sendMessage(msg);

      pdfTimeoutRef.current = setTimeout(() => {
        if (currentRequestId.current === requestId) {
          currentRequestId.current = null;
          setState((prev) => ({
            ...prev,
            pdfLoading: false,
            pdfError: "Não foi possível gerar o relatório. Tente novamente.",
            requestId: null,
          }));
          console.warn(`PDF timeout for requestId=${requestId} tipo=${tipoComparacao} elapsed=${PDF_TIMEOUT}ms`);
        }
      }, PDF_TIMEOUT);
    },
    [tipoComparacao, sendMessage, clearPdfTimeout]
  );

  return {
    ...state,
    calculate,
    generatePdf,
    resetState,
  };
}
