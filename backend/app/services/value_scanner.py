from app.models import Match
from sqlalchemy.orm import Session
from app.services.stats_compiler import compile_match_analysis
from typing import Tuple, Dict

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
