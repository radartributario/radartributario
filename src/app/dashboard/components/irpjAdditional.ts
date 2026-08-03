export function calculateIrpjAdditional(basePresumidaIRPJ: number) {
  const baseExcedente = Math.max(0, (Number.isFinite(basePresumidaIRPJ) ? basePresumidaIRPJ : 0) - 60000);
  return { baseExcedente, valor: baseExcedente * 0.10 };
}
