import type { MemoryCardData, MemoryItem } from "./CalculationMemory";
import { buildTaxCompositionItemsFromRows } from "./taxComposition";

type AnyRecord = Record<string, unknown>;

export function buildMemorySimplesHibridoItems(rows: AnyRecord[], isCommerce: boolean, isIndustry: boolean, ibsHasImpact: boolean): MemoryItem[] {
  const normalizedRows = rows.map((row) => {
    const label = String(row.tributo || "").trim().toUpperCase();
    if (label === "ISS" && (isCommerce || isIndustry)) return { ...row, tributo: "ICMS" };
    return row;
  });
  const items = buildTaxCompositionItemsFromRows(normalizedRows);
  return ibsHasImpact ? items : items.filter((item) => item.label !== "IBS");
}

type MemorySimplesHibridoInput = {
  title: string;
  tone?: MemoryCardData["tone"];
  items: MemoryItem[];
  total: number;
  effectiveRate: number;
  observation?: string;
};

export function buildMemorySimplesHibridoCard({ title, tone, items, total, effectiveRate, observation }: MemorySimplesHibridoInput): MemoryCardData {
  return {
    title,
    tone,
    summaryType: "simple",
    items,
    total,
    effectiveRate,
    observation,
  };
}
