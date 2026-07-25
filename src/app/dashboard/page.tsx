"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [cnpj, setCnpj] = useState("");
  const [cnpjData, setCnpjData] = useState<Record<string, unknown> | null>(null);
  const [cnpjError, setCnpjError] = useState("");
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [tab, setTab] = useState<"cnpj" | "calculadora">("cnpj");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.email) {
          setUser({ email: data.email });
        } else {
          router.push("/auth/login");
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        router.push("/auth/login");
      });
  }, [router]);

  const handleLogout = () => {
    document.cookie = "sb-access-token=; path=/; max-age=0";
    router.push("/auth/login");
    router.refresh();
  };

  const consultarCnpj = async () => {
    const clean = cnpj.replace(/\D/g, "");
    if (clean.length !== 14) {
      setCnpjError("CNPJ deve ter 14 dígitos");
      return;
    }
    setCnpjLoading(true);
    setCnpjError("");
    setCnpjData(null);
    try {
      const res = await fetch(`/api/cnpj/${clean}`);
      const data = await res.json();
      if (!res.ok) {
        setCnpjError(data.error || "Erro ao consultar");
      } else {
        setCnpjData(data);
      }
    } catch {
      setCnpjError("Erro de conexão");
    }
    setCnpjLoading(false);
  };

  const sendCnpjToIframe = () => {
    if (cnpjData && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'cnpjData', data: cnpjData }, '*');
    }
  };

  const handleTabChange = (newTab: "cnpj" | "calculadora") => {
    setTab(newTab);
    if (newTab === "calculadora") {
      setTimeout(sendCnpjToIframe, 500);
    }
  };

  const formatCnpj = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 14);
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4/$5");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Carregando...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center text-white text-sm font-bold">
            CT
          </div>
          <span className="font-bold text-slate-800">Compare Tributo</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => handleTabChange("cnpj")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "cnpj"
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            Consultar CNPJ
          </button>
          <button
            onClick={() => handleTabChange("calculadora")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "calculadora"
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.676 4.5 3.896 4.5 5.118V19.5h15V5.118c0-1.222-.807-2.442-1.907-2.546A48.715 48.715 0 0012 2.25z" />
            </svg>
            Calculadora
          </button>
        </nav>
        <div className="p-4 border-t border-slate-100">
          <div className="text-xs text-slate-400 truncate mb-2">{user?.email}</div>
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-red-500 hover:text-red-600 font-medium"
          >
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <h1 className="text-lg font-semibold text-slate-800">
            {tab === "cnpj" ? "Consultar CNPJ" : "Calculadora Tributária"}
          </h1>
          <span className="text-sm text-slate-400">{user?.email}</span>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {tab === "cnpj" && (
            <div className="max-w-2xl">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-1">
                  Consultar CNPJ
                </h2>
                <p className="text-sm text-slate-500 mb-5">
                  Busque os dados da empresa na Receita Federal para pré-preencher a
                  calculadora.
                </p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                    placeholder="00.000.000/0000-00"
                    className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    maxLength={18}
                  />
                  <button
                    onClick={consultarCnpj}
                    disabled={cnpjLoading}
                    className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    {cnpjLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Consultando...
                      </>
                    ) : (
                      "Consultar"
                    )}
                  </button>
                </div>

                {cnpjError && (
                  <div className="mt-4 bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg">
                    {cnpjError}
                  </div>
                )}

                {cnpjData && (
                  <div className="mt-5 bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-slate-500 block text-xs">Empresa</span>
                        <span className="font-medium text-slate-800">
                          {cnpjData.razao_social as string}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xs">Nome Fantasia</span>
                        <span className="font-medium text-slate-800">
                          {(cnpjData.nome_fantasia as string) || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xs">CNAE</span>
                        <span className="font-medium text-slate-800">
                          {cnpjData.cnae_fiscal as string} —{" "}
                          {(cnpjData.cnae_fiscal_descricao as string) || ""}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xs">Porte</span>
                        <span className="font-medium text-slate-800">
                          {(cnpjData.porte_descricao as string) || "—"}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-4 pt-2 border-t border-blue-200">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            cnpjData.opcao_pelo_simples
                              ? "bg-green-500"
                              : "bg-slate-400"
                          }`}
                        />
                        <span>
                          {cnpjData.opcao_pelo_simples
                            ? "Simples Nacional"
                            : "Lucro Presumido / Real"}
                        </span>
                      </span>
                    </div>
                    {(cnpjData.data_opcao_pelo_simples as string | null) && (
                      <p className="text-xs text-slate-500">
                        Data opção SN:{" "}
                        {cnpjData.data_opcao_pelo_simples as string}
                      </p>
                    )}
                    <div className="pt-2">
                      <button
                        onClick={() => handleTabChange("calculadora")}
                        className="text-sm bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        Ir para Calculadora
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "calculadora" && (
            <div className="h-full flex flex-col">
              <div className="bg-white rounded-xl border border-slate-200 p-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">
                      Calculadora Tributária
                    </h2>
                    <p className="text-sm text-slate-500">
                      Compare regimes e simule a carga tributária da empresa.
                    </p>
                  </div>
                  {cnpjData && (
                    <div className="text-right text-xs text-slate-400">
                      <div>{(cnpjData.razao_social as string) || ""}</div>
                      <div>
                        {cnpjData.opcao_pelo_simples
                          ? "Simples Nacional"
                          : "LP / Real"}
                      </div>
                    </div>
                  )}
                </div>
                <iframe
                  ref={iframeRef}
                  src="/comparador.html"
                  className="w-full flex-1 border-0 rounded-lg"
                  title="Calculadora Tributária"
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
