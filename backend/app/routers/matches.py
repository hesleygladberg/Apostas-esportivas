from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
from app.database import get_db
from app.models import Match, Team
from app.schemas import MatchDetailResponse, MatchSimpleResponse, MatchStatsAnalysis
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


@router.get("/rankings")
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
        "top_edges": top_edges,
        "top_ev": top_ev,
        "top_confidence": top_confidence
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
