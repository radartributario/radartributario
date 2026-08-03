import CalculationMemory from "./CalculationMemory";
import type { MemoryCardData } from "./CalculationMemory";

export default function MemoryReforma({ description, cards, observation }: { description: string; cards: MemoryCardData[]; observation?: string }) {
  return <CalculationMemory description={description} cards={cards} observation={observation} />;
}
