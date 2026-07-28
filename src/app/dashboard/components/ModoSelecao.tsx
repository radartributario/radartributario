"use client";

export type TipoComparacao =
  | "SIMPLES_VS_PRESUMIDO"
  | "SIMPLES_TRADICIONAL_VS_HIBRIDO"
  | "PRESUMIDO_ATUAL_VS_REFORMA";

interface ModoSelecaoProps {
  onSelect: (tipo: TipoComparacao) => void;
}

const modos: {
  id: TipoComparacao;
  icon: string;
  titulo: string;
  subtitulo: string;
  descricao: string;
  botao: string;
  selo?: { texto: string; cor: string };
}[] = [
  {
    id: "SIMPLES_VS_PRESUMIDO",
    icon: "\u2696\uFE0F",
    titulo: "Simples Nacional \u00D7 Lucro Presumido",
    subtitulo: "Compara\u00E7\u00E3o entre regimes atuais",
    descricao:
      "Compare a carga tribut\u00E1ria estimada do Simples Nacional com o Lucro Presumido, considerando faturamento, atividade, folha, compras e tributos aplic\u00E1veis.",
    botao: "Iniciar compara\u00E7\u00E3o",
  },
  {
    id: "SIMPLES_TRADICIONAL_VS_HIBRIDO",
    icon: "\u{1F500}",
    titulo: "Simples tradicional \u00D7 Simples h\u00EDbrido",
    subtitulo: "Avalia\u00E7\u00E3o da op\u00E7\u00E3o da CBS pelo regime regular",
    descricao:
      "Compare a perman\u00EAncia integral no Simples Nacional com a op\u00E7\u00E3o de apurar a CBS pelo regime regular, fora do DAS.",
    botao: "Avaliar op\u00E7\u00E3o h\u00EDbrida",
    selo: { texto: "Reforma Tribut\u00E1ria", cor: "amber" },
  },
  {
    id: "PRESUMIDO_ATUAL_VS_REFORMA",
    icon: "\u{1F4C8}",
    titulo: "Lucro Presumido atual \u00D7 Reforma Tribut\u00E1ria",
    subtitulo: "Impacto da substitui\u00E7\u00E3o dos tributos sobre o consumo",
    descricao:
      "Compare a tributa\u00E7\u00E3o atual do Lucro Presumido com o cen\u00E1rio futuro de CBS e IBS, conforme os par\u00E2metros informados.",
    botao: "Analisar impacto",
    selo: { texto: "Reforma Tribut\u00E1ria", cor: "amber" },
  },
];

export default function ModoSelecao({ onSelect }: ModoSelecaoProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-slate-800">
          Qual análise você deseja realizar?
        </h2>
        <p className="text-sm text-slate-500">
          Selecione o tipo de comparação tributária para iniciar
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {modos.map((modo) => (
          <button
            key={modo.id}
            onClick={() => onSelect(modo.id)}
            className="group relative flex flex-col items-start text-left p-6 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all duration-200 cursor-pointer"
          >
            {modo.selo && (
              <span
                className={`absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  modo.selo.cor === "amber"
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-blue-50 text-blue-700 border border-blue-200"
                }`}
              >
                {modo.selo.texto}
              </span>
            )}

            <span className="text-2xl mb-3">{modo.icon}</span>

            <h3 className="text-base font-semibold text-slate-800 leading-snug mb-1">
              {modo.titulo}
            </h3>

            <span className="text-xs font-medium text-blue-600 mb-3">
              {modo.subtitulo}
            </span>

            <p className="text-sm text-slate-500 leading-relaxed mb-5 flex-1">
              {modo.descricao}
            </p>

            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-50 text-slate-700 text-sm font-medium border border-slate-200 group-hover:bg-blue-50 group-hover:text-blue-700 group-hover:border-blue-200 transition-colors">
              {modo.botao}
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
