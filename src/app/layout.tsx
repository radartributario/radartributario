import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Radar Tributário — Comparador de Regimes Tributários",
  description:
    "Descubra se sua empresa está no melhor regime tributário. Simule Simples Nacional, Lucro Presumido e Reforma CBS.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
