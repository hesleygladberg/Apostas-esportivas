from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
from app.database import get_db
from app.models import Match, Team
from app.schemas import (
    MatchDetailResponse, MatchSimpleResponse, MatchStatsAnalysis, RankingsResponse,
    AdvancedMatchAnalysis, PerformanceHistoryResponse, RankingsAdvancedResponse,
    PerformancePeriod, PerformanceDataPoint
)
from app.services.data_fetcher import sync_matches_and_run_model
from app.services.stats_compiler import compile_match_analysis
from app.services.poisson_model import calculate_match_probabilities
from typing import List, Optional, Dict

router = APIRouter(prefix="/matches", tags=["matches"])

@router.get("/", response_model=List[MatchDetailResponse])
def get_matches(
    league: Optional[str] = Query(None, description="Filtrar por liga"),
    country: Optional[str] = Query(None, description="Filtrar por país"),
    min_edge: Optional[float] = Query(None, description="Filtrar por edge mínimo (ex: 0.05 para 5%)"),
    min_confidence: Optional[int] = Query(None, description="Filtrar por score de confiança mínimo"),
    recommendation: Optional[str] = Query(None, description="Filtrar por recomendação (ex: BACK HOME, LAY AWAY)"),
    status: str = Query("scheduled", description="Filtro de status: scheduled ou finished"),
    db: Session = Depends(get_db)
):
    """
    Retorna a lista de jogos analisados com base nos filtros fornecidos.
    """
    query = db.query(Match).filter(Match.status == status)
    
    if league:
        query = query.filter(Match.league == league)
    if country:
        query = query.filter(Match.country == country)
    if min_edge is not None:
        query = query.filter(Match.edge_val >= min_edge)
    if min_confidence is not None:
        query = query.filter(Match.confidence_score >= min_confidence)
    if recommendation:
        query = query.filter(Match.recommendation == recommendation)
        
    # Ordenar por data (jogos mais próximos primeiro)
    return query.order_by(Match.date.asc()).all()


@router.post("/sync", status_code=status.HTTP_200_OK)
def sync_data(db: Session = Depends(get_db)):
    """
    Sincroniza os jogos do dia (ou gera os mocks) e roda o modelo estatístico para calcular
    as probabilidades e identificar apostas de valor.
    """
    try:
        sync_matches_and_run_model(db)
        return {"message": "Sincronização e modelagem de Poisson concluídas com sucesso!"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro durante a sincronização: {str(e)}"
        )


@router.get("/rankings", response_model=RankingsResponse)
def get_rankings(db: Session = Depends(get_db)):
    """
    Gera automaticamente os rankings diários (Top 10):
    1. Top 10 Back
    2. Top 10 Lay
    3. Top 10 Maiores Edges
    4. Top 10 Maiores EV
    5. Top 10 Confiança
    """
    base_query = db.query(Match).filter(Match.status == "scheduled")

    # 1. Top 10 Backs (Apenas recomendações contendo BACK)
    top_backs = base_query.filter(Match.recommendation.like("%BACK%")).order_by(desc(Match.edge_val)).limit(10).all()

    # 2. Top 10 Lays (Apenas recomendações contendo LAY)
    top_lays = base_query.filter(Match.recommendation.like("%LAY%")).order_by(desc(Match.edge_val)).limit(10).all()

    # 3. Top 10 Edges (Independente do tipo de entrada, ordenado por edge desc)
    top_edges = base_query.order_by(desc(Match.edge_val)).limit(10).all()

    # 4. Top 10 EV (Ordenado por EV desc)
    top_ev = base_query.order_by(desc(Match.ev_val)).limit(10).all()

    # 5. Top 10 Confiança (Ordenado por score de confiança desc)
    top_confidence = base_query.order_by(desc(Match.confidence_score)).limit(10).all()

    return {
        "top_backs": top_backs,
        "top_lays": top_lays,
        "top_confidence": top_confidence
    }


@router.get("/performance", response_model=PerformanceHistoryResponse)
def get_performance_history(db: Session = Depends(get_db)):
    """
    Retorna as métricas de performance histórica do modelo (backtest) e dados do gráfico de crescimento de banca.
    """
    finished_matches = db.query(Match).filter(Match.status == "finished").order_by(Match.date.asc()).all()
    
    from app.services.value_scanner import scan_match_value
    
    entradas = []
    
    for m in finished_matches:
        rec, edge, ev, conf, _ = scan_match_value(m, db)
        if rec == "SEM ENTRADA":
            continue
            
        home_win = m.home_score > m.away_score if m.home_score is not None and m.away_score is not None else False
        draw = m.home_score == m.away_score if m.home_score is not None and m.away_score is not None else False
        away_win = m.home_score < m.away_score if m.home_score is not None and m.away_score is not None else False
        
        won = False
        profit = -1.0 # Perda de 1 unidade por padrão
        
        if rec == "BACK MANDANTE":
            won = home_win
            if won:
                profit = (m.odd_home - 1.0) if m.odd_home else 0.0
        elif rec == "BACK EMPATE":
            won = draw
            if won:
                profit = (m.odd_draw - 1.0) if m.odd_draw else 0.0
        elif rec == "BACK VISITANTE":
            won = away_win
            if won:
                profit = (m.odd_away - 1.0) if m.odd_away else 0.0
        elif rec == "LAY MANDANTE":
            won = not home_win
            odd = m.odd_home if m.odd_home else 2.0
            if won:
                profit = 0.95 # 1.0 - 5% comissão Betfair
            else:
                profit = -(odd - 1.0)
        elif rec == "LAY VISITANTE":
            won = not away_win
            odd = m.odd_away if m.odd_away else 2.0
            if won:
                profit = 0.95
            else:
                profit = -(odd - 1.0)
                
        entradas.append({
            "date": m.date,
            "profit": profit,
            "won": won
        })
        
    from datetime import datetime, timedelta
    now = datetime.now()
    
    def calc_period_metrics(days_limit: int) -> PerformancePeriod:
        limit_date = now - timedelta(days=days_limit)
        period_entries = [e for e in entradas if e["date"] >= limit_date]
        
        total = len(period_entries)
        vits = sum(1 for e in period_entries if e["won"])
        ders = total - vits
        
        taxa = (vits / total * 100.0) if total > 0 else 0.0
        lucro_unidades = sum(e["profit"] for e in period_entries)
        roi = (lucro_unidades / total * 100.0) if total > 0 else 0.0
        lucro_percentual = lucro_unidades * 1.0 # Simulação de 1% de banca por unidade
        
        return PerformancePeriod(
            entradas=total,
            vitorias=vits,
            derrotas=ders,
            taxa_acerto=round(taxa, 1),
            roi=round(roi, 1),
            lucro_unidades=round(lucro_unidades, 1),
            lucro_percentual=round(lucro_percentual, 1)
        )
        
    p_7d = calc_period_metrics(7)
    p_30d = calc_period_metrics(30)
    p_90d = calc_period_metrics(90)
    
    # Gerar série temporal de lucro acumulado para o gráfico
    chart_data = []
    cum_profit = 0.0
    
    # Ordenar cronologicamente
    entradas_sorted = sorted(entradas, key=lambda x: x["date"])
    
    for e in entradas_sorted:
        cum_profit += e["profit"]
        date_str = e["date"].strftime("%d/%m")
        chart_data.append(PerformanceDataPoint(
            date=date_str,
            lucro_acumulado=round(cum_profit, 2)
        ))
        
    if not chart_data:
        chart_data.append(PerformanceDataPoint(date="01/01", lucro_acumulado=0.0))
        
    return PerformanceHistoryResponse(
        period_7d=p_7d,
        period_30d=p_30d,
        period_90d=p_90d,
        chart_data=chart_data
    )


@router.get("/rankings-advanced", response_model=RankingsAdvancedResponse)
def get_rankings_advanced(
    timeframe: str = Query("today", description="Filtro de tempo: today, 24h, 48h"),
    league: str = Query("all", description="Filtro de liga: all ou nome específico"),
    country: str = Query("all", description="Filtro de país: all ou nome específico"),
    db: Session = Depends(get_db)
):
    """
    Gera rankings profissionais dinâmicos baseados em filtros geográficos e de tempo.
    """
    from datetime import datetime, timedelta
    
    query = db.query(Match).filter(Match.status == "scheduled")
    
    now = datetime.now()
    if timeframe == "today":
        start_of_day = datetime(now.year, now.month, now.day)
        end_of_day = start_of_day + timedelta(days=1)
        query = query.filter(and_(Match.date >= start_of_day, Match.date < end_of_day))
    elif timeframe == "24h":
        end_date = now + timedelta(hours=24)
        query = query.filter(and_(Match.date >= now, Match.date <= end_date))
    elif timeframe == "48h":
        end_date = now + timedelta(hours=48)
        query = query.filter(and_(Match.date >= now, Match.date <= end_date))
        
    if league != "all":
        query = query.filter(Match.league == league)
    if country != "all":
        query = query.filter(Match.country == country)
        
    matches = query.all()
    
    # 1. Top 10 Backs (Filtra BACK e ordena por edge desc)
    backs = [m for m in matches if m.recommendation and "BACK" in m.recommendation]
    top_backs = sorted(backs, key=lambda x: x.edge_val, reverse=True)[:10]
    
    # 2. Top 10 Lays (Filtra LAY e ordena por edge desc)
    lays = [m for m in matches if m.recommendation and "LAY" in m.recommendation]
    top_lays = sorted(lays, key=lambda x: x.edge_val, reverse=True)[:10]
    
    # 3. Top 10 Edges (Ordena por edge desc)
    top_edges = sorted(matches, key=lambda x: x.edge_val, reverse=True)[:10]
    
    # 4. Top 10 EV (Ordena por ev desc)
    top_ev = sorted(matches, key=lambda x: x.ev_val, reverse=True)[:10]
    
    # 5. Top 10 Confiança (Ordena por confiança desc)
    top_confidence = sorted(matches, key=lambda x: x.confidence_score, reverse=True)[:10]
    
    # 6. Top 10 Distorções de Mercado
    def calc_distortion(m: Match):
        try:
            oh = m.odd_home if m.odd_home else 3.0
            od = m.odd_draw if m.odd_draw else 3.0
            oa = m.odd_away if m.odd_away else 3.0
            ph = m.prob_home if m.prob_home else 0.33
            pd = m.prob_draw if m.prob_draw else 0.33
            pa = m.prob_away if m.prob_away else 0.33
            return abs(ph - (1.0/oh)) + abs(pd - (1.0/od)) + abs(pa - (1.0/oa))
        except ZeroDivisionError:
            return 0.0
            
    top_distortions = sorted(matches, key=calc_distortion, reverse=True)[:10]
    
    # 7. Top 10 Odds Infladas (Odds de mercado maiores que a justa - maior edge positivo no back)
    inflated = [m for m in matches if m.edge_val > 0.0]
    top_inflated_odds = sorted(inflated, key=lambda x: x.edge_val, reverse=True)[:10]
    
    # 8. Top 10 Odds Subavaliadas (Odds de mercado muito menores do que deveriam - pior edge negativo)
    underpriced = [m for m in matches if m.edge_val < 0.0]
    top_underpriced_odds = sorted(underpriced, key=lambda x: x.edge_val)[:10]
    
    return RankingsAdvancedResponse(
        top_backs=top_backs,
        top_lays=top_lays,
        top_edges=top_edges,
        top_ev=top_ev,
        top_confidence=top_confidence,
        top_distortions=top_distortions,
        top_inflated_odds=top_inflated_odds,
        top_underpriced_odds=top_underpriced_odds
    )


@router.get("/debug")
def get_debug_info(db: Session = Depends(get_db)):
    try:
        team_count = db.query(Team).count()
        match_count = db.query(Match).count()
        scheduled_count = db.query(Match).filter(Match.status == "scheduled").count()
        finished_count = db.query(Match).filter(Match.status == "finished").count()
        
        return {
            "status": "connected",
            "team_count": team_count,
            "match_count": match_count,
            "scheduled_count": scheduled_count,
            "finished_count": finished_count,
        }
    except Exception as e:
        return {
            "status": "error",
            "error_detail": str(e)
        }


@router.get("/{match_id}", response_model=MatchDetailResponse)
def get_match_by_id(match_id: int, db: Session = Depends(get_db)):
    """
    Retorna os detalhes de um jogo específico.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Jogo não encontrado.")
    return match


@router.get("/{match_id}/stats", response_model=MatchStatsAnalysis)
def get_match_stats(match_id: int, db: Session = Depends(get_db)):
    """
    Retorna a análise estatística detalhada (Forma, gols marcados/sofridos e H2H) de uma partida.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Jogo não encontrado.")
    
    return compile_match_analysis(match, db)


@router.get("/{match_id}/poisson-matrix")
def get_poisson_matrix(match_id: int, db: Session = Depends(get_db)):
    """
    Retorna a matriz de probabilidade de placares (ex: 1x0, 2x1) calculada pelo modelo de Poisson.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Jogo não encontrado.")
        
    _, _, _, _, _, score_matrix = calculate_match_probabilities(
        match.home_team_id, match.away_team_id, match.league, db
    )
    
    return score_matrix


@router.get("/{match_id}/advanced", response_model=AdvancedMatchAnalysis)
def get_match_advanced_analysis(match_id: int, db: Session = Depends(get_db)):
    """
    Retorna a análise estatística avançada contendo mercados Over/Under, Ambos Marcam e Lay Empate.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Jogo não encontrado.")
    from app.services.value_scanner import compile_advanced_analysis
    return compile_advanced_analysis(match, db)

