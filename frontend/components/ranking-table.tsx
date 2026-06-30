"use client";

import React from "react";

interface TeamInfo {
  name: string;
}

interface MatchRankingData {
  id: number;
  date: string;
  league: string;
  country: string;
  home_team: TeamInfo;
  away_team: TeamInfo;
  odd_home?: number;
  odd_draw?: number;
  odd_away?: number;
  fair_home?: number;
  fair_draw?: number;
  fair_away?: number;
  edge_val: number;
  ev_val: number;
  confidence_score: number;
  recommendation: string;
}

interface RankingTableProps {
  title: string;
  subtitle: string;
  matches: MatchRankingData[];
  onOpenAnalysis: (matchId: number) => void;
  metricType: "edge" | "ev" | "confidence" | "back" | "lay";
}

export default function RankingTable({
  title,
  subtitle,
  matches,
  onOpenAnalysis,
  metricType,
}: RankingTableProps) {
  
  const getMetricValue = (m: MatchRankingData) => {
    switch (metricType) {
      case "edge":
        return `+${(m.edge_val * 100).toFixed(1)}% Edge`;
      case "ev":
        return `+${(m.ev_val * 100).toFixed(1)}% EV`;
      case "confidence":
        return `${m.confidence_score} Conf.`;
      case "back":
        return `+${(m.edge_val * 100).toFixed(1)}% (${m.recommendation})`;
      case "lay":
        return `+${(m.edge_val * 100).toFixed(1)}% (${m.recommendation})`;
      default:
        return "";
    }
  };

  const getMetricColorClass = () => {
    if (metricType === "confidence") return "text-accent font-bold";
    if (metricType === "lay") return "text-danger font-bold";
    return "text-success font-bold";
  };

  return (
    <div className="bg-[#121927] border border-border rounded-2xl p-5 shadow-lg flex flex-col h-full justify-between">
      <div>
        <div className="border-b border-slate-800 pb-3 mb-4">
          <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide">{title}</h3>
          <p className="text-[10px] text-slate-500 font-medium">{subtitle}</p>
        </div>

        {matches.length > 0 ? (
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {matches.map((m, index) => (
              <div
                key={m.id}
                onClick={() => onOpenAnalysis(m.id)}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-border/40 hover:border-accent/40 hover:bg-[#161f30]/40 transition-all cursor-pointer group"
              >
                <div className="flex items-center space-x-3 min-w-0 mr-2">
                  {/* Posição */}
                  <span className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center font-mono font-bold text-xs text-slate-400 group-hover:bg-accent group-hover:text-white transition-colors shrink-0">
                    {index + 1}
                  </span>
                  {/* Jogo */}
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-200 block truncate">
                      {m.home_team.name} x {m.away_team.name}
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">
                      {m.league}
                    </span>
                  </div>
                </div>

                {/* Métrica de Destaque */}
                <span className={`text-xs font-mono shrink-0 ${getMetricColorClass()}`}>
                  {getMetricValue(m)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-500 font-semibold italic text-center py-10">
            Nenhuma partida elegível no momento.
          </div>
        )}
      </div>
      
      <div className="mt-4 pt-3 border-t border-slate-800/60 text-[9px] text-slate-600 font-medium">
        Clique no card do jogo para abrir a ficha de análise detalhada.
      </div>
    </div>
  );
}
