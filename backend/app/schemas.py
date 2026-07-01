from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List

# --- TEAM SCHEMAS ---
class TeamBase(BaseModel):
    name: str
    league: str
    country: str

class TeamCreate(TeamBase):
    pass

class TeamResponse(TeamBase):
    id: int

    class Config:
        from_attributes = True

# --- MATCH SCHEMAS ---
class MatchBase(BaseModel):
    date: datetime
    status: str
    league: str
    country: str
    home_team_id: int
    away_team_id: int
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    odd_home: Optional[float] = None
    odd_draw: Optional[float] = None
    odd_away: Optional[float] = None
    odd_volume: Optional[float] = 0.0

class MatchCreate(MatchBase):
    pass

class MatchSimpleResponse(MatchBase):
    id: int
    home_team: TeamResponse
    away_team: TeamResponse

    class Config:
        from_attributes = True

class MatchDetailResponse(BaseModel):
    id: int
    date: datetime
    status: str
    league: str
    country: str
    home_team: TeamResponse
    away_team: TeamResponse
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    
    # Odds de mercado
    odd_home: Optional[float] = None
    odd_draw: Optional[float] = None
    odd_away: Optional[float] = None
    odd_volume: float
    
    # Probabilidades do Modelo
    prob_home: Optional[float] = None
    prob_draw: Optional[float] = None
    prob_away: Optional[float] = None
    
    # Odds Justas
    fair_home: Optional[float] = None
    fair_draw: Optional[float] = None
    fair_away: Optional[float] = None
    
    # Valores Calculados
    edge_val: float
    ev_val: float
    confidence_score: int
    recommendation: str
    explanation: Optional[str] = None

    class Config:
        from_attributes = True

# --- STATS SCHEMAS ---
class TeamFormStats(BaseModel):
    team_name: str
    games_played: int
    wins: int
    draws: int
    losses: int
    goals_scored: int
    goals_conceded: int
    avg_goals_scored: float
    avg_goals_conceded: float
    recent_form_string: str  # e.g., "W-D-W-L-W"
    home_or_away_form_string: str

class MatchStatsAnalysis(BaseModel):
    match_id: int
    home_stats: TeamFormStats
    away_stats: TeamFormStats
    h2h_matches_played: int
    h2h_home_wins: int
    h2h_draws: int
    h2h_away_wins: int
    h2h_history: List[str]  # Lista de strings curtas dos placares passados

# --- AI ASSISTANT SCHEMAS ---
class ChatQuery(BaseModel):
    match_id: int
    message: str

class ChatResponse(BaseModel):
    reply: str

# --- RANKINGS SCHEMAS ---
class RankingsResponse(BaseModel):
    top_backs: List[MatchDetailResponse]
    top_lays: List[MatchDetailResponse]
    top_edges: List[MatchDetailResponse]
    top_ev: List[MatchDetailResponse]
    top_confidence: List[MatchDetailResponse]

    class Config:
        from_attributes = True
