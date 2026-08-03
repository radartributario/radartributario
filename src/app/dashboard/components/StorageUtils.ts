import { STORAGE_KEYS, STORAGE_SCHEMA_VERSION, getStorageKeyForTipo, type TipoComparacao } from "./ResultadosTypes";

interface StoredResult {
  version: number;
  updatedAt: string;
  tipoComparacao: TipoComparacao;
  data: Record<string, unknown>;
}

export function safeStorageGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function safeStorageSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      console.warn("Storage quota exceeded");
    }
  }
}

export function safeStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Silently ignore
  }
}

export function saveResult(
  tipoComparacao: TipoComparacao,
  data: Record<string, unknown>
): void {
  const stored: StoredResult = {
    version: STORAGE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    tipoComparacao,
    data,
  };
  safeStorageSet(getStorageKeyForTipo(tipoComparacao), stored);
}

export function loadResult(
  tipoComparacao: TipoComparacao
): Record<string, unknown> | null {
  const stored = safeStorageGet<StoredResult>(getStorageKeyForTipo(tipoComparacao));
  if (!stored) return null;
  if (stored.version !== STORAGE_SCHEMA_VERSION) return null;
  if (stored.tipoComparacao !== tipoComparacao) return null;
  if (!stored.data || typeof stored.data !== "object") return null;
  return stored.data;
}

export function clearAllResults(): void {
  safeStorageRemove(STORAGE_KEYS.RESULTADOS_SIMPLES_VS_PRESUMIDO);
  safeStorageRemove(STORAGE_KEYS.RESULTADOS_SIMPLES_TRADICIONAL_VS_HIBRIDO);
  safeStorageRemove(STORAGE_KEYS.RESULTADOS_PRESUMIDO_ATUAL_VS_REFORMA);
}

export function clearSensitiveData(): void {
  clearAllResults();
  safeStorageRemove("ct_simulacao");
  removeCnpjData();
}

function removeCnpjData(): void {
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith("cnpj_") || key.includes("razao") || key.includes("empresa")) {
        safeStorageRemove(key);
      }
    }
  } catch {
    // Silently ignore
  }
}
