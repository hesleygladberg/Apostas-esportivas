from app.models import Match
from sqlalchemy.orm import Session
from app.services.stats_compiler import compile_match_analysis
from app.services.poisson_model import calculate_match_probabilities, calculate_over_under_probabilities, calculate_btts_probabilities
from app.schemas import AdvancedMatchAnalysis, ConfidenceBreakdown, MarketDetail, LayDrawMarket, LiquidityDetails
from typing import Tuple, Dict, List, Optional
import random

def scan_match_value(match: Match, db: Session) -> Tuple[str, float, float, int, str]:
    """
    Analisa as odds do mercado vs as odds justas do modelo de Poisson.
    Retorna (recommendation, edge, ev, confidence, justification)
    """
    if not match.prob_home or not match.prob_draw or not match.prob_away:
        return "SEM ENTRADA", 0.0, 0.0, 0, "Sem dados probabilísticos calculados."

    # 1. Odds de mercado
    oh = match.odd_home if match.odd_home else 1.0
    od = match.odd_draw if match.odd_draw else 1.0
    oa = match.odd_away if match.odd_away else 1.0

    # 2. Probabilidades do modelo
    ph = match.prob_home
    pd = match.prob_draw
    pa = match.prob_away

    # 3. Calcular Edge/EV de cada resultado (Edge = P * Odd - 1)
    edge_h = (ph * oh) - 1.0
    edge_d = (pd * od) - 1.0
    edge_a = (pa * oa) - 1.0

    # 4. Calcular Score de Confiança (0 a 100)
    # Buscamos as estatísticas compiladas para verificar densidade de dados
    stats = compile_match_analysis(match, db)
    
    conf_score = 0
    # Densidade de dados dos times (Máx 40 pontos)
    home_games = stats.home_stats.games_played
    away_games = stats.away_stats.games_played
    if home_games >= 15 and away_games >= 15:
        conf_score += 40
    elif home_games >= 10 and away_games >= 10:
        conf_score += 25
    else:
        conf_score += 10

    # Confronto Direto H2H (Máx 25 pontos)
    h2h_count = stats.h2h_matches_played
    if h2h_count >= 5:
        conf_score += 25
    elif h2h_count >= 3:
        conf_score += 15
    elif h2h_count >= 1:
        conf_score += 10
        
    # Liquidez do mercado (Máx 15 pontos)
    volume = match.odd_volume if match.odd_volume else 0
    if volume > 50000:
        conf_score += 15
    elif volume > 10000:
        conf_score += 10
    else:
        conf_score += 5

    # Consistência de resultados recentes (Máx 20 pontos)
    # Penaliza se o time tiver uma forma "S/D" (Sem Dados)
    if stats.home_stats.recent_form_string != "S/D" and stats.away_stats.recent_form_string != "S/D":
        conf_score += 20
    else:
        conf_score += 5

    # 5. Algoritmo de Recomendação e Justificativa
    rec = "SEM ENTRADA"
    best_edge = 0.0
    justification = ""

    # Critérios de BACK: Edge positivo relevante, odd mínima e confiança moderada
    # Critérios de LAY: Favoritos supervalorizados pelo mercado (Odd baixa com Edge Back muito negativo)
    
    # Avaliar Mandante
    if edge_h >= 0.04 and oh >= 1.35 and conf_score >= 45:
        rec = "BACK MANDANTE"
        best_edge = edge_h
        justification = (
            f"Valor encontrado no Mandante. Probabilidade do modelo de {ph:.1%} projeta odd justa de "
            f"{match.fair_home:.2f}, contra {oh:.2f} oferecida pelo mercado. Edge de {edge_h:.1%}."
        )
    # Avaliar Visitante
    elif edge_a >= 0.04 and oa >= 1.40 and conf_score >= 45:
        rec = "BACK VISITANTE"
        best_edge = edge_a
        justification = (
            f"Valor encontrado no Visitante. Probabilidade do modelo de {pa:.1%} projeta odd justa de "
            f"{match.fair_away:.2f}, contra {oa:.2f} oferecida pelo mercado. Edge de {edge_a:.1%}."
        )
    # Avaliar Empate
    elif edge_d >= 0.05 and od >= 2.80 and conf_score >= 45:
        rec = "BACK EMPATE"
        best_edge = edge_d
        justification = (
            f"Valor encontrado no Empate. Probabilidade do modelo de {pd:.1%} projeta odd justa de "
            f"{match.fair_draw:.2f}, contra {od:.2f} oferecida pelo mercado. Edge de {edge_d:.1%}."
        )
    # Avaliar LAY ao favorito da Casa (Mercado supervalorizando o mandante)
    elif edge_h <= -0.06 and oh <= 2.20 and conf_score >= 45:
        rec = "LAY MANDANTE"
        # O Edge do LAY é o inverso do Edge do BACK
        best_edge = abs(edge_h)
        justification = (
            f"Mandante supervalorizado. O mercado oferece odd de {oh:.2f} (probabilidade implícita de {1/oh:.1%}), "
            f"enquanto nosso modelo projeta apenas {ph:.1%} de chances (odd justa de {match.fair_home:.2f}). "
            f"Excelente oportunidade para Lay com valor estatístico."
        )
    # Avaliar LAY ao favorito Visitante (Mercado supervalorizando o visitante)
    elif edge_a <= -0.06 and oa <= 2.20 and conf_score >= 45:
        rec = "LAY VISITANTE"
        best_edge = abs(edge_a)
        justification = (
            f"Visitante supervalorizado. O mercado oferece odd de {oa:.2f} (probabilidade implícita de {1/oa:.1%}), "
            f"enquanto nosso modelo projeta apenas {pa:.1%} de chances (odd justa de {match.fair_away:.2f}). "
            f"Excelente oportunidade para Lay com valor estatístico."
        )
    else:
        # Encontrar o melhor edge negativo/positivo menor
        edges = {"casa": edge_h, "empate": edge_d, "visitante": edge_a}
        best_key = max(edges, key=edges.get)
        best_edge = edges[best_key]
        justification = "Nenhuma distorção de odds significativa encontrada que atenda os critérios de liquidez e confiança."

    # EV em porcentagem é igual ao Edge
    ev_val = best_edge

    return rec, best_edge, ev_val, conf_score, justification


def compile_advanced_analysis(match: Match, db: Session) -> AdvancedMatchAnalysis:
    # 1. Obter estatísticas do jogo
    stats = compile_match_analysis(match, db)
    
    # 2. Obter probabilidades de Poisson e matriz
    ph, pd, pa, xg_h, xg_a, score_matrix = calculate_match_probabilities(
        match.home_team_id, match.away_team_id, match.league, db
    )
    
    # 3. Calcular Notas da Confiança
    home_games = stats.home_stats.games_played
    away_games = stats.away_stats.games_played
    
    # Ataque score (0-100)
    score_attack = min(98, max(45, int((stats.home_stats.avg_goals_scored + stats.away_stats.avg_goals_scored) / 2.8 * 85)))
    # Defesa score (0-100)
    score_defense = min(98, max(40, int((2.8 - (stats.home_stats.avg_goals_conceded + stats.away_stats.avg_goals_conceded) / 2.0) / 2.8 * 90)))
    
    # Forma score
    def parse_form_pts(form_str):
        if form_str == "S/D": return 5
        pts = 0
        for char in form_str.replace("-", ""):
            if char == "V": pts += 3
            elif char == "E": pts += 1
        return pts
        
    pts_home = parse_form_pts(stats.home_stats.recent_form_string)
    pts_away = parse_form_pts(stats.away_stats.recent_form_string)
    score_form = min(99, max(50, int((pts_home + pts_away) / 30.0 * 100)))
    
    # H2H score
    score_h2h = min(95, max(55, 60 + stats.h2h_matches_played * 7))
    
    # Volume score
    score_volume = min(98, max(35, 40 + (home_games + away_games) * 1.3))
    
    # Score Final
    final_score = int(score_attack * 0.25 + score_defense * 0.20 + score_form * 0.25 + score_h2h * 0.15 + score_volume * 0.15)
    
    breakdown = ConfidenceBreakdown(
        final_score=final_score,
        attack=score_attack,
        defense=score_defense,
        form=score_form,
        h2h=score_h2h,
        volume=score_volume
    )
    
    # 4. Mercados de Gols (Over/Under)
    under_probs = calculate_over_under_probabilities(score_matrix)
    goals_markets = []
    
    # Usar seed para gerar odds de mercado consistentes
    random.seed(match.id + 100)
    
    for threshold in [0.5, 1.5, 2.5, 3.5]:
        # Under
        p_under = under_probs[threshold]
        fair_under = round(1.0 / p_under, 2) if p_under > 0 else 999.0
        dist = random.choice([0.92, 0.95, 1.0, 1.04, 1.10])
        odd_market_under = max(1.02, round(fair_under * dist, 2))
        edge_under = (p_under * odd_market_under) - 1.0
        rec_under = "BACK UNDER" if edge_under > 0.05 and odd_market_under >= 1.40 else "SEM ENTRADA"
        
        goals_markets.append(MarketDetail(
            market=f"Under {threshold}",
            probabilidade=p_under,
            odd_justa=fair_under,
            odd_mercado=odd_market_under,
            edge=edge_under,
            recommendation=rec_under
        ))
        
        # Over
        p_over = 1.0 - p_under
        fair_over = round(1.0 / p_over, 2) if p_over > 0 else 999.0
        dist = random.choice([0.92, 0.95, 1.0, 1.04, 1.10])
        odd_market_over = max(1.02, round(fair_over * dist, 2))
        edge_over = (p_over * odd_market_over) - 1.0
        rec_over = "BACK OVER" if edge_over > 0.05 and odd_market_over >= 1.40 else "SEM ENTRADA"
        
        goals_markets.append(MarketDetail(
            market=f"Over {threshold}",
            probabilidade=p_over,
            odd_justa=fair_over,
            odd_mercado=odd_market_over,
            edge=edge_over,
            recommendation=rec_over
        ))
        
    # 5. Ambos Marcam (BTTS)
    p_btts_sim = calculate_btts_probabilities(score_matrix)
    fair_btts_sim = round(1.0 / p_btts_sim, 2) if p_btts_sim > 0 else 999.0
    dist_sim = random.choice([0.93, 0.97, 1.0, 1.03, 1.08])
    odd_market_btts_sim = max(1.02, round(fair_btts_sim * dist_sim, 2))
    edge_btts_sim = (p_btts_sim * odd_market_btts_sim) - 1.0
    rec_btts_sim = "BACK BTTS SIM" if edge_btts_sim > 0.05 and odd_market_btts_sim >= 1.40 else "SEM ENTRADA"
    
    p_btts_nao = 1.0 - p_btts_sim
    fair_btts_nao = round(1.0 / p_btts_nao, 2) if p_btts_nao > 0 else 999.0
    dist_nao = random.choice([0.93, 0.97, 1.0, 1.03, 1.08])
    odd_market_btts_nao = max(1.02, round(fair_btts_nao * dist_nao, 2))
    edge_btts_nao = (p_btts_nao * odd_market_btts_nao) - 1.0
    rec_btts_nao = "BACK BTTS NÃO" if edge_btts_nao > 0.05 and odd_market_btts_nao >= 1.40 else "SEM ENTRADA"
    
    btts_market = [
        MarketDetail(
            market="Ambos Marcam (Sim)",
            probabilidade=p_btts_sim,
            odd_justa=fair_btts_sim,
            odd_mercado=odd_market_btts_sim,
            edge=edge_btts_sim,
            recommendation=rec_btts_sim
        ),
        MarketDetail(
            market="Ambos Marcam (Não)",
            probabilidade=p_btts_nao,
            odd_justa=fair_btts_nao,
            odd_mercado=odd_market_btts_nao,
            edge=edge_btts_nao,
            recommendation=rec_btts_nao
        )
    ]
    
    # 6. Lay Empate (Lay Draw)
    fair_draw = round(1.0 / pd, 2) if pd > 0 else 999.0
    odd_draw_market = match.odd_draw if match.odd_draw else 3.40
    # Edge do LAY = 1 - (Probabilidade * Odd Mercado)
    edge_lay_draw = 1.0 - (pd * odd_draw_market)
    
    destacar_lay_draw = pd < 0.20 and edge_lay_draw > 0.10
    rec_lay_draw = "LAY EMPATE" if edge_lay_draw > 0.05 else "SEM ENTRADA"
    
    lay_draw = LayDrawMarket(
        probabilidade=pd,
        odd_justa=fair_draw,
        odd_mercado=odd_draw_market,
        edge=edge_lay_draw,
        recommendation=rec_lay_draw,
        destacar=destacar_lay_draw
    )
    
    # 7. Liquidez Betfair (Simulando API desconectada de forma padrão)
    liquidity = LiquidityDetails(
        liquidez_disponivel=round(match.odd_volume * 1.15, 2) if match.odd_volume else 0.0,
        volume_negociado=round(match.odd_volume * 9.2, 2) if match.odd_volume else 0.0,
        volume_correspondente=round(match.odd_volume * 7.4, 2) if match.odd_volume else 0.0,
        status="offline"
    )
    
    return AdvancedMatchAnalysis(
        match_id=match.id,
        confidence_breakdown=breakdown,
        goals_markets=goals_markets,
        btts_market=btts_market,
        lay_draw=lay_draw,
        liquidity=liquidity
    )
