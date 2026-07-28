"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export function formatCurrencyBRL(value: number): string {
  if (!isFinite(value) || value < 0) return "0,00";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseCurrencyBRL(str: string): number {
  if (!str) return 0;
  let s = str.replace(/[R$\s]/g, "").trim();
  if (!s) return 0;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastComma > lastDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(",", "");
  }
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

interface CurrencyInputProps {
  value: string;
  onChange: (val: string) => void;
  id?: string;
  className?: string;
  placeholder?: string;
  inputMode?: "numeric" | "text";
}

function digitsToBRL(raw: string): string {
  if (!raw) return "";
  const n = parseInt(raw, 10) / 100;
  return formatCurrencyBRL(n);
}

function brlToDigits(brl: string): string {
  const n = parseCurrencyBRL(brl);
  return Math.round(n * 100).toString();
}

export default function CurrencyInput({
  value,
  onChange,
  id,
  className = "",
  placeholder = "0,00",
  inputMode = "numeric",
}: CurrencyInputProps) {
  const [display, setDisplay] = useState(value || "");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== ref.current) {
      setDisplay(value || "");
    }
  }, [value]);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, "");
      const formatted = digitsToBRL(raw);
      setDisplay(formatted);
      onChange(formatted);
    },
    [onChange]
  );

  const handleBlur = useCallback(() => {
    const raw = display.replace(/\D/g, "");
    const formatted = digitsToBRL(raw);
    setDisplay(formatted);
    onChange(formatted);
  }, [display, onChange]);

  const handleFocus = useCallback(() => {
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      id={id}
      type="text"
      value={display}
      onChange={handleInput}
      onBlur={handleBlur}
      onFocus={handleFocus}
      inputMode={inputMode}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
    />
  );
}

export { CurrencyInput };
