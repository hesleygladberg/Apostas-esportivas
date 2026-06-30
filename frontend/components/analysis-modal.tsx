"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Send, Bot, User, Percent, BarChart3, Grid3X3, MessageSquare, ShieldAlert } from "lucide-react";

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

interface TeamFormStats {
  team_name: string;
  games_played: int;
  wins: number;
  draws: number;
  losses: number;
  goals_scored: number;
  goals_conceded: number;
  avg_goals_scored: number;
  avg_goals_conceded: number;
  recent_form_string: string;
  home_or_away_form_string: string;
}

interface MatchStatsAnalysis {
  match_id: number;
  home_stats: TeamFormStats;
  away_stats: TeamFormStats;
  h2h_matches_played: number;
  h2h_home_wins: number;
  h2h_draws: number;
  h2h_away_wins: number;
  h2h_history: string[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AnalysisModalProps {
  matchId: number;
  onClose: () => void;
}

export default function AnalysisModal({ matchId, onClose }: AnalysisModalProps) {
  const [match, setMatch] = useState<MatchData | null>(null);
  const [stats, setStats] = useState<MatchStatsAnalysis | null>(null);
  const [poissonMatrix, setPoissonMatrix] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<"overview" | "stats" | "poisson" | "chat">("overview");
  
  // Chat States
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Olá! Sou o assistente estatístico do Trade Scanner AI. Posso explicar a justificativa da entrada, detalhar os riscos defensivos das equipes ou analisar as médias de gols do jogo. O que gostaria de saber?",
    },
  ]);
  const [inputMsg, setInputMsg] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [apiUrl, setApiUrl] = useState("http://localhost:8000");

  useEffect(() => {
    const envApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    setApiUrl(envApiUrl);
    
    // Carregar todas as informações em paralelo
    setLoading(true);
    Promise.all([
      fetch(`${envApiUrl}/api/matches/${matchId}`).then((res) => res.json()),
      fetch(`${envApiUrl}/api/matches/${matchId}/stats`).then((res) => res.json()),
      fetch(`${envApiUrl}/api/matches/${matchId}/poisson-matrix`).then((res) => res.json()),
    ])
      .then(([matchData, statsData, matrixData]) => {
        setMatch(matchData);
        setStats(statsData);
        setPoissonMatrix(matrixData);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Erro ao buscar detalhes da partida:", err);
        setLoading(false);
      });
  }, [matchId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-slate-300">Carregando análise profunda...</span>
        </div>
      </div>
    );
  }

  if (!match) return null;

  // Cálculo da Gestão de Banca (Fórmula do Critério de Kelly)
  // Kelly % = (Edge) / (Odd - 1)
  // Usamos uma fração conservadora (1/10 ou "Fractional Kelly") para proteção de banca
  const calculateKelly = () => {
    if (match.edge_val <= 0) return 0;
    let odd = 1.0;
    if (match.recommendation === "BACK HOME") odd = match.odd_home || 1.0;
    else if (match.recommendation === "BACK AWAY") odd = match.odd_away || 1.0;
    else if (match.recommendation === "BACK DRAW") odd = match.odd_draw || 1.0;
    else if (match.recommendation === "LAY HOME") odd = match.odd_home || 1.0;
    else if (match.recommendation === "LAY AWAY") odd = match.odd_away || 1.0;

    if (odd <= 1) return 0;
    
    // Critério de Kelly Puro
    const rawKelly = match.edge_val / (odd - 1);
    
    // Fração conservadora (10% do Kelly)
    const fractionalKelly = rawKelly * 0.1 * 100;
    return Math.min(Math.max(0, fractionalKelly), 5.0); // Limita em máximo 5% da banca por segurança
  };

  const kellyStake = calculateKelly();

  // Enviar Mensagem para o Chat do Gemini
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const userMessage = inputMsg;
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInputMsg("");
    setIsTyping(true);

    fetch(`${apiUrl}/api/assistant/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        match_id: match.id,
        message: userMessage,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
        setIsTyping(false);
      })
      .catch((err) => {
        console.error("Erro no chat com o assistente:", err);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Erro de conexão. Verifique se o servidor FastAPI está rodando.",
          },
        ]);
        setIsTyping(false);
      });
  };

  // Funções Auxiliares de Cores de Célula na Matriz de Poisson
  const getPoissonCellColor = (prob: number) => {
    // Escala de violeta (accent) baseada na probabilidade
    // Probabilidade máxima costuma ser de 10% a 15% em placares comuns
    const opacity = Math.min(prob * 7, 0.95);
    return {
      backgroundColor: `rgba(139, 92, 246, ${opacity})`,
      color: opacity > 0.4 ? "#fff" : "#cbd5e1",
    };
  };

  return (
    <div className="fixed inset-0 bg-[#06080e]/95 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Modal Container */}
      <div className="bg-[#0f1626] border border-border w-full max-w-5xl h-[85vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl shadow-accent/5">
        
        {/* Cabeçalho */}
        <div className="p-6 border-b border-border bg-[#131d31] flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
              <span>⚽ {match.league}</span>
              <span>•</span>
              <span>{new Date(match.date).toLocaleDateString("pt-BR")}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
              {match.home_team.name} <span className="text-accent">x</span> {match.away_team.name}
            </h1>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 border border-border hover:border-slate-700 transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-border bg-[#0d1322] px-6">
          {[
            { id: "overview", label: "Visão Geral", icon: Percent },
            { id: "stats", label: "Estatísticas & H2H", icon: BarChart3 },
            { id: "poisson", label: "Matriz de Poisson", icon: Grid3X3 },
            { id: "chat", label: "Chat IA Assistant", icon: MessageSquare },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 px-4 text-xs sm:text-sm font-bold border-b-2 -mb-[2px] transition-colors ${
                  activeTab === tab.id
                    ? "border-accent text-accent"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Conteúdo das Abas */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#0c1220]">
          
          {/* ABA 1: VISÃO GERAL */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Cards Rápidos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Detalhe da Entrada */}
                <div className="bg-[#121927] border border-border rounded-2xl p-5 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Entrada Recomendada</span>
                    <span className={`text-2xl font-black ${
                      match.recommendation.startsWith("BACK") ? "text-success" : match.recommendation.startsWith("LAY") ? "text-danger" : "text-slate-400"
                    }`}>
                      {match.recommendation}
                    </span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400 leading-relaxed">
                    {match.explanation}
                  </div>
                </div>

                {/* Métricas de Valor */}
                <div className="bg-[#121927] border border-border rounded-2xl p-5 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Indicadores de Valor</span>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Edge %</span>
                        <span className={`text-xl font-bold ${match.edge_val > 0 ? "text-success" : "text-slate-400"}`}>
                          {match.edge_val > 0 ? `+${(match.edge_val * 100).toFixed(1)}%` : "0.0%"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Valor Esp. (EV)</span>
                        <span className={`text-xl font-bold ${match.ev_val > 0 ? "text-success" : "text-slate-400"}`}>
                          {match.ev_val > 0 ? `+${(match.ev_val * 100).toFixed(1)}%` : "0.0%"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-500 leading-snug">
                    Edge positivo indica que as odds oferecidas pelo mercado estão acima do preço justo projetado pelo modelo matemático.
                  </div>
                </div>

                {/* Gestão de Banca - Kelly */}
                <div className="bg-[#121927] border border-border rounded-2xl p-5 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Gestão de Banca</span>
                    <div className="flex items-baseline space-x-1">
                      <span className={`text-3xl font-black ${kellyStake > 0 ? "text-accent" : "text-slate-500"}`}>
                        {kellyStake > 0 ? `${kellyStake.toFixed(1)}%` : "0.0%"}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">da banca</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400 leading-relaxed">
                    {kellyStake > 0 ? (
                      <span>Sugerido **{kellyStake.toFixed(1)}%** do saldo total utilizando o **Critério de Kelly Fracionário (10% de peso)** para reduzir a volatilidade.</span>
                    ) : (
                      <span>Entrada de valor estatístico não identificada. Gestão recomenda **não investir** saldo nesta partida.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabela Comparativa de Probabilidades */}
              <div className="bg-[#121927] border border-border rounded-2xl p-6">
                <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wide">Mapeamento de Probabilidades</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-800 text-left">
                        <th className="pb-3">Resultado</th>
                        <th className="pb-3 text-center">Prob. Modelo</th>
                        <th className="pb-3 text-center">Odd Justa</th>
                        <th className="pb-3 text-center">Odd Mercado</th>
                        <th className="pb-3 text-center">Edge</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      <tr>
                        <td className="py-3.5 font-semibold text-slate-200">Vitória {match.home_team.name} (1)</td>
                        <td className="text-center font-mono">{(match.prob_home! * 100).toFixed(1)}%</td>
                        <td className="text-center font-mono font-bold text-accent">{match.fair_home?.toFixed(2)}</td>
                        <td className="text-center font-mono text-slate-300">{match.odd_home?.toFixed(2)}</td>
                        <td className="text-center font-mono">
                          <span className={((match.prob_home! * match.odd_home!) - 1.0) > 0 ? "text-success font-semibold" : "text-slate-500"}>
                            {(((match.prob_home! * match.odd_home!) - 1.0) * 100).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3.5 font-semibold text-slate-200">Empate (X)</td>
                        <td className="text-center font-mono">{(match.prob_draw! * 100).toFixed(1)}%</td>
                        <td className="text-center font-mono font-bold text-accent">{match.fair_draw?.toFixed(2)}</td>
                        <td className="text-center font-mono text-slate-300">{match.odd_draw?.toFixed(2)}</td>
                        <td className="text-center font-mono">
                          <span className={((match.prob_draw! * match.odd_draw!) - 1.0) > 0 ? "text-success font-semibold" : "text-slate-500"}>
                            {(((match.prob_draw! * match.odd_draw!) - 1.0) * 100).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3.5 font-semibold text-slate-200">Vitória {match.away_team.name} (2)</td>
                        <td className="text-center font-mono">{(match.prob_away! * 100).toFixed(1)}%</td>
                        <td className="text-center font-mono font-bold text-accent">{match.fair_away?.toFixed(2)}</td>
                        <td className="text-center font-mono text-slate-300">{match.odd_away?.toFixed(2)}</td>
                        <td className="text-center font-mono">
                          <span className={((match.prob_away! * match.odd_away!) - 1.0) > 0 ? "text-success font-semibold" : "text-slate-500"}>
                            {(((match.prob_away! * match.odd_away!) - 1.0) * 100).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: ESTATÍSTICAS & H2H */}
          {activeTab === "stats" && stats && (
            <div className="space-y-6">
              
              {/* Comparativo de Forma e Médias */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Estatísticas Mandante */}
                <div className="bg-[#121927] border border-border rounded-2xl p-6">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <h3 className="font-bold text-slate-200 text-sm uppercase">Mandante: {match.home_team.name}</h3>
                    <span className="text-xs bg-slate-900 border border-border px-2.5 py-1 rounded-lg font-mono text-slate-400">
                      Últimos {stats.home_stats.games_played} jogos
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Linha Forma */}
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400 font-semibold">Forma Recente (Geral)</span>
                      <div className="flex space-x-1 font-mono text-xs">
                        {stats.home_stats.recent_form_string.split("-").map((char, idx) => (
                          <span
                            key={idx}
                            className={`w-5 h-5 rounded-md flex items-center justify-center font-bold ${
                              char === "V" ? "bg-success/20 text-success" : char === "E" ? "bg-slate-700 text-slate-300" : "bg-danger/20 text-danger"
                            }`}
                          >
                            {char}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400 font-semibold">Forma como Mandante (5 j)</span>
                      <div className="flex space-x-1 font-mono text-xs">
                        {stats.home_stats.home_or_away_form_string.split("-").map((char, idx) => (
                          <span
                            key={idx}
                            className={`w-5 h-5 rounded-md flex items-center justify-center font-bold ${
                              char === "V" ? "bg-success/20 text-success" : char === "E" ? "bg-slate-700 text-slate-300" : "bg-danger/20 text-danger"
                            }`}
                          >
                            {char}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-slate-800/40 pt-4 grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Gols Marcados (Média)</span>
                        <span className="text-xl font-bold font-mono text-slate-200">{stats.home_stats.goals_scored} ({stats.home_stats.avg_goals_scored})</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Gols Sofridos (Média)</span>
                        <span className="text-xl font-bold font-mono text-slate-200">{stats.home_stats.goals_conceded} ({stats.home_stats.avg_goals_conceded})</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Estatísticas Visitante */}
                <div className="bg-[#121927] border border-border rounded-2xl p-6">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <h3 className="font-bold text-slate-200 text-sm uppercase">Visitante: {match.away_team.name}</h3>
                    <span className="text-xs bg-slate-900 border border-border px-2.5 py-1 rounded-lg font-mono text-slate-400">
                      Últimos {stats.away_stats.games_played} jogos
                    </span>
                  </div>

                  <div className="space-y-4">
                    {/* Linha Forma */}
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400 font-semibold">Forma Recente (Geral)</span>
                      <div className="flex space-x-1 font-mono text-xs">
                        {stats.away_stats.recent_form_string.split("-").map((char, idx) => (
                          <span
                            key={idx}
                            className={`w-5 h-5 rounded-md flex items-center justify-center font-bold ${
                              char === "V" ? "bg-success/20 text-success" : char === "E" ? "bg-slate-700 text-slate-300" : "bg-danger/20 text-danger"
                            }`}
                          >
                            {char}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400 font-semibold">Forma como Visitante (5 j)</span>
                      <div className="flex space-x-1 font-mono text-xs">
                        {stats.away_stats.home_or_away_form_string.split("-").map((char, idx) => (
                          <span
                            key={idx}
                            className={`w-5 h-5 rounded-md flex items-center justify-center font-bold ${
                              char === "V" ? "bg-success/20 text-success" : char === "E" ? "bg-slate-700 text-slate-300" : "bg-danger/20 text-danger"
                            }`}
                          >
                            {char}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-slate-800/40 pt-4 grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Gols Marcados (Média)</span>
                        <span className="text-xl font-bold font-mono text-slate-200">{stats.away_stats.goals_scored} ({stats.away_stats.avg_goals_scored})</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Gols Sofridos (Média)</span>
                        <span className="text-xl font-bold font-mono text-slate-200">{stats.away_stats.goals_conceded} ({stats.away_stats.avg_goals_conceded})</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confronto Direto (H2H) */}
              <div className="bg-[#121927] border border-border rounded-2xl p-6">
                <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wide">Histórico Confronto Direto (H2H)</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  
                  {/* Resumo Placar H2H */}
                  <div className="md:col-span-1 flex flex-col items-center justify-center text-center p-4 bg-slate-900/40 border border-slate-800/60 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-3">Retrospecto total</span>
                    <div className="flex space-x-6 text-sm font-bold">
                      <div>
                        <span className="text-2xl font-black text-slate-200">{stats.h2h_home_wins}</span>
                        <span className="text-[10px] block text-slate-500 mt-1">Vit {match.home_team.name}</span>
                      </div>
                      <div className="border-x border-slate-800 px-6">
                        <span className="text-2xl font-black text-slate-200">{stats.h2h_draws}</span>
                        <span className="text-[10px] block text-slate-500 mt-1">Empates</span>
                      </div>
                      <div>
                        <span className="text-2xl font-black text-slate-200">{stats.h2h_away_wins}</span>
                        <span className="text-[10px] block text-slate-500 mt-1">Vit {match.away_team.name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Placares Recentes */}
                  <div className="md:col-span-2 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Últimos Confrontos</span>
                    {stats.h2h_history.length > 0 ? (
                      stats.h2h_history.map((h, idx) => (
                        <div key={idx} className="bg-slate-900/60 border border-border/40 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-300 flex justify-between items-center">
                          <span>{h.split(" x ")[0]}</span>
                          <span className="font-mono bg-slate-800 px-2 py-0.5 rounded border border-border font-bold text-slate-200">
                            {h.match(/\d+\s*x\s*\d+/)?.[0] || "vs"}
                          </span>
                          <span>{h.split(" x ")[1]?.replace(/\d+\s*/, "") || ""}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-500 font-semibold italic p-4 text-center">Nenhum confronto histórico registrado no banco de dados.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA 3: MATRIZ DE POISSON */}
          {activeTab === "poisson" && (
            <div className="space-y-6">
              <div className="bg-[#121927] border border-border rounded-2xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3 mb-4 gap-2">
                  <div>
                    <h3 className="font-bold text-slate-200 text-sm uppercase">Matriz de Probabilidade de Placar Exato (Poisson)</h3>
                    <p className="text-[10px] text-slate-500 font-medium">As linhas representam os gols do Mandante e as colunas representam os gols do Visitante.</p>
                  </div>
                  <span className="text-xs bg-slate-900 border border-border px-3 py-1 rounded-full text-accent font-semibold self-start">
                    Mapeamento de Probabilidade (Heatmap)
                  </span>
                </div>

                <div className="overflow-x-auto mt-6">
                  <div className="min-w-[500px]">
                    {/* Header Colunas Gols Fora */}
                    <div className="grid grid-cols-6 gap-2 mb-2 text-center text-xs font-bold text-slate-400">
                      <div>Gols Casa \ Fora</div>
                      {Array.from({ length: 5 }).map((_, colIdx) => (
                        <div key={colIdx} className="bg-slate-900/50 py-2 border border-border/30 rounded-lg">{colIdx} {colIdx === 1 ? "Gol" : "Gols"}</div>
                      ))}
                    </div>

                    {/* Linhas */}
                    {Array.from({ length: 5 }).map((_, rowIdx) => (
                      <div key={rowIdx} className="grid grid-cols-6 gap-2 mb-2 text-center items-center">
                        {/* Header Linha Gols Casa */}
                        <div className="bg-slate-900/50 py-3 border border-border/30 rounded-lg text-xs font-bold text-slate-400">
                          {rowIdx} {rowIdx === 1 ? "Gol" : "Gols"}
                        </div>

                        {/* Células de Placar */}
                        {Array.from({ length: 5 }).map((_, colIdx) => {
                          const scoreKey = `${rowIdx}x${colIdx}`;
                          const prob = poissonMatrix[scoreKey] || 0.0;
                          return (
                            <div
                              key={colIdx}
                              style={getPoissonCellColor(prob)}
                              className="py-3 rounded-lg border border-slate-800/60 font-mono font-bold text-xs flex flex-col justify-center items-center transition-all hover:scale-[1.03] cursor-help relative group"
                              title={`Placar exato ${rowIdx} x ${colIdx}: ${(prob * 100).toFixed(2)}%`}
                            >
                              <span>{rowIdx} - {colIdx}</span>
                              <span className="text-[10px] mt-0.5 font-normal opacity-90">{(prob * 100).toFixed(1)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-800/60 pt-4 flex flex-col sm:flex-row sm:justify-between text-xs text-slate-500 font-medium gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded bg-accent/90" />
                    <span>Placares com maior probabilidade (Destaque Roxo)</span>
                  </div>
                  <p>Probabilidades derivadas do cruzamento de xG de ataque vs xG de defesa de ambos os times.</p>
                </div>
              </div>
            </div>
          )}

          {/* ABA 4: CHAT IA ASSISTANT */}
          {activeTab === "chat" && (
            <div className="h-[55vh] flex flex-col bg-[#0b0f19] border border-border/80 rounded-2xl overflow-hidden">
              {/* Box de Info */}
              <div className="bg-[#121927] border-b border-border/80 p-3 flex items-center space-x-2 text-xs text-amber-400">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>O assistente responde com base **exclusiva** nos dados computados pelo scanner. Ele não faz palpites subjetivos.</span>
              </div>

              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start space-x-3 max-w-[85%] ${m.role === "user" ? "ml-auto flex-row-reverse space-x-reverse" : ""}`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow ${
                      m.role === "user" ? "bg-accent" : "bg-slate-800 border border-slate-700 text-accent"
                    }`}>
                      {m.role === "user" ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className={`rounded-2xl p-4 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-accent/15 text-slate-200 border border-accent/20 rounded-tr-none"
                        : "bg-[#161f30] text-slate-300 border border-border rounded-tl-none"
                    }`}>
                      <div className="whitespace-pre-line">{m.content}</div>
                    </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="flex items-start space-x-3 max-w-[85%]">
                    <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 text-accent flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 animate-bounce" />
                    </div>
                    <div className="bg-[#161f30] text-slate-400 border border-border rounded-2xl rounded-tl-none p-4 text-sm flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input de Envio */}
              <form onSubmit={handleSendChat} className="border-t border-border p-3 flex bg-[#0c1220] items-center space-x-2">
                <input
                  type="text"
                  value={inputMsg}
                  onChange={(e) => setInputMsg(e.target.value)}
                  placeholder="Pergunte sobre os riscos defensivos, por que é lay ou back..."
                  className="flex-1 bg-slate-900 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-slate-200 transition-colors"
                />
                <button
                  type="submit"
                  className="p-2.5 rounded-xl bg-accent hover:bg-violet-600 text-white transition-colors border border-accent/20"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
