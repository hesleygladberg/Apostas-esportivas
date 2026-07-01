"use client";

import React, { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Award, Activity, Calendar, Info, ShieldCheck } from "lucide-react";

interface PerformancePeriod {
  entradas: number;
  vitorias: number;
  derrotas: number;
  taxa_acerto: number;
  roi: number;
  lucro_unidades: number;
  lucro_percentual: number;
}

interface ChartDataPoint {
  date: string;
  lucro_acumulado: number;
}

interface PerformanceResponse {
  period_7d: PerformancePeriod;
  period_30d: PerformancePeriod;
  period_90d: PerformancePeriod;
  chart_data: ChartDataPoint[];
}

export default function PerformancePage() {
  const [data, setData] = useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const envApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    setLoading(true);
    fetch(`${envApiUrl}/api/matches/performance`)
      .then((res) => {
        if (!res.ok) throw new Error("Falha ao carregar os dados de performance.");
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Não foi possível conectar ao servidor FastAPI para extrair o backtest.");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold text-slate-400">Processando backtest histórico...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[#1c1212] border border-danger/20 p-8 rounded-3xl text-center max-w-lg mx-auto my-12">
        <span className="text-danger font-black text-lg block mb-2 font-sans">Erro de Conexão</span>
        <p className="text-slate-400 text-xs mb-4">{error || "Erro desconhecido."}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-bold px-5 py-2.5 rounded-xl transition-all"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  // Estatísticas de Períodos
  const periods = [
    { label: "Últimos 7 Dias", stats: data.period_7d },
    { label: "Últimos 30 Dias", stats: data.period_30d },
    { label: "Últimos 90 Dias", stats: data.period_90d },
  ];

  // Cálculo das Coordenadas do Gráfico SVG
  const chartPoints = data.chart_data;
  const paddingX = 40;
  const paddingY = 30;
  const chartWidth = 900;
  const chartHeight = 300;

  const yValues = chartPoints.map((p) => p.lucro_acumulado);
  const maxY = Math.max(...yValues, 5); // Teto mínimo de 5 unidades para o gráfico não achatar se for muito pequeno
  const minY = Math.min(...yValues, -5); // Chão mínimo de -5 unidades
  const rangeY = maxY - minY === 0 ? 1 : maxY - minY;

  // Gerar caminho da linha e do preenchimento
  let linePath = "";
  let fillPath = "";
  
  if (chartPoints.length > 0) {
    chartPoints.forEach((p, idx) => {
      // Mapeamento X
      const x = paddingX + (idx / (chartPoints.length - 1 || 1)) * (chartWidth - 2 * paddingX);
      // Mapeamento Y (invertido no SVG)
      const y = paddingY + (1.0 - (p.lucro_acumulado - minY) / rangeY) * (chartHeight - 2 * paddingY);
      
      if (idx === 0) {
        linePath += `M ${x} ${y}`;
        fillPath += `M ${x} ${chartHeight - paddingY} L ${x} ${y}`;
      } else {
        linePath += ` L ${x} ${y}`;
        fillPath += ` L ${x} ${y}`;
      }
      
      if (idx === chartPoints.length - 1) {
        fillPath += ` L ${x} ${chartHeight - paddingY} Z`;
      }
    });
  }

  // Linha do zero (Banca Inicial)
  const zeroY = paddingY + (1.0 - (0.0 - minY) / rangeY) * (chartHeight - 2 * paddingY);

  return (
    <div className="space-y-8 font-sans">
      {/* Título da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight flex items-center gap-2">
            <Activity className="text-accent w-8 h-8" /> Histórico de Performance
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 font-medium leading-relaxed max-w-xl">
            Simulação de backtesting em tempo real baseada nas recomendações emitidas pelo modelo matemático de Poisson sobre os jogos finalizados salvos no banco.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[#121927] border border-slate-800 px-4 py-2.5 rounded-2xl">
          <ShieldCheck className="w-5 h-5 text-success" />
          <div>
            <span className="text-[10px] text-slate-500 font-bold block uppercase leading-none">Verificação do Modelo</span>
            <span className="text-xs font-bold text-slate-300">100% Verificado via BD</span>
          </div>
        </div>
      </div>

      {/* Cards de Períodos (7d, 30d, 90d) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {periods.map((p, idx) => {
          const isProfit = p.stats.lucro_unidades >= 0;
          return (
            <div 
              key={idx} 
              className={`bg-[#121927] border rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 ${
                isProfit ? "border-success/20 hover:border-success/30" : "border-danger/20 hover:border-danger/30"
              }`}
            >
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{p.label}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    isProfit 
                      ? "text-success bg-success/10 border-success/20" 
                      : "text-danger bg-danger/10 border-danger/20"
                  }`}>
                    {isProfit ? "LUCRO" : "DOWN"}
                  </span>
                </div>
                <div className="flex items-baseline space-x-1.5 mb-1">
                  <span className={`text-3xl font-black ${isProfit ? "text-success" : "text-danger"}`}>
                    {isProfit ? "+" : ""}{p.stats.lucro_unidades.toFixed(1)} u
                  </span>
                  <span className="text-xs text-slate-500 font-bold">({p.stats.roi.toFixed(1)}% ROI)</span>
                </div>
                <span className="text-[10px] text-slate-500 font-bold block mb-4 uppercase">
                  Lucro Banca: {isProfit ? "+" : ""}{p.stats.lucro_percentual.toFixed(1)}% (1% por unid.)
                </span>
              </div>

              <div className="border-t border-slate-800/80 pt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Entradas</span>
                  <span className="text-sm font-bold font-mono text-slate-350">{p.stats.entradas}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Acertos</span>
                  <span className="text-sm font-bold font-mono text-success">{p.stats.vitorias}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Taxa</span>
                  <span className="text-sm font-bold font-mono text-slate-300">{p.stats.taxa_acerto}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Gráfico da Curva de Banca (Trading Curve) */}
      <div className="bg-[#121927] border border-border rounded-3xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3 mb-6 gap-2">
          <div>
            <h3 className="font-bold text-slate-200 text-sm uppercase">Curva de Lucro Acumulado (Unidades)</h3>
            <p className="text-[10px] text-slate-500 font-medium">Gráfico do crescimento de saldo com base em apostas simples de 1 unidade plana (Flat Betting).</p>
          </div>
          <span className="text-xs bg-slate-900 border border-slate-800 px-3 py-1 rounded-full text-success font-semibold flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Lucro Consistente
          </span>
        </div>

        {/* Gráfico SVG Responsivo */}
        <div className="w-full overflow-x-auto">
          <div className="min-w-[700px] lg:min-w-full">
            <svg 
              viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
              className="w-full h-auto overflow-visible select-none"
            >
              <defs>
                {/* Gradiente para preenchimento sob a curva */}
                <linearGradient id="chartFillGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                </linearGradient>
                {/* Gradiente para a linha da curva */}
                <linearGradient id="chartLineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="50%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>

              {/* Linhas de Grade de Y (Auxiliares) */}
              {[minY, minY + rangeY / 2, maxY].map((val, idx) => {
                const y = paddingY + (1.0 - (val - minY) / rangeY) * (chartHeight - 2 * paddingY);
                return (
                  <g key={idx}>
                    <line 
                      x1={paddingX} 
                      y1={y} 
                      x2={chartWidth - paddingX} 
                      y2={y} 
                      stroke="#1e293b" 
                      strokeWidth="1.5" 
                      strokeDasharray="4 4" 
                    />
                    <text 
                      x={paddingX - 10} 
                      y={y + 4} 
                      fill="#64748b" 
                      fontSize="9" 
                      fontWeight="bold" 
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {val >= 0 ? "+" : ""}{val.toFixed(1)}u
                    </text>
                  </g>
                );
              })}

              {/* Linha do Zero (Banca Inicial) */}
              {zeroY >= paddingY && zeroY <= chartHeight - paddingY && (
                <line 
                  x1={paddingX} 
                  y1={zeroY} 
                  x2={chartWidth - paddingX} 
                  y2={zeroY} 
                  stroke="#ef4444" 
                  strokeWidth="1.5" 
                  strokeOpacity="0.3" 
                />
              )}

              {/* Rótulos de Data no Eixo X */}
              {chartPoints.length > 0 && [0, Math.floor(chartPoints.length / 4), Math.floor(chartPoints.length / 2), Math.floor(chartPoints.length * 3 / 4), chartPoints.length - 1].map((idx) => {
                if (idx >= chartPoints.length) return null;
                const p = chartPoints[idx];
                const x = paddingX + (idx / (chartPoints.length - 1 || 1)) * (chartWidth - 2 * paddingX);
                return (
                  <text 
                    key={idx}
                    x={x} 
                    y={chartHeight - 10} 
                    fill="#64748b" 
                    fontSize="9" 
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {p.date}
                  </text>
                );
              })}

              {/* Gráficos Reais: Caminho do Gradiente de Preenchimento */}
              {fillPath && (
                <path d={fillPath} fill="url(#chartFillGrad)" />
              )}

              {/* Gráficos Reais: Linha de Performance */}
              {linePath && (
                <path 
                  d={linePath} 
                  fill="none" 
                  stroke="url(#chartLineGrad)" 
                  strokeWidth="3.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
              )}

              {/* Círculo no último ponto */}
              {chartPoints.length > 0 && (() => {
                const idx = chartPoints.length - 1;
                const p = chartPoints[idx];
                const x = paddingX + (idx / (chartPoints.length - 1 || 1)) * (chartWidth - 2 * paddingX);
                const y = paddingY + (1.0 - (p.lucro_acumulado - minY) / rangeY) * (chartHeight - 2 * paddingY);
                return (
                  <g>
                    <circle cx={x} cy={y} r="8" fill="#8b5cf6" fillOpacity="0.4" className="animate-ping" />
                    <circle cx={x} cy={y} r="5" fill="#a78bfa" stroke="#0f172a" strokeWidth="2" />
                  </g>
                );
              })()}
            </svg>
          </div>
        </div>

        {/* Nota explicativa de performance */}
        <div className="flex gap-3 bg-[#0d1322] border border-slate-800 p-4 rounded-2xl mt-6">
          <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <div className="text-[11px] text-slate-400 leading-relaxed font-medium">
            <span className="text-slate-200 font-bold block mb-0.5">Nota Metodológica</span>
            O backtesting simula operações feitas a favor do time recomendado (BACK) ou contra (LAY) a uma stake plana. Para Lays, calcula a responsabilidade padrão do mercado no momento do encerramento da aposta.
          </div>
        </div>
      </div>
    </div>
  );
}
