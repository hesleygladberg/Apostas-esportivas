"use client";

import React from "react";
import { Clock, TrendingUp, AlertTriangle, ShieldCheck } from "lucide-react";

interface TeamInfo {
  name: string;
  league: string;
  country: string;
}

interface MatchData {
  id: number;
  date: string;
  status: string;
  league: string;
  country: string;
  home_team: TeamInfo;
  away_team: TeamInfo;
  odd_home?: number;
  odd_draw?: number;
  odd_away?: number;
  odd_volume: number;
  prob_home?: number;
  prob_draw?: number;
  prob_away?: number;
  fair_home?: number;
  fair_draw?: number;
  fair_away?: number;
  edge_val: number;
  ev_val: number;
  confidence_score: number;
  recommendation: string;
  explanation?: string;
}

interface MatchCardProps {
  match: MatchData;
  onOpenAnalysis: (matchId: number) => void;
}

export default function MatchCard({ match, onOpenAnalysis }: MatchCardProps) {
  const matchDate = new Date(match.date);
  const formattedDate = matchDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
  const formattedTime = matchDate.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  
  // Classificar cor da recomendação
  const getRecBadgeStyles = (rec: string) => {
    if (rec.startsWith("BACK")) {
      return "bg-success/15 text-success border-success/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]";
    }
    if (rec.startsWith("LAY")) {
      return "bg-danger/15 text-danger border-danger/30 shadow-[0_0_15px_rgba(244,63,94,0.05)]";
    }
    return "bg-slate-800 text-slate-400 border-slate-700";
  };

  // Classificar cor da Confiança
  const getConfColor = (score: number) => {
    if (score >= 85) return "text-violet-400 bg-violet-500/10 border-violet-500/20";
    if (score >= 70) return "text-success bg-success/10 border-success/20";
    if (score >= 40) return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-danger bg-danger/10 border-danger/20";
  };

  const getConfProgressColor = (score: number) => {
    if (score >= 85) return "bg-gradient-to-r from-violet-500 to-indigo-500";
    if (score >= 70) return "bg-success";
    if (score >= 40) return "bg-amber-500";
    return "bg-danger";
  };

  const rec = match.recommendation || "SEM ENTRADA";
  const isBackMandante = rec === "BACK MANDANTE";
  const isLayMandante = rec === "LAY MANDANTE";
  const isBackEmpate = rec === "BACK EMPATE";
  const isBackVisitante = rec === "BACK VISITANTE";
  const isLayVisitante = rec === "LAY VISITANTE";

  // Calcular Probabilidades Implícitas
  const h_impl = match.odd_home ? (1.0 / match.odd_home) : 0.0;
  const d_impl = match.odd_draw ? (1.0 / match.odd_draw) : 0.0;
  const a_impl = match.odd_away ? (1.0 / match.odd_away) : 0.0;

  const prob_h = match.prob_home || 0.0;
  const prob_d = match.prob_draw || 0.0;
  const prob_a = match.prob_away || 0.0;

  // Calcular Distorção de Mercado
  const distortion = Math.abs(prob_h - h_impl) + Math.abs(prob_d - d_impl) + Math.abs(prob_a - a_impl);
  const distortionPct = distortion * 100;

  let distortionLabel = "Mercado Eficiente";
  let distortionColor = "text-slate-400 bg-slate-800/80 border-slate-700/60";
  let distortionBarColor = "bg-slate-500";

  if (distortionPct >= 30) {
    distortionLabel = "Grande Distorção";
    distortionColor = "text-danger bg-danger/10 border-danger/20";
    distortionBarColor = "bg-danger";
  } else if (distortionPct >= 15) {
    distortionLabel = "Boa Oportunidade";
    distortionColor = "text-violet-400 bg-violet-500/10 border-violet-500/20";
    distortionBarColor = "bg-violet-500";
  } else if (distortionPct >= 5) {
    distortionLabel = "Pequena Distorção";
    distortionColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
    distortionBarColor = "bg-amber-500";
  }

  // Card classes based on recommendation to highlight the whole card subtly
  const cardBorderClass = match.edge_val > 0.50
    ? "border-danger/40 shadow-[0_0_20px_rgba(244,63,94,0.05)] bg-[#170e16]/50"
    : isBackMandante || isBackEmpate || isBackVisitante
    ? "border-success/30 hover:border-success/50 shadow-[0_0_20px_rgba(16,185,129,0.03)]"
    : isLayMandante || isLayVisitante
    ? "border-danger/30 hover:border-danger/50 shadow-[0_0_20px_rgba(244,63,94,0.03)]"
    : "border-slate-800/80 hover:border-slate-750";

  return (
    <div className={`bg-[#121927] border rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 ${cardBorderClass}`}>
      {/* Top Banner (Liga & Horário) */}
      <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-3 mb-4 gap-2">
        <span className="font-semibold px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 truncate max-w-[160px]" title={`${match.league} (${match.country})`}>
          ⚽ {match.league}
        </span>
        <div className="flex items-center space-x-1 font-mono text-[10px] text-slate-400">
          <Clock className="w-3.5 h-3.5 text-accent" />
          <span suppressHydrationWarning>{formattedDate} - {formattedTime}</span>
        </div>
      </div>

      {/* Confronto */}
      <div className="flex flex-col space-y-2 mb-4 bg-slate-900/40 p-3 rounded-xl border border-slate-850">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-slate-100 truncate pr-2 max-w-[170px]">{match.home_team.name}</span>
          <span className="text-[9px] text-slate-400 font-bold bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700 uppercase tracking-wider">Casa</span>
        </div>
        <div className="text-[8px] text-slate-600 font-extrabold px-1 tracking-wider uppercase select-none">VS</div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-slate-100 truncate pr-2 max-w-[170px]">{match.away_team.name}</span>
          <span className="text-[9px] text-slate-400 font-bold bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700 uppercase tracking-wider">Visitante</span>
        </div>
      </div>

      {/* Grid de Comparação de Odds (Layout Betfair/Bet365 com Destaque de Valor e Probabilidades) */}
      <div className="grid grid-cols-3 gap-2 bg-slate-950/40 border border-slate-800/80 rounded-xl p-2 mb-4 text-center">
        {/* Mandante Column */}
        <div className="flex flex-col justify-between p-1">
          <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mandante (1)</div>
          <div className={`border rounded-lg py-1.5 px-0.5 transition-all duration-300 ${
            isBackMandante 
              ? "bg-success/15 border-success/80 text-success shadow-[0_0_8px_rgba(16,185,129,0.15)] font-black"
              : isLayMandante
              ? "bg-danger/15 border-danger/80 text-danger shadow-[0_0_8px_rgba(244,63,94,0.15)] font-black"
              : "bg-slate-900/80 border-slate-850 text-slate-200"
          }`}>
            <div className={`text-[7px] font-black uppercase mb-0.5 ${
              isBackMandante ? "text-success" : isLayMandante ? "text-danger" : "text-slate-500"
            }`}>
              {isBackMandante ? "★ BACK" : isLayMandante ? "★ LAY" : "Mercado"}
            </div>
            <div className="text-xs font-mono font-bold">{match.odd_home?.toFixed(2)}</div>
          </div>
          
          {/* Comparativo de Probabilidades */}
          <div className="text-[9px] text-slate-400 font-semibold mt-1.5 border-t border-slate-850 pt-1.5">
            Justa: <span className="font-bold font-mono text-accent">{match.fair_home?.toFixed(2)}</span>
          </div>
          <div className="text-[8px] font-mono mt-1 space-y-0.5 text-left bg-slate-900/50 p-1 rounded border border-slate-850/50">
            <div className="flex justify-between text-slate-500">
              <span>Merc:</span>
              <span className="text-slate-350">{(h_impl * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Model:</span>
              <span className="text-slate-350">{(prob_h * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between border-t border-slate-800/80 pt-0.5 font-bold text-slate-500">
              <span>Desvio:</span>
              <span className={prob_h - h_impl >= 0 ? "text-success" : "text-danger"}>
                {prob_h - h_impl >= 0 ? "+" : ""}{((prob_h - h_impl) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Empate Column */}
        <div className="flex flex-col justify-between border-x border-slate-800/60 px-1 p-1">
          <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">Empate (X)</div>
          <div className={`border rounded-lg py-1.5 px-0.5 transition-all duration-300 ${
            isBackEmpate 
              ? "bg-success/15 border-success/80 text-success shadow-[0_0_8px_rgba(16,185,129,0.15)] font-black"
              : "bg-slate-900/80 border-slate-850 text-slate-200"
          }`}>
            <div className={`text-[7px] font-black uppercase mb-0.5 ${
              isBackEmpate ? "text-success" : "text-slate-500"
            }`}>
              {isBackEmpate ? "★ BACK" : "Mercado"}
            </div>
            <div className="text-xs font-mono font-bold">{match.odd_draw?.toFixed(2)}</div>
          </div>
          
          {/* Comparativo de Probabilidades */}
          <div className="text-[9px] text-slate-400 font-semibold mt-1.5 border-t border-slate-850 pt-1.5">
            Justa: <span className="font-bold font-mono text-accent">{match.fair_draw?.toFixed(2)}</span>
          </div>
          <div className="text-[8px] font-mono mt-1 space-y-0.5 text-left bg-slate-900/50 p-1 rounded border border-slate-850/50">
            <div className="flex justify-between text-slate-500">
              <span>Merc:</span>
              <span className="text-slate-350">{(d_impl * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Model:</span>
              <span className="text-slate-350">{(prob_d * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between border-t border-slate-800/80 pt-0.5 font-bold text-slate-500">
              <span>Desvio:</span>
              <span className={prob_d - d_impl >= 0 ? "text-success" : "text-danger"}>
                {prob_d - d_impl >= 0 ? "+" : ""}{((prob_d - d_impl) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Visitante Column */}
        <div className="flex flex-col justify-between p-1">
          <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">Visitante (2)</div>
          <div className={`border rounded-lg py-1.5 px-0.5 transition-all duration-300 ${
            isBackVisitante 
              ? "bg-success/15 border-success/80 text-success shadow-[0_0_8px_rgba(16,185,129,0.15)] font-black"
              : isLayVisitante
              ? "bg-danger/15 border-danger/80 text-danger shadow-[0_0_8px_rgba(244,63,94,0.15)] font-black"
              : "bg-slate-900/80 border-slate-850 text-slate-200"
          }`}>
            <div className={`text-[7px] font-black uppercase mb-0.5 ${
              isBackVisitante ? "text-success" : isLayVisitante ? "text-danger" : "text-slate-500"
            }`}>
              {isBackVisitante ? "★ BACK" : isLayVisitante ? "★ LAY" : "Mercado"}
            </div>
            <div className="text-xs font-mono font-bold">{match.odd_away?.toFixed(2)}</div>
          </div>
          
          {/* Comparativo de Probabilidades */}
          <div className="text-[9px] text-slate-400 font-semibold mt-1.5 border-t border-slate-850 pt-1.5">
            Justa: <span className="font-bold font-mono text-accent">{match.fair_away?.toFixed(2)}</span>
          </div>
          <div className="text-[8px] font-mono mt-1 space-y-0.5 text-left bg-slate-900/50 p-1 rounded border border-slate-850/50">
            <div className="flex justify-between text-slate-500">
              <span>Merc:</span>
              <span className="text-slate-350">{(a_impl * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Model:</span>
              <span className="text-slate-350">{(prob_a * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between border-t border-slate-800/80 pt-0.5 font-bold text-slate-500">
              <span>Desvio:</span>
              <span className={prob_a - a_impl >= 0 ? "text-success" : "text-danger"}>
                {prob_a - a_impl >= 0 ? "+" : ""}{((prob_a - a_impl) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Indicador de Distorção de Mercado */}
      <div className="space-y-1.5 mb-4 bg-slate-900/25 p-3 rounded-xl border border-slate-850">
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-slate-400 font-medium">Distorção das Odds</span>
          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border uppercase ${distortionColor}`}>
            {distortionLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-slate-900 border border-slate-850 rounded-full h-1 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${distortionBarColor}`}
              style={{ width: `${Math.min(100, (distortionPct / 50.0) * 100.0)}%` }}
            />
          </div>
          <span className="text-[9px] font-mono font-bold text-slate-300">{distortionPct.toFixed(1)}%</span>
        </div>
      </div>

      {/* Métricas de Edge, EV e Confiança */}
      <div className="space-y-3.5 border-t border-slate-800 pt-4 mb-4">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-success" /> Edge Estatístico
          </span>
          <div className="flex items-center gap-2">
            {/* Aviso de Edge Extremo com Tooltip */}
            {match.edge_val > 0.50 && (
              <div className="relative group flex items-center gap-1 bg-danger/10 text-danger border border-danger/30 px-2 py-0.5 rounded text-[9px] font-black cursor-help animate-pulse">
                <span>⚠ Valor Extremo</span>
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 rounded-xl bg-slate-950 text-slate-300 text-[9px] font-normal leading-normal shadow-2xl border border-slate-850 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center">
                  Este valor pode indicar oportunidade excepcional ou inconsistência estatística. Recomenda-se validação adicional.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-950" />
                </div>
              </div>
            )}
            
            <span className={`font-mono font-bold ${match.edge_val > 0 ? "text-success" : "text-slate-400"}`}>
              {match.edge_val > 0 ? `+${(match.edge_val * 100).toFixed(1)}%` : "Sem Entrada"}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-accent" /> Confiança do Modelo
            </span>
            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${getConfColor(match.confidence_score)}`}>
              {match.confidence_score} ({match.confidence_score >= 85 ? "Excelente" : match.confidence_score >= 70 ? "Alta" : match.confidence_score >= 40 ? "Média" : "Baixa"})
            </span>
          </div>
          {/* Barra de progresso com trilha visível em tom cinza escuro */}
          <div className="w-full bg-slate-900 border border-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getConfProgressColor(match.confidence_score)}`}
              style={{ width: `${match.confidence_score}%` }}
            />
          </div>
        </div>
      </div>

      {/* Recomendação & Botão de Detalhes */}
      <div className="flex items-center justify-between gap-3 mt-auto">
        <div className={`px-3 py-2 rounded-xl text-xs font-bold border text-center flex-1 tracking-wider ${getRecBadgeStyles(match.recommendation)}`}>
          {match.recommendation}
        </div>
        <button
          onClick={() => onOpenAnalysis(match.id)}
          className="bg-accent hover:bg-violet-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-accent/20 transition-all hover:scale-[1.02]"
        >
          Análise
        </button>
      </div>
    </div>
  );
}
