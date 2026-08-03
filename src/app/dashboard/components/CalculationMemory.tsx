"use client";

import { useState } from "react";
import { fmt, fmtPct } from "./DashboardDS";

export type MemoryItem = {
  label: string;
  value: number;
  base?: number;
  presumption?: number;
  presumedBase?: number;
  taxRate?: number;
  effectiveRate?: number;
};

export type MemoryDetailGroup = {
  title: string;
  rows?: { label: string; value: string; emphasis?: boolean }[];
  table?: {
    headers: string[];
    rows: { cells: string[]; emphasis?: boolean }[];
  };
};

export type MemoryCardData = {
  title: string;
  tone?: "current" | "compared";
  summaryType?: "default" | "simple";
  items: MemoryItem[];
  totalLabel?: string;
  total: number;
  effectiveRate: number;
  observation?: string;
  details?: MemoryDetailGroup[];
};

function SimpleSummaryTable({ items, total, effectiveRate, totalLabel }: { items: MemoryItem[]; total: number; effectiveRate: number; totalLabel?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#D9E2EC] bg-white">
      <table className="w-full table-fixed text-[13px] sm:text-[14px]">
        <colgroup><col className="w-[58%]" /><col className="w-[42%]" /></colgroup>
        <thead className="bg-slate-100 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
          <tr><th className="px-3 py-3 text-left">Tributo</th><th className="px-3 py-3 text-right">Valor Anual</th></tr>
        </thead>
        <tbody>
          {items.map((item) => <tr key={item.label} className="border-b border-[#E6EDF5]"><td className="px-3 py-2 font-bold text-slate-700">{item.label}</td><td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums text-slate-950 [font-variant-numeric:tabular-nums]">R$ {fmt(item.value)}</td></tr>)}
          <tr className="bg-blue-50"><td className="px-3 py-3 font-extrabold uppercase tracking-wide text-slate-800">{totalLabel || "TOTAL"}</td><td className="whitespace-nowrap px-3 py-3 text-right font-extrabold tabular-nums text-blue-900 [font-variant-numeric:tabular-nums]">R$ {fmt(total)}</td></tr>
          <tr className="bg-blue-50/70"><td className="px-3 py-3 font-extrabold text-slate-700">Alíquota Efetiva Total</td><td className="whitespace-nowrap px-3 py-3 text-right font-extrabold tabular-nums text-blue-800 [font-variant-numeric:tabular-nums]">{fmtPct(effectiveRate)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function SummaryTable({ items, total, effectiveRate, totalLabel }: { items: MemoryItem[]; total: number; effectiveRate: number; totalLabel?: string }) {
  const visible = items.filter((item) => item.value !== 0);

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#D9E2EC] bg-white">
      <table className="w-full min-w-[980px] table-fixed text-[13px] sm:text-[14px]">
        <colgroup><col className="w-[16%]" /><col className="w-[17%]" /><col className="w-[13%]" /><col className="w-[17%]" /><col className="w-[13%]" /><col className="w-[12%]" /><col className="w-[12%]" /></colgroup>
        <thead className="bg-slate-100 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
          <tr><th className="px-3 py-3 text-left">Tributo</th><th className="px-3 py-3 text-right">Receita/Base</th><th className="px-3 py-3 text-right">Presunção</th><th className="px-3 py-3 text-right">Base Presumida</th><th className="px-3 py-3 text-right">Alíquota do Tributo</th><th className="px-3 py-3 text-right">Alíquota Efetiva</th><th className="px-3 py-3 text-right">Valor</th></tr>
        </thead>
        <tbody>
          {visible.map((item) => <tr key={item.label} className="border-b border-[#E6EDF5]"><td className="px-3 py-2 font-bold text-slate-700">{item.label}</td><td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-slate-600 [font-variant-numeric:tabular-nums]">{typeof item.base === "number" ? `R$ ${fmt(item.base)}` : "-"}</td><td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-slate-600 [font-variant-numeric:tabular-nums]">{typeof item.presumption === "number" ? fmtPct(item.presumption) : "-"}</td><td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-slate-600 [font-variant-numeric:tabular-nums]">{typeof item.presumedBase === "number" ? `R$ ${fmt(item.presumedBase)}` : typeof item.presumption === "number" && typeof item.base === "number" ? `R$ ${fmt(item.base * item.presumption / 100)}` : "-"}</td><td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-slate-600 [font-variant-numeric:tabular-nums]">{typeof item.taxRate === "number" ? fmtPct(item.taxRate) : "-"}</td><td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-slate-600 [font-variant-numeric:tabular-nums]">{typeof item.effectiveRate === "number" ? fmtPct(item.effectiveRate) : "-"}</td><td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums text-slate-950 [font-variant-numeric:tabular-nums]">R$ {fmt(item.value)}</td></tr>)}
          <tr className="bg-blue-50"><td className="px-3 py-3 font-extrabold uppercase tracking-wide text-slate-800">{totalLabel || "TOTAL"}</td><td className="px-3 py-3" /><td className="px-3 py-3" /><td className="px-3 py-3" /><td className="px-3 py-3" /><td className="whitespace-nowrap px-3 py-3 text-right font-extrabold tabular-nums text-blue-800 [font-variant-numeric:tabular-nums]">{fmtPct(effectiveRate)}</td><td className="whitespace-nowrap px-3 py-3 text-right font-extrabold tabular-nums text-blue-900 [font-variant-numeric:tabular-nums]">R$ {fmt(total)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function DetailMatrix({ group }: { group: MemoryDetailGroup }) {
  if (group.table) {
    return (
      <div className="overflow-x-auto rounded-2xl border border-[#D9E2EC] bg-white">
        <table className="w-full min-w-[760px] table-fixed text-[13px]">
          <thead className="bg-slate-100 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
            <tr>{group.table.headers.map((header) => <th key={header} className="px-3 py-3 text-left last:text-right">{header}</th>)}</tr>
          </thead>
          <tbody>
            {group.table.rows.map((row, index) => <tr key={index} className={`${row.emphasis ? "bg-blue-50" : ""} border-t border-[#E6EDF5]`}>
              {row.cells.map((cell, cellIndex) => <td key={cellIndex} className={`${cellIndex === 0 ? "font-bold text-slate-800" : "font-semibold text-slate-600"} ${cellIndex === row.cells.length - 1 ? "text-right font-extrabold text-slate-950" : ""} whitespace-nowrap px-3 py-2 tabular-nums [font-variant-numeric:tabular-nums]`}>{cell}</td>)}
            </tr>)}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#D9E2EC] bg-white">
      <div className="border-b border-[#D9E2EC] bg-slate-100 px-3 py-3 text-[12px] font-extrabold uppercase tracking-wide text-slate-600">{group.title}</div>
      <table className="w-full table-fixed text-[14px]">
        <colgroup><col className="w-[55%]" /><col className="w-[45%]" /></colgroup>
        <tbody>{(group.rows || []).map((row) => <tr key={row.label} className={`${row.emphasis ? "bg-blue-50" : ""} border-b border-[#E6EDF5] last:border-b-0`}><td className="px-3 py-2 font-semibold text-slate-500">{row.label}</td><td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums text-slate-900 [font-variant-numeric:tabular-nums]">{row.value}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function DetailTable({ groups }: { groups: MemoryDetailGroup[] }) {
  return <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{groups.map((group) => <div key={group.title} className={group.table ? "lg:col-span-2" : undefined}>{group.table && <p className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-slate-500">{group.title}</p>}<DetailMatrix group={group} /></div>)}</div>;
}

function MemoryCard({ card }: { card: MemoryCardData }) {
  const [open, setOpen] = useState(false);
  const bg = card.tone === "compared" ? "bg-[#F2FBF7]" : "bg-[#F7F9FC]";
  const hasDetails = !!card.details?.length;
  const useSimpleTable = card.summaryType === "simple";
  const useSummaryTable = card.items.some((item) => item.base !== undefined || item.taxRate !== undefined || item.effectiveRate !== undefined);

  return (
    <div className={`rounded-3xl border border-[#D9E2EC] ${bg} p-5`} data-testid="memory-card">
      <h3 className="text-[20px] font-bold text-slate-900">{card.title}</h3>
      <div className="mt-3 border-t border-[#D9E2EC] pt-3">
        {useSimpleTable ? <SimpleSummaryTable items={card.items} total={card.total} effectiveRate={card.effectiveRate} totalLabel={card.totalLabel} /> : useSummaryTable ? <SummaryTable items={card.items} total={card.total} effectiveRate={card.effectiveRate} totalLabel={card.totalLabel} /> : <><div className="space-y-2">{card.items.filter((item) => item.value !== 0).map((item) => <div key={item.label} className="flex items-center justify-between gap-4 text-[15px]"><span className="font-medium text-slate-600">{item.label}</span><span className="whitespace-nowrap text-[16px] font-bold tabular-nums text-slate-950 [font-variant-numeric:tabular-nums]">R$ {fmt(item.value)}</span></div>)}</div><div className="mt-4 border-t-2 border-[#D9E2EC] pt-3"><div className="flex items-center justify-between gap-4"><span className="text-[16px] font-bold uppercase tracking-wide text-slate-800">{card.totalLabel || "TOTAL"}</span><span className="whitespace-nowrap text-[18px] font-bold tabular-nums text-blue-900 [font-variant-numeric:tabular-nums]">R$ {fmt(card.total)}</span></div><div className="mt-1 flex items-center justify-between gap-4"><span className="text-[14px] font-semibold text-slate-500">Alíquota Efetiva Total</span><span className="whitespace-nowrap text-[16px] font-bold tabular-nums text-blue-800 [font-variant-numeric:tabular-nums]">{fmtPct(card.effectiveRate)}</span></div></div></>}
        {card.observation && <p className="mt-3 text-[13px] font-normal leading-5 text-slate-500">{card.observation}</p>}
        {hasDetails && <div className="mt-3"><button type="button" onClick={() => setOpen((value) => !value)} className="text-[12px] font-extrabold uppercase tracking-wide text-blue-700 hover:text-blue-900">{open ? "▲ Ocultar memória detalhada" : "▼ Ver memória detalhada"}</button>{open && <div className="mt-3"><DetailTable groups={card.details!} /></div>}</div>}
      </div>
    </div>
  );
}

export default function CalculationMemory({ description, cards, observation }: { description: string; cards: MemoryCardData[]; observation?: string }) {
  return (
    <section className="rounded-3xl bg-[#F3F6FA] p-5 ring-1 ring-[#D9E2EC]" data-testid="calculation-memory-section">
      <h2 className="text-[28px] font-bold text-slate-950">Memória de Cálculo</h2>
      <p className="mt-1 text-[14px] font-semibold text-slate-600">{description}</p>
      <div className="mt-5 space-y-4">{cards.map((card) => <MemoryCard key={card.title} card={card} />)}</div>
      {observation && <p className="mt-4 text-[13px] font-normal leading-5 text-slate-500">{observation}</p>}
    </section>
  );
}
