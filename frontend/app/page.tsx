"use client";

import React, { useState, useEffect } from "react";
import FilterSidebar from "../components/filter-sidebar";
import MatchCard from "../components/match-card";
import AnalysisModal from "../components/analysis-modal";
import { RefreshCw, BarChart2, ShieldAlert, BadgePercent, CheckCircle2 } from "lucide-react";

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

export default function Dashboard() {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [filteredMatches, setFilteredMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeMatchId, setActiveMatchId] = useState<number | null>(null);
  
  // URL da API
  const [apiUrl, setApiUrl] = useState("http://localhost:8000");

  // Filtros
  const [filters, setFilters] = useState({
    search: "",
    league: "all",
    minEdge: 0,
    minConfidence: 0,
    entryType: "all",
  });

  // Lista de Campeonatos disponíveis para o filtro
  const [leagues, setLeagues] = useState<string[]>([]);

  // Carregar Jogos
  const loadMatches = (showLoader = true) => {
    if (showLoader) setLoading(true);
    const envApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    setApiUrl(envApiUrl);

    fetch(`${envApiUrl}/api/matches/`)
      .then((res) => res.json())
      .then((data) => {
        setMatches(data);
        setFilteredMatches(data);
        
        // Extrair ligas únicas dos jogos
        const uniqueLeagues: string[] = Array.from(
          new Set(data.map((m: MatchData) => m.league))
        );
        setLeagues(uniqueLeagues);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Erro ao carregar partidas:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadMatches();
  }, []);

  // Aplicar filtros localmente toda vez que um filtro ou a lista de jogos mudar
  useEffect(() => {
    let result = [...matches];

    // Busca textual por time
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (m) =>
          m.home_team.name.toLowerCase().includes(searchLower) ||
          m.away_team.name.toLowerCase().includes(searchLower)
      );
    }

    // Liga
    if (filters.league !== "all") {
      result = result.filter((m) => m.league === filters.league);
    }

    // Edge mínimo
    if (filters.minEdge > 0) {
      result = result.filter((m) => m.edge_val >= filters.minEdge);
    }

    // Confiança mínima
    if (filters.minConfidence > 0) {
      result = result.filter((m) => m.confidence_score >= filters.minConfidence);
    }

    // Tipo de entrada
    if (filters.entryType !== "all") {
      result = result.filter((m) =>
        m.recommendation.startsWith(filters.entryType)
      );
    }

    setFilteredMatches(result);
  }, [filters, matches]);

  // Sincronizar odds e rodar modelo
  const handleSync = () => {
    setSyncing(true);
    fetch(`${apiUrl}/api/matches/sync`, { method: "POST" })
      .then((res) => {
        if (res.ok) {
          loadMatches(false); // recarrega dados sem tela cheia de loading
        }
      })
      .catch((err) => console.error("Erro de sincronização:", err))
      .finally(() => setSyncing(false));
  };

  // Estatísticas do topo (resumo)
  const totalScanned = matches.length;
  const valueOpportunities = matches.filter((m) => m.edge_val >= 0.07).length; // Edge >= 7%
  
  // Média de EV positivo
  const positiveEVMatches = matches.filter((m) => m.ev_val > 0);
  const avgEV =
    positiveEVMatches.length > 0
      ? (positiveEVMatches.reduce((acc, curr) => acc + curr.ev_val, 0) / positiveEVMatches.length) * 100
      : 0.0;

  // Determinar se há algum alerta ativo (Edge > 10% ou EV > 12%)
  const hasAlerts = matches.some((m) => m.edge_val >= 0.10);

  return (
    <div className="space-y-8">
      {/* Seção Superior: Boas-vindas e Ação de Sync */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
            Scanner de Oportunidades
          </h1>
          <p className="text-sm text-slate-400 font-medium mt-1">
            Análise estatística em tempo real das próximas partidas do dia.
          </p>
        </div>
        
        {/* Botão de Sincronizar */}
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center justify-center space-x-2 bg-gradient-to-r from-accent to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white font-bold text-sm px-5 py-3 rounded-2xl border border-accent/20 transition-all shadow-lg shadow-accent/15 self-start disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          <span>{syncing ? "Sincronizando..." : "Sincronizar Odds & Jogos"}</span>
        </button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Scanned Matches */}
        <div className="glass rounded-2xl p-5 flex items-center space-x-4">
          <div className="p-3.5 rounded-xl bg-accent/10 border border-accent/20 text-accent">
            <BarChart2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Jogos Analisados</span>
            <span className="text-2xl font-black text-slate-200">{totalScanned}</span>
          </div>
        </div>

        {/* Card 2: Value Bets (Edge >= 7%) */}
        <div className="glass rounded-2xl p-5 flex items-center space-x-4">
          <div className="p-3.5 rounded-xl bg-success/10 border border-success/20 text-success">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Valor Alto (Edge &gt; 7%)</span>
            <span className="text-2xl font-black text-slate-200">{valueOpportunities}</span>
          </div>
        </div>

        {/* Card 3: Média EV */}
        <div className="glass rounded-2xl p-5 flex items-center space-x-4">
          <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <BadgePercent className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Média EV de Valor</span>
            <span className="text-2xl font-black text-slate-200">+{avgEV.toFixed(1)}%</span>
          </div>
        </div>

        {/* Card 4: Alertas Ativos */}
        <div className="glass rounded-2xl p-5 flex items-center space-x-4">
          <div className={`p-3.5 rounded-xl border ${
            hasAlerts 
              ? "bg-danger/10 border-danger/20 text-danger animate-pulse" 
              : "bg-slate-800/80 border-slate-700 text-slate-500"
          }`}>
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Alertas do Sistema</span>
            <span className={`text-sm font-bold ${hasAlerts ? "text-danger" : "text-slate-500"}`}>
              {hasAlerts ? "🚨 Edge > 10% detectado!" : "Nenhum alerta ativo"}
            </span>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal: Filtros + Grid de Jogos */}
      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Barra Lateral de Filtros */}
        <FilterSidebar
          filters={filters}
          onChange={setFilters}
          availableLeagues={leagues}
        />

        {/* Lista de Jogos */}
        <div className="flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-500 text-sm font-semibold">Carregando feed de futebol...</span>
            </div>
          ) : filteredMatches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredMatches.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  onOpenAnalysis={(id) => setActiveMatchId(id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center glass rounded-2xl p-8 border border-dashed border-border/80">
              <span className="text-4xl block mb-2">🔍</span>
              <h3 className="text-md font-bold text-slate-300">Nenhuma oportunidade encontrada</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                Tente redefinir seus filtros laterais ou reduzir o valor de Edge e Confiança exigido.
              </p>
            </div>
          )}
        </div>
      </div>

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
