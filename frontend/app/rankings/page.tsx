"use client";

import React, { useState, useEffect } from "react";
import RankingTable from "../../components/ranking-table";
import AnalysisModal from "../../components/analysis-modal";
import { Award, Target, Flame, Landmark, Activity } from "lucide-react";

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
}

export default function RankingsPage() {
  const [rankings, setRankings] = useState<RankingsState>({
    top_backs: [],
    top_lays: [],
    top_edges: [],
    top_ev: [],
    top_confidence: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeMatchId, setActiveMatchId] = useState<number | null>(null);

  useEffect(() => {
    const envApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    setLoading(true);

    fetch(`${envApiUrl}/api/matches/rankings`)
      .then((res) => res.json())
      .then((data) => {
        setRankings({
          top_backs: data.top_backs || [],
          top_lays: data.top_lays || [],
          top_edges: data.top_edges || [],
          top_ev: data.top_ev || [],
          top_confidence: data.top_confidence || [],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error("Erro ao carregar rankings:", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight flex items-center gap-2">
          <Award className="w-8 h-8 text-accent" /> Rankings Diários
        </h1>
        <p className="text-sm text-slate-400 font-medium mt-1">
          Os 10 melhores jogos filtrados automaticamente pelos algoritmos de valor e confiança.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-500 text-sm font-semibold">Compilando rankings diários...</span>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Fila 1: Backs e Lays */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <RankingTable
              title="🔥 Top 10 Backs"
              subtitle="Jogos onde o modelo projeta maior probabilidade de vitória do time do que as odds implícitas de mercado."
              matches={rankings.top_backs}
              onOpenAnalysis={(id) => setActiveMatchId(id)}
              metricType="back"
            />
            <RankingTable
              title="🛡️ Top 10 Lays"
              subtitle="Favoritos supervalorizados pelo mercado. Oportunidade ideal para entrar contra a vitória do time."
              matches={rankings.top_lays}
              onOpenAnalysis={(id) => setActiveMatchId(id)}
              metricType="lay"
            />
          </div>

          {/* Fila 2: Edges e EV */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <RankingTable
              title="📈 Top 10 Maiores Edges"
              subtitle="Partidas com maior distorção de precificação percentual pura entre modelo e mercado."
              matches={rankings.top_edges}
              onOpenAnalysis={(id) => setActiveMatchId(id)}
              metricType="edge"
            />
            <RankingTable
              title="💰 Top 10 Maior EV"
              subtitle="Partidas com maior retorno financeiro projetado a longo prazo com base nas odds de mercado."
              matches={rankings.top_ev}
              onOpenAnalysis={(id) => setActiveMatchId(id)}
              metricType="ev"
            />
          </div>

          {/* Fila 3: Mais Confiáveis */}
          <div className="grid grid-cols-1 gap-8">
            <RankingTable
              title="🎯 Top 10 Jogos Mais Confiáveis"
              subtitle="Partidas com o maior score de consistência de dados históricos, liquidez do mercado e estabilidade de forma recente."
              matches={rankings.top_confidence}
              onOpenAnalysis={(id) => setActiveMatchId(id)}
              metricType="confidence"
            />
          </div>
        </div>
      )}

      {/* Modal de Análise глубокая */}
      {activeMatchId !== null && (
        <AnalysisModal
          matchId={activeMatchId}
          onClose={() => setActiveMatchId(null)}
        />
      )}
    </div>
  );
}
