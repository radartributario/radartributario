import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

const description =
  "Simule e compare regimes tributários em segundos. Compare Simples Nacional, Lucro Presumido, Reforma Tributária e Simples Híbrido com memória de cálculo completa e relatórios profissionais.";

export const metadata: Metadata = {
  metadataBase: new URL("https://comparetributo.com.br"),
  title: {
    default: "CompareTributo | Simulador Tributário Inteligente",
    template: "%s | CompareTributo",
  },
  description,
  applicationName: "CompareTributo",
  alternates: {
    canonical: "https://comparetributo.com.br",
  },
  openGraph: {
    title: "CompareTributo | Simulador Tributário Inteligente",
    description,
    url: "https://comparetributo.com.br",
    siteName: "CompareTributo",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "CompareTributo | Simulador Tributário Inteligente",
    description,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}<Analytics /></body>
    </html>
  );
}
