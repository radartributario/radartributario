import type { MemoryCardData, MemoryItem } from "./CalculationMemory";

type MemorySimplesAtualInput = {
  title: string;
  tone?: MemoryCardData["tone"];
  items: MemoryItem[];
  total: number;
  effectiveRate: number;
  observation?: string;
};

export function buildMemorySimplesAtualCard({ title, tone, items, total, effectiveRate, observation }: MemorySimplesAtualInput): MemoryCardData {
  return {
    title,
    tone,
    summaryType: "simple",
    items: items.filter((item) => {
      const label = item.label.toUpperCase();
      return label !== "CBS" && label !== "IBS" && item.value > 0;
    }),
    total,
    effectiveRate,
    observation,
  };
}
