import type { MemoryItem } from "./CalculationMemory";

type AnyRecord = Record<string, unknown>;

const EPSILON = 0.005;

const ORDER = ["IRPJ", "IRPJ Adicional", "CSLL", "PIS/COFINS", "CBS", "IBS", "ISS", "ICMS", "IPI"];

export const n = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;

const isPositive = (value: unknown) => n(value) > EPSILON;

const effective = (value: number, revenue: number) => revenue > 0 ? value / revenue * 100 : 0;

function sortItems(items: MemoryItem[]) {
  return items.sort((a, b) => {
    const ai = ORDER.indexOf(a.label);
    const bi = ORDER.indexOf(b.label);
    return (ai === -1 ? ORDER.length : ai) - (bi === -1 ? ORDER.length : bi);
  });
}

export function buildTaxCompositionItems(input: {
  scenario: AnyRecord;
  revenue: number;
  baseIRPJ?: number;
  baseCSLL?: number;
  presIRPJ?: number;
  presCSLL?: number;
  rates?: Partial<Record<"iss" | "icms" | "ipi" | "cbs" | "ibs", number>>;
  cbsValue?: number;
  ibsValue?: number;
}): MemoryItem[] {
  const { scenario, revenue, rates = {} } = input;
  const irpj = n(scenario.irpj15);
  const irpjAdic = n(scenario.irpjAdic);
  const csll = n(scenario.csll);
  const pisCofins = n(scenario.pisCofins) || n(scenario.pis) + n(scenario.cofins);
  const cbs = n(input.cbsValue) || n(scenario.cbs);
  const ibs = n(input.ibsValue) || n(scenario.ibs);
  const iss = n(scenario.iss);
  const icms = n(scenario.icms);
  const ipi = n(scenario.ipi);
  const baseIRPJ = n(input.baseIRPJ) || n(scenario.baseIRPJ);
  const baseCSLL = n(input.baseCSLL) || n(scenario.baseCSLL);
  const presIRPJ = n(input.presIRPJ) || (revenue > 0 && baseIRPJ > 0 ? baseIRPJ / revenue * 100 : 0);
  const presCSLL = n(input.presCSLL) || (revenue > 0 && baseCSLL > 0 ? baseCSLL / revenue * 100 : 0);
  const items: MemoryItem[] = [];

  if (isPositive(irpj)) items.push({ label: "IRPJ", base: revenue, presumption: presIRPJ, taxRate: 15, effectiveRate: effective(irpj, revenue), value: irpj });
  if (isPositive(irpjAdic)) items.push({ label: "IRPJ Adicional", base: n(scenario.baseAdic), presumedBase: n(scenario.baseAdic), taxRate: 10, effectiveRate: effective(irpjAdic, revenue), value: irpjAdic });
  if (isPositive(csll)) items.push({ label: "CSLL", base: revenue, presumption: presCSLL, taxRate: 9, effectiveRate: effective(csll, revenue), value: csll });
  if (isPositive(pisCofins)) items.push({ label: "PIS/COFINS", base: revenue, taxRate: 3.65, effectiveRate: effective(pisCofins, revenue), value: pisCofins });
  if (isPositive(cbs)) items.push({ label: "CBS", base: revenue, taxRate: n(rates.cbs), effectiveRate: effective(cbs, revenue), value: cbs });
  if (isPositive(ibs)) items.push({ label: "IBS", base: revenue, taxRate: n(rates.ibs), effectiveRate: effective(ibs, revenue), value: ibs });
  if (isPositive(iss)) items.push({ label: "ISS", base: revenue, taxRate: n(rates.iss), effectiveRate: effective(iss, revenue), value: iss });
  if (isPositive(icms)) items.push({ label: "ICMS", base: revenue, taxRate: n(rates.icms), effectiveRate: effective(icms, revenue), value: icms });
  if (isPositive(ipi)) items.push({ label: "IPI", base: revenue, taxRate: n(rates.ipi) || effective(ipi, revenue), effectiveRate: effective(ipi, revenue), value: ipi });

  return sortItems(items);
}

export function buildTaxCompositionItemsFromRows(rows: AnyRecord[]): MemoryItem[] {
  const values = new Map<string, number>();

  for (const row of rows) {
    if (row.total) continue;
    const value = n(row.valorAnual);
    if (!isPositive(value)) continue;
    const raw = String(row.tributo || "").trim().toUpperCase();
    if (!raw) continue;
    const label = raw === "PIS" || raw === "COFINS" ? "PIS/COFINS" : raw === "ADICIONAL IRPJ" ? "IRPJ Adicional" : raw;
    values.set(label, (values.get(label) || 0) + value);
  }

  return sortItems(Array.from(values, ([label, value]) => ({ label, value })));
}
