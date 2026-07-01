"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [apiUrl, setApiUrl] = useState("http://localhost:8000");

  useEffect(() => {
    // Detectar dinamicamente a URL do backend nas variáveis de ambiente do cliente
    const envApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    setApiUrl(envApiUrl);

    const checkStatus = () => {
      fetch(`${envApiUrl}/`)
        .then((res) => {
          if (res.ok) setApiStatus("online");
          else setApiStatus("offline");
        })
        .catch(() => setApiStatus("offline"));
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Checa a cada 30 segundos
    return () => clearInterval(interval);
  }, []);

  return (
    <html lang="pt-BR">
      <head>
        <title>Trade Scanner AI - Trading Esportivo & Value Betting</title>
        <meta name="description" content="Scanner automático de oportunidades de valor em futebol utilizando distribuição de Poisson." />
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-background text-slate-100 min-h-screen flex flex-col font-sans">
        {/* Header de Navegação */}
        <header className="border-b border-border bg-[#0e1422] sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-accent to-indigo-600 flex items-center justify-center shadow-lg shadow-accent/25">
                <span className="text-xl font-bold text-white">TS</span>
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                  Trade Scanner <span className="text-accent">AI</span>
                </span>
                <span className="text-xs block text-slate-500 font-medium">V1.1 - Trade Scanner AI Pro</span>
              </div>
            </div>

            {/* Menu */}
            <nav className="flex space-x-1 sm:space-x-4">
              <Link
                href="/"
                className="px-3 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/rankings"
                className="px-3 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"
              >
                Rankings Diários
              </Link>
              <Link
                href="/performance"
                className="px-3 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"
              >
                Performance
              </Link>
            </nav>

            {/* Status da API */}
            <div className="flex items-center space-x-2 bg-slate-900 border border-border px-3 py-1.5 rounded-full text-xs">
              <span className="text-slate-400 font-medium">API:</span>
              <div className="flex items-center space-x-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    apiStatus === "online"
                      ? "bg-success shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse"
                      : apiStatus === "offline"
                      ? "bg-danger shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                      : "bg-amber-500 animate-bounce"
                  }`}
                />
                <span
                  className={`font-semibold capitalize ${
                    apiStatus === "online"
                      ? "text-success"
                      : apiStatus === "offline"
                      ? "text-danger"
                      : "text-amber-500"
                  }`}
                >
                  {apiStatus === "online" ? "Online" : apiStatus === "offline" ? "Offline" : "Checando..."}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Conteúdo Principal */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Rodapé */}
        <footer className="border-t border-border bg-[#080c14] py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4">
            <p>© {new Date().getFullYear()} Trade Scanner AI. Desenvolvido para traders profissionais. Use com responsabilidade.</p>
            <p className="mt-1 text-slate-600">Modelos matemáticos baseados puramente na Distribuição de Poisson. Sem IA Generativa na geração de dados.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
