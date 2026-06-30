"use client";

import React from "react";

interface FilterState {
  search: string;
  league: string;
  minEdge: number;
  minConfidence: number;
  entryType: string;
}

interface FilterSidebarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  availableLeagues: string[];
}

export default function FilterSidebar({
  filters,
  onChange,
  availableLeagues,
}: FilterSidebarProps) {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, search: e.target.value });
  };

  const handleLeagueChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...filters, league: e.target.value });
  };

  const handleEdgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, minEdge: parseFloat(e.target.value) });
  };

  const handleConfidenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, minConfidence: parseInt(e.target.value, 10) });
  };

  const handleEntryTypeChange = (type: string) => {
    onChange({ ...filters, entryType: type });
  };

  const clearFilters = () => {
    onChange({
      search: "",
      league: "all",
      minEdge: 0,
      minConfidence: 0,
      entryType: "all",
    });
  };

  return (
    <aside className="w-full lg:w-64 glass rounded-2xl p-6 flex flex-col space-y-6 self-start">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h2 className="text-md font-bold tracking-wide text-slate-200 uppercase">Filtros de Análise</h2>
        <button
          onClick={clearFilters}
          className="text-xs text-accent hover:underline font-semibold"
        >
          Limpar
        </button>
      </div>

      {/* Busca */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Buscar Time</label>
        <div className="relative">
          <input
            type="text"
            value={filters.search}
            onChange={handleSearchChange}
            placeholder="Ex: Flamengo, Chelsea..."
            className="w-full bg-slate-900 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-slate-200 transition-colors"
          />
        </div>
      </div>

      {/* Campeonato */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Campeonato</label>
        <select
          value={filters.league}
          onChange={handleLeagueChange}
          className="w-full bg-slate-900 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-accent text-slate-200 transition-colors"
        >
          <option value="all">Todos os Campeonatos</option>
          {availableLeagues.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {/* Tipo de Entrada */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Recomendação</label>
        <div className="grid grid-cols-2 gap-2">
          {["all", "BACK", "LAY"].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleEntryTypeChange(type)}
              className={`py-2 px-3 text-xs font-bold rounded-xl transition-all border ${
                filters.entryType === type
                  ? "bg-accent border-accent text-white"
                  : "bg-slate-900 border-border text-slate-400 hover:text-slate-200 hover:border-slate-700"
              } ${type === "all" ? "col-span-2" : ""}`}
            >
              {type === "all" ? "Todas as Entradas" : type}
            </button>
          ))}
        </div>
      </div>

      {/* Slider de Edge */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
          <span>Edge Mínimo</span>
          <span className="text-success font-mono font-bold">{(filters.minEdge * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="0.20"
          step="0.01"
          value={filters.minEdge}
          onChange={handleEdgeChange}
          className="w-full accent-accent bg-slate-900 h-1.5 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>0%</span>
          <span>10%</span>
          <span>20%</span>
        </div>
      </div>

      {/* Slider de Confiança */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
          <span>Confiança Mínima</span>
          <span className="text-accent font-mono font-bold">{filters.minConfidence}</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={filters.minConfidence}
          onChange={handleConfidenceChange}
          className="w-full accent-accent bg-slate-900 h-1.5 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>
    </aside>
  );
}
