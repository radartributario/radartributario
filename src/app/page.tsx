import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center text-white text-sm font-bold">
              RT
            </div>
            <span className="font-bold text-slate-800 text-lg">Radar Tributário</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm text-slate-600 hover:text-slate-800 font-medium px-4 py-2"
            >
              Entrar
            </Link>
            <Link
              href="/auth/register"
              className="text-sm bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg font-medium transition-colors"
            >
              Cadastrar Gratuito
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-4 py-1.5 text-sm text-blue-700 font-medium mb-8">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Plataforma gratuita para contadores e empresas
            </div>
            <h1 className="text-5xl font-bold text-slate-900 leading-tight mb-6">
              Sua empresa está no{" "}
              <span className="text-blue-700">melhor regime tributário</span>?
            </h1>
            <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
              Compare Simples Nacional, Lucro Presumido e a Reforma Tributária
              (CBS) em segundos. Decisões fiscais mais inteligentes para
              escritórios de contabilidade e empresas.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/auth/register"
                className="bg-blue-700 hover:bg-blue-800 text-white px-8 py-3.5 rounded-xl text-lg font-semibold transition-colors shadow-lg shadow-blue-200"
              >
                Começar Agora
              </Link>
              <Link
                href="/auth/login"
                className="bg-white hover:bg-slate-50 text-slate-700 px-8 py-3.5 rounded-xl text-lg font-semibold border border-slate-300 transition-colors"
              >
                Já tenho conta
              </Link>
            </div>
          </div>
        </section>

        <section className="py-20 bg-white border-t border-slate-100 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">
              Como funciona
            </h2>
            <p className="text-slate-500 text-center max-w-xl mx-auto mb-16">
              Em três passos simples você descobre o regime ideal para sua
              empresa ou cliente.
            </p>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "1",
                  title: "Consulte o CNPJ",
                  desc: "Informe o CNPJ da empresa e buscamos automaticamente os dados fiscais da Receita Federal.",
                },
                {
                  step: "2",
                  title: "Preencha os dados",
                  desc: "Informe o faturamento, despesas e características da empresa nos campos da calculadora.",
                },
                {
                  step: "3",
                  title: "Compare os regimes",
                  desc: "Veja lado a lado Simples Nacional, Lucro Presumido e Reforma CBS com a carga tributária de cada um.",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="bg-slate-50 rounded-2xl p-8 text-center"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-700 text-white text-lg font-bold flex items-center justify-center mx-auto mb-5">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">
              Por que usar o Radar Tributário?
            </h2>
            <p className="text-slate-500 text-center max-w-xl mx-auto mb-16">
              Ferramentas que fazem a diferença no seu dia a dia.
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: "Comparação Completa",
                  desc: "Simples Nacional, Lucro Presumido e Reforma CBS lado a lado.",
                },
                {
                  title: "Dados Reais",
                  desc: "Busca automática de CNPJ na Receita Federal via BrasilAPI.",
                },
                {
                  title: "Simulação Detalhada",
                  desc: "Cálculo de anexos, faixas, Fator R, aliquotas efetivas e mais.",
                },
                {
                  title: "100% Gratuito",
                  desc: "Sem custos ocultos. Ideal para contadores e consultores.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow"
                >
                  <h3 className="font-semibold text-slate-900 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <div className="w-6 h-6 rounded bg-blue-700 flex items-center justify-center text-white text-xs font-bold">
              RT
            </div>
            Radar Tributário &mdash; Inteligência Tributária
          </div>
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} Radar Tributário. Todos os
            direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
