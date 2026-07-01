import math
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models import Match, Team
from typing import Tuple, Dict, List

# Constantes de Fallback (Médias históricas gerais do futebol mundial caso o BD seja novo)
DEFAULT_LEAGUE_HOME_GOALS = 1.48
DEFAULT_LEAGUE_AWAY_GOALS = 1.15

def get_poisson_probability(k: int, lamb: float) -> float:
    """
    Calcula a PMF (Função de Massa de Probabilidade) de Poisson.
    P(k; lamb) = (lamb^k * e^-lamb) / k!
    """
    if lamb <= 0:
        return 1.0 if k == 0 else 0.0
    try:
        return (math.pow(lamb, k) * math.exp(-lamb)) / math.factorial(k)
    except OverflowError:
        return 0.0

def calculate_league_averages(league_name: str, db: Session) -> Tuple[float, float]:
    """
    Calcula a média de gols marcados pelos mandantes e visitantes na liga.
    """
    matches = db.query(Match).filter(
        and_(Match.league == league_name, Match.status == "finished")
    ).all()
    
    if not matches or len(matches) < 10:
        # Se houverem menos de 10 jogos no banco para essa liga, retorna o padrão do futebol
        return DEFAULT_LEAGUE_HOME_GOALS, DEFAULT_LEAGUE_AWAY_GOALS
        
    total_home_goals = sum(m.home_score for m in matches if m.home_score is not None)
    total_away_goals = sum(m.away_score for m in matches if m.away_score is not None)
    match_count = len(matches)
    
    avg_home = total_home_goals / match_count
    avg_away = total_away_goals / match_count
    
    # Prevenção de divisão por zero ou valores anômalos
    avg_home = max(0.5, avg_home)
    avg_away = max(0.5, avg_away)
    
    return avg_home, avg_away

def calculate_team_ratings(team_id: int, league_name: str, db: Session, league_avg_home: float, league_avg_away: float) -> Tuple[float, float, float, float]:
    """
    Calcula o poder ofensivo e defensivo de um time (jogando em casa ou fora).
    Retorna (home_attack, home_defense, away_attack, away_defense)
    """
    # 1. Jogos em Casa
    home_matches = db.query(Match).filter(
        and_(Match.home_team_id == team_id, Match.league == league_name, Match.status == "finished")
    ).all()
    
    if home_matches:
        home_goals_scored = sum(m.home_score for m in home_matches if m.home_score is not None)
        home_goals_conceded = sum(m.away_score for m in home_matches if m.away_score is not None)
        home_count = len(home_matches)
        
        avg_scored_home = home_goals_scored / home_count
        avg_conceded_home = home_goals_conceded / home_count
        
        home_attack = avg_scored_home / league_avg_home if league_avg_home > 0 else 1.0
        home_defense = avg_conceded_home / league_avg_away if league_avg_away > 0 else 1.0
    else:
        # Sem histórico, assume o padrão neutro (1.0)
        home_attack = 1.0
        home_defense = 1.0

    # 2. Jogos Fora
    away_matches = db.query(Match).filter(
        and_(Match.away_team_id == team_id, Match.league == league_name, Match.status == "finished")
    ).all()
    
    if away_matches:
        away_goals_scored = sum(m.away_score for m in away_matches if m.away_score is not None)
        away_goals_conceded = sum(m.home_score for m in away_matches if m.home_score is not None)
        away_count = len(away_matches)
        
        avg_scored_away = away_goals_scored / away_count
        avg_conceded_away = away_goals_conceded / away_count
        
        away_attack = avg_scored_away / league_avg_away if league_avg_away > 0 else 1.0
        away_defense = avg_conceded_away / league_avg_home if league_avg_home > 0 else 1.0
    else:
        away_attack = 1.0
        away_defense = 1.0

    # Adicionar limites mínimos e máximos para evitar distorções estatísticas bruscas
    home_attack = min(max(0.2, home_attack), 3.5)
    home_defense = min(max(0.2, home_defense), 3.5)
    away_attack = min(max(0.2, away_attack), 3.5)
    away_defense = min(max(0.2, away_defense), 3.5)

    return home_attack, home_defense, away_attack, away_defense

def calculate_match_probabilities(home_team_id: int, away_team_id: int, league_name: str, db: Session) -> Tuple[float, float, float, float, float, Dict[str, float]]:
    """
    Calcula gols esperados, probabilidades 1X2 e matriz de placar.
    Retorna (prob_home, prob_draw, prob_away, expected_home_goals, expected_away_goals, score_matrix)
    """
    # 1. Médias da liga
    league_avg_home, league_avg_away = calculate_league_averages(league_name, db)
    
    # 2. Ratings dos times
    home_attack, home_defense, _, _ = calculate_team_ratings(home_team_id, league_name, db, league_avg_home, league_avg_away)
    _, _, away_attack, away_defense = calculate_team_ratings(away_team_id, league_name, db, league_avg_home, league_avg_away)
    
    # 3. Gols Esperados (xG)
    expected_home = home_attack * away_defense * league_avg_home
    expected_away = away_attack * home_defense * league_avg_away
    
    # Garantir xG positivo mínimo
    expected_home = max(0.1, expected_home)
    expected_away = max(0.1, expected_away)

    # 4. Matriz de Placares (Calculada até 8 gols para cada time)
    max_goals = 8
    score_matrix = {}
    
    prob_home = 0.0
    prob_draw = 0.0
    prob_away = 0.0
    
    for i in range(max_goals + 1):
        for j in range(max_goals + 1):
            p_home_i = get_poisson_probability(i, expected_home)
            p_away_j = get_poisson_probability(j, expected_away)
            p_cell = p_home_i * p_away_j
            
            score_matrix[f"{i}x{j}"] = p_cell
            
            if i > j:
                prob_home += p_cell
            elif i == j:
                prob_draw += p_cell
            else:
                prob_away += p_cell

    # 5. Normalizar para somar exatamente 100%
    total_prob = prob_home + prob_draw + prob_away
    if total_prob > 0:
        prob_home = prob_home / total_prob
        prob_draw = prob_draw / total_prob
        prob_away = prob_away / total_prob
        
        # Normalizar também as células da matriz
        for k in score_matrix:
            score_matrix[k] = score_matrix[k] / total_prob

    return prob_home, prob_draw, prob_away, expected_home, expected_away, score_matrix


def calculate_over_under_probabilities(score_matrix: Dict[str, float]) -> Dict[float, float]:
    """
    Calcula as probabilidades de Under/Over para 0.5, 1.5, 2.5, 3.5 gols.
    Retorna um dicionário {threshold: prob_under}
    """
    under_probs = {0.5: 0.0, 1.5: 0.0, 2.5: 0.0, 3.5: 0.0}
    
    for score_key, prob in score_matrix.items():
        try:
            h, a = map(int, score_key.split("x"))
            total_goals = h + a
            for threshold in under_probs.keys():
                if total_goals < threshold:
                    under_probs[threshold] += prob
        except ValueError:
            continue
            
    return under_probs


def calculate_btts_probabilities(score_matrix: Dict[str, float]) -> float:
    """
    Calcula a probabilidade de Ambos Marcam (BTTS Sim).
    Retorna a probabilidade (0.0 a 1.0) de BTTS Sim.
    """
    btts_sim = 0.0
    for score_key, prob in score_matrix.items():
        try:
            h, a = map(int, score_key.split("x"))
            if h > 0 and a > 0:
                btts_sim += prob
        except ValueError:
            continue
            
    return btts_sim
