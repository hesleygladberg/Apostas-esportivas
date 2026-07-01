"use client";

import React, { useState, useEffect } from "react";
import RankingTable from "../../components/ranking-table";
import AnalysisModal from "../../components/analysis-modal";
import { Award, SlidersHorizontal } from "lucide-react";

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

interface RankingsState {
  top_backs: MatchRankingData[];
  top_lays: MatchRankingData[];
  top_edges: MatchRankingData[];
  top_ev: MatchRankingData[];
  top_confidence: MatchRankingData[];
  top_distortions: MatchRankingData[];
  top_inflated_odds: MatchRankingData[];
  top_underpriced_odds: MatchRankingData[];
}

export default function RankingsPage() {
  const [rankings, setRankings] = useState<RankingsState>({
    top_backs: [],
    top_lays: [],
    top_edges: [],
    top_ev: [],
    top_confidence: [],
    top_distortions: [],
    top_inflated_odds: [],
    top_underpriced_odds: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeMatchId, setActiveMatchId] = useState<number | null>(null);

  // States dos Filtros
  const [timeframe, setTimeframe] = useState("today");
  const [league, setLeague] = useState("all");
  const [country, setCountry] = useState("all");

  useEffect(() => {
    const envApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    setLoading(true);

    const queryParams = new URLSearchParams({
      timeframe,
      league,
      country,
    }).toString();

    fetch(`${envApiUrl}/api/matches/rankings-advanced?${queryParams}`)
      .then((res) => {
        if (!res.ok) throw new Error("Erro ao carregar dados do servidor.");
        return res.json();
      })
      .then((data) => {
        setRankings({
          top_backs: data.top_backs || [],
          top_lays: data.top_lays || [],
          top_edges: data.top_edges || [],
          top_ev: data.top_ev || [],
          top_confidence: data.top_confidence || [],
          top_distortions: data.top_distortions || [],
          top_inflated_odds: data.top_inflated_odds || [],
          top_underpriced_odds: data.top_underpriced_odds || [],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error("Erro ao carregar rankings avançados:", err);
        setLoading(false);
      });
  }, [timeframe, league, country]);

  return (
    <div className="space-y-8 font-sans">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight flex items-center gap-2">
            <Award className="w-8 h-8 text-accent animate-pulse" /> Rankings Analíticos Pro
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1.5 leading-relaxed">
            Consulte os 10 melhores jogos ordenados e classificados por valor, EV, distorção cambial de odds e confiança algorítmica para operar na bolsa.
          </p>
        </div>
      </div>

      {/* Painel de Filtros Avançados */}
      <div className="bg-[#121927] border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row md:items-center gap-4 text-xs font-semibold">
        <div className="flex items-center gap-2 text-accent font-bold uppercase tracking-wider md:mr-2">
          <SlidersHorizontal className="w-4 h-4 shrink-0" />
          <span>Filtros Rápidos</span>
        </div>
        
        {/* Filtro Tempo */}
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-[10px] text-slate-500 uppercase tracking-widest block font-bold">Timeframe</label>
          <select 
            value={timeframe} 
            onChange={(e) => setTimeframe(e.target.value)}
            className="bg-[#0b0f19] border border-slate-800 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-accent text-xs font-bold transition-all"
          >
            <option value="today">Hoje</option>
            <option value="24h">Próximas 24 horas</option>
            <option value="48h">Próximas 48 horas</option>
          </select>
        </div>

        {/* Filtro Liga */}
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-[10px] text-slate-500 uppercase tracking-widest block font-bold">Liga</label>
          <select 
            value={league} 
            onChange={(e) => setLeague(e.target.value)}
            className="bg-[#0b0f19] border border-slate-800 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-accent text-xs font-bold transition-all"
          >
            <option value="all">Todas as Ligas</option>
            <option value="Premier League">Premier League</option>
            <option value="La Liga">La Liga</option>
            <option value="Serie A">Serie A</option>
            <option value="Champions League">Champions League</option>
            <option value="Brasileirão Série A">Brasileirão Série A</option>
          </select>
        </div>

        {/* Filtro País */}
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-[10px] text-slate-500 uppercase tracking-widest block font-bold">País</label>
          <select 
            value={country} 
            onChange={(e) => setCountry(e.target.value)}
            className="bg-[#0b0f19] border border-slate-800 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-accent text-xs font-bold transition-all"
          >
            <option value="all">Todos os Países</option>
            <option value="Inglaterra">Inglaterra</option>
            <option value="Espanha">Espanha</option>
            <option value="Itália">Itália</option>
            <option value="Europa">Europa</option>
            <option value="Brasil">Brasil</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-500 text-sm font-semibold">Compilando rankings avançados...</span>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Fila 1: Backs e Lays */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <RankingTable
              title="🔥 Top 10 Backs"
              subtitle="Jogos onde o modelo projeta maior probabilidade de vitória do time do que as odds de mercado."
              matches={rankings.top_backs}
              onOpenAnalysis={(id) => setActiveMatchId(id)}
              metricType="back"
            />
            <RankingTable
              title="🛡️ Top 10 Lays"
              subtitle="Favoritos supervalorizados. Oportunidade ideal para operar contra a vitória das equipes."
              matches={rankings.top_lays}
              onOpenAnalysis={(id) => setActiveMatchId(id)}
              metricType="lay"
            />
          </div>

          {/* Fila 2: Edges e EV */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <RankingTable
              title="📈 Top 10 Maiores Edges"
              subtitle="Partidas com maior distorção percentual pura de precificação modelo vs mercado."
              matches={rankings.top_edges}
              onOpenAnalysis={(id) => setActiveMatchId(id)}
              metricType="edge"
            />
            <RankingTable
              title="💰 Top 10 Maior EV"
              subtitle="Operações com maior Valor Esperado financeiro projetado matemático no longo prazo."
              matches={rankings.top_ev}
              onOpenAnalysis={(id) => setActiveMatchId(id)}
              metricType="ev"
            />
          </div>

          {/* Fila 3: Confiança e Distorções de Mercado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <RankingTable
              title="🎯 Top 10 Mais Confiáveis"
              subtitle="Partidas com o maior score consolidado de estabilidade estatística e amostragem de dados."
              matches={rankings.top_confidence}
              onOpenAnalysis={(id) => setActiveMatchId(id)}
              metricType="confidence"
            />
            <RankingTable
              title="📊 Top 10 Distorções de Mercado"
              subtitle="Maior discrepância global consolidada das três probabilidades comparadas (Modelo vs Mercado)."
              matches={rankings.top_distortions}
              onOpenAnalysis={(id) => setActiveMatchId(id)}
              metricType="edge"
            />
          </div>

          {/* Fila 4: Odds Infladas vs Odds Subavaliadas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <RankingTable
              title="💎 Top 10 Odds Infladas"
              subtitle="Preços do mercado significativamente maiores que o modelo projeta. Odds de muito valor para Back."
              matches={rankings.top_inflated_odds}
              onOpenAnalysis={(id) => setActiveMatchId(id)}
              metricType="edge"
            />
            <RankingTable
              title="⚠️ Top 10 Odds Subavaliadas"
              subtitle="Preços do mercado excessivamente esmagados em relação ao modelo. Risco elevado de perda no Back."
              matches={rankings.top_underpriced_odds}
              onOpenAnalysis={(id) => setActiveMatchId(id)}
              metricType="edge"
            />
          </div>
        </div>
      )}

      {/* Modal de Análise detalhada */}
      {activeMatchId !== null && (
        <AnalysisModal
          matchId={activeMatchId}
          onClose={() => setActiveMatchId(null)}
        />
      )}
    </div>
  );
}
