export type ComparisonRegime = {
  name: string;
  total: number;
};

export type ComparisonDecision = {
  winner: ComparisonRegime | null;
  loser: ComparisonRegime | null;
  difference: number;
  differencePercent: number;
  annualDifference: number;
  monthlyDifference: number;
  type: "economia" | "aumento" | "empate";
  color: "green" | "red" | "neutral";
  icon: "trending-down" | "trending-up" | "minus";
  recommendation: string;
};

const EPSILON = 0.005;

const validTotal = (value: number) => Number.isFinite(value) ? value : 0;

export function getComparisonDecision({
  regimeA,
  regimeB,
}: {
  regimeA: ComparisonRegime;
  regimeB: ComparisonRegime;
}): ComparisonDecision {
  const totalA = validTotal(regimeA.total);
  const totalB = validTotal(regimeB.total);

  if (Math.abs(totalA - totalB) <= EPSILON) {
    return {
      winner: null,
      loser: null,
      difference: 0,
      differencePercent: 0,
      annualDifference: 0,
      monthlyDifference: 0,
      type: "empate",
      color: "neutral",
      icon: "minus",
      recommendation: "Empate",
    };
  }

  const isEconomia = totalB < totalA;
  const winner = isEconomia ? regimeB : regimeA;
  const loser = isEconomia ? regimeA : regimeB;
  const difference = Math.abs(totalA - totalB);

  return {
    winner,
    loser,
    difference,
    differencePercent: totalA > 0 ? difference / totalA * 100 : 0,
    annualDifference: difference,
    monthlyDifference: difference / 12,
    type: isEconomia ? "economia" : "aumento",
    color: isEconomia ? "green" : "red",
    icon: isEconomia ? "trending-down" : "trending-up",
    recommendation: winner.name,
  };
}
