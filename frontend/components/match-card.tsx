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

  return (
    <div className="glass glass-hover rounded-2xl p-5 flex flex-col justify-between transition-all">
      {/* Top Banner (Liga & Horário) */}
      <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/60 pb-3 mb-4">
        <span className="font-semibold px-2.5 py-0.5 rounded-full bg-slate-900 border border-border">
          ⚽ {match.league} ({match.country})
        </span>
        <div className="flex items-center space-x-1 font-mono text-[10px] text-slate-400">
          <Clock className="w-3.5 h-3.5 text-accent" />
          <span>{formattedDate} - {formattedTime}</span>
        </div>
      </div>

      {/* Confronto */}
      <div className="space-y-3 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-base font-bold text-slate-100">{match.home_team.name}</span>
          <span className="text-[9px] text-slate-400 font-bold bg-slate-900/80 px-2 py-0.5 rounded-md border border-border/40 uppercase tracking-wider">Casa</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-base font-bold text-slate-100">{match.away_team.name}</span>
          <span className="text-[9px] text-slate-400 font-bold bg-slate-900/80 px-2 py-0.5 rounded-md border border-border/40 uppercase tracking-wider">Visitante</span>
        </div>
      </div>

      {/* Grid de Comparação de Odds (Layout Estilo Betfair/Bet365) */}
      <div className="grid grid-cols-3 gap-2.5 bg-slate-950/40 border border-slate-800/80 rounded-2xl p-2.5 mb-4 text-center">
        <div>
          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mandante (1)</div>
          <div className="bg-slate-900/85 border border-slate-850 rounded-xl py-1.5 px-2">
            <div className="text-[9px] text-slate-500 font-semibold mb-0.5">Mercado</div>
            <div className="text-xs font-mono font-bold text-slate-200">{match.odd_home?.toFixed(2)}</div>
          </div>
          <div className="text-[9px] text-accent font-semibold mt-1">
            Justa: <span className="font-bold font-mono text-slate-300">{match.fair_home?.toFixed(2)}</span>
          </div>
        </div>
        <div className="border-x border-slate-800/60 px-1">
          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Empate (X)</div>
          <div className="bg-slate-900/85 border border-slate-850 rounded-xl py-1.5 px-2">
            <div className="text-[9px] text-slate-500 font-semibold mb-0.5">Mercado</div>
            <div className="text-xs font-mono font-bold text-slate-200">{match.odd_draw?.toFixed(2)}</div>
          </div>
          <div className="text-[9px] text-accent font-semibold mt-1">
            Justa: <span className="font-bold font-mono text-slate-300">{match.fair_draw?.toFixed(2)}</span>
          </div>
        </div>
        <div>
          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Visitante (2)</div>
          <div className="bg-slate-900/85 border border-slate-850 rounded-xl py-1.5 px-2">
            <div className="text-[9px] text-slate-500 font-semibold mb-0.5">Mercado</div>
            <div className="text-xs font-mono font-bold text-slate-200">{match.odd_away?.toFixed(2)}</div>
          </div>
          <div className="text-[9px] text-accent font-semibold mt-1">
            Justa: <span className="font-bold font-mono text-slate-300">{match.fair_away?.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Métricas de Edge, EV e Confiança */}
      <div className="space-y-3 border-t border-slate-800/60 pt-4 mb-4">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-success" /> Edge Estatístico
          </span>
          <span className={`font-mono font-bold ${match.edge_val > 0 ? "text-success" : "text-slate-400"}`}>
            {match.edge_val > 0 ? `+${(match.edge_val * 100).toFixed(1)}%` : "Sem Valor"}
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-accent" /> Confiança do Modelo
            </span>
            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${getConfColor(match.confidence_score)}`}>
              {match.confidence_score} ({match.confidence_score >= 85 ? "Excelente" : match.confidence_score >= 70 ? "Alta" : match.confidence_score >= 40 ? "Média" : "Baixa"})
            </span>
          </div>
          {/* Barra de progresso */}
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-border/20">
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
