from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from app.models import Match, Team
from app.schemas import TeamFormStats, MatchStatsAnalysis
from typing import List

def compile_team_stats(team_id: int, db: Session, limit: int = 20, venue: str = "all") -> TeamFormStats:
    """
    Compila estatísticas de gols, vitórias, empates, derrotas e forma recente.
    venue pode ser: "all" (todos os jogos), "home" (apenas em casa), "away" (apenas fora)
    """
    team = db.query(Team).filter(Team.id == team_id).first()
    team_name = team.name if team else "Desconhecido"

    # Filtros de partidas
    if venue == "home":
        query = db.query(Match).filter(
            and_(Match.home_team_id == team_id, Match.status == "finished")
        )
    elif venue == "away":
        query = db.query(Match).filter(
            and_(Match.away_team_id == team_id, Match.status == "finished")
        )
    else:
        query = db.query(Match).filter(
            and_(
                or_(Match.home_team_id == team_id, Match.away_team_id == team_id),
                Match.status == "finished"
            )
        )

    # Ordenar por data decrescente (mais recentes primeiro)
    matches = query.order_by(Match.date.desc()).limit(limit).all()
    
    # Inverter para ordem cronológica (antigas para novas) para a string de forma
    matches_chrono = list(reversed(matches))

    games_played = len(matches)
    wins = 0
    draws = 0
    losses = 0
    goals_scored = 0
    goals_conceded = 0
    form_list = []

    for m in matches_chrono:
        if m.home_team_id == team_id:
            g_scored = m.home_score if m.home_score is not None else 0
            g_conceded = m.away_score if m.away_score is not None else 0
            
            if g_scored > g_conceded:
                wins += 1
                form_list.append("V")
            elif g_scored == g_conceded:
                draws += 1
                form_list.append("E")
            else:
                losses += 1
                form_list.append("D")
        else:
            g_scored = m.away_score if m.away_score is not None else 0
            g_conceded = m.home_score if m.home_score is not None else 0
            
            if g_scored > g_conceded:
                wins += 1
                form_list.append("V")
            elif g_scored == g_conceded:
                draws += 1
                form_list.append("E")
            else:
                losses += 1
                form_list.append("D")

        goals_scored += g_scored
        goals_conceded += g_conceded

    avg_goals_scored = round(goals_scored / games_played, 2) if games_played > 0 else 0.0
    avg_goals_conceded = round(goals_conceded / games_played, 2) if games_played > 0 else 0.0
    
    # Criar string de forma (ex: V-E-V-D-V)
    recent_form_string = "-".join(form_list[-5:]) if form_list else "S/D"

    # Se for "all", pegamos adicionalmente a forma apenas em casa/fora para complementar
    home_or_away_form_str = "S/D"
    if venue == "all":
        sub_venue = "home" if team_id else "away" # apenas para chamar
        # Vamos buscar os últimos 5 em casa ou fora
        sub_query = db.query(Match).filter(
            and_(
                Match.home_team_id == team_id if venue == "home" else Match.away_team_id == team_id,
                Match.status == "finished"
            )
        ).order_by(Match.date.desc()).limit(5).all()
        sub_forms = []
        for sm in reversed(sub_query):
            if sm.home_team_id == team_id:
                if sm.home_score > sm.away_score: sub_forms.append("V")
                elif sm.home_score == sm.away_score: sub_forms.append("E")
                else: sub_forms.append("D")
            else:
                if sm.away_score > sm.home_score: sub_forms.append("V")
                elif sm.away_score == sm.home_score: sub_forms.append("E")
                else: sub_forms.append("D")
        home_or_away_form_str = "-".join(sub_forms) if sub_forms else "S/D"

    return TeamFormStats(
        team_name=team_name,
        games_played=games_played,
        wins=wins,
        draws=draws,
        losses=losses,
        goals_scored=goals_scored,
        goals_conceded=goals_conceded,
        avg_goals_scored=avg_goals_scored,
        avg_goals_conceded=avg_goals_conceded,
        recent_form_string=recent_form_string,
        home_or_away_form_string=home_or_away_form_str
    )

def compile_match_analysis(match: Match, db: Session) -> MatchStatsAnalysis:
    """
    Compila toda a análise estatística comparativa entre os dois times da partida.
    """
    # 1. Forma geral nos últimos 20 jogos
    home_stats = compile_team_stats(match.home_team_id, db, limit=20, venue="all")
    away_stats = compile_team_stats(match.away_team_id, db, limit=20, venue="all")
    
    # Sobrescreve home_or_away_form_string com o recorte específico (casa para mandante, fora para visitante)
    home_stats_specific = compile_team_stats(match.home_team_id, db, limit=5, venue="home")
    away_stats_specific = compile_team_stats(match.away_team_id, db, limit=5, venue="away")
    
    home_stats.home_or_away_form_string = home_stats_specific.recent_form_string
    away_stats.home_or_away_form_string = away_stats_specific.recent_form_string

    # 2. Histórico Confronto Direto (H2H)
    h2h_matches = db.query(Match).filter(
        and_(
            or_(
                and_(Match.home_team_id == match.home_team_id, Match.away_team_id == match.away_team_id),
                and_(Match.home_team_id == match.away_team_id, Match.away_team_id == match.home_team_id)
            ),
            Match.status == "finished"
        )
    ).order_by(Match.date.desc()).all()

    h2h_matches_played = len(h2h_matches)
    h2h_home_wins = 0
    h2h_draws = 0
    h2h_away_wins = 0
    h2h_history = []

    for hm in h2h_matches[:5]:  # Mostrar no máximo os últimos 5 confrontos
        home_name = hm.home_team.name
        away_name = hm.away_team.name
        h_score = hm.home_score if hm.home_score is not None else 0
        a_score = hm.away_score if hm.away_score is not None else 0
        h2h_history.append(f"{home_name} {h_score} x {a_score} {away_name}")

    for hm in h2h_matches:
        h_score = hm.home_score if hm.home_score is not None else 0
        a_score = hm.away_score if hm.away_score is not None else 0
        
        # Classifica de acordo com a perspectiva do time da casa na partida ATUAL
        # Se na partida histórica o time da casa atual jogou em casa
        if hm.home_team_id == match.home_team_id:
            if h_score > a_score:
                h2h_home_wins += 1
            elif h_score == a_score:
                h2h_draws += 1
            else:
                h2h_away_wins += 1
        # Se na partida histórica o time da casa atual jogou fora de casa
        else:
            if a_score > h_score:
                h2h_home_wins += 1
            elif a_score == h_score:
                h2h_draws += 1
            else:
                h2h_away_wins += 1

    return MatchStatsAnalysis(
        match_id=match.id,
        home_stats=home_stats,
        away_stats=away_stats,
        h2h_matches_played=h2h_matches_played,
        h2h_home_wins=h2h_home_wins,
        h2h_draws=h2h_draws,
        h2h_away_wins=h2h_away_wins,
        h2h_history=h2h_history
    )
