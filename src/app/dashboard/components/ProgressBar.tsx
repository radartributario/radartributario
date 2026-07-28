"use client";

export default function ProgressBar({ step }: { step: 0 | 1 | 2 }) {
  return (
    <div className="flex items-center gap-3 mb-6 px-1">
      <div className="flex items-center gap-2 text-sm">
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          step >= 1 ? "bg-blue-700 text-white" : "bg-slate-200 text-slate-400"
        }`}>1</span>
        <span className={step === 1 ? "text-blue-700 font-medium" : "text-slate-400"}>Dados</span>
      </div>
      <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden max-w-[120px]">
        <div className={`h-full bg-blue-700 rounded-full transition-all duration-300 ${
          step === 1 ? "w-0" : "w-full"
        }`} />
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          step === 2 ? "bg-blue-700 text-white" : "bg-slate-200 text-slate-400"
        }`}>2</span>
        <span className={step === 2 ? "text-blue-700 font-medium" : "text-slate-400"}>Resultado</span>
      </div>
    </div>
  );
}
