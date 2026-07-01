import requests
import random
from datetime import datetime, timedelta
from typing import Tuple, Dict, List
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.config import settings
from app.models import Team, Match
from app.services.poisson_model import calculate_match_probabilities, get_poisson_probability
from app.services.value_scanner import scan_match_value

# Dicionário de Times e Ligas para o Modo Mock
MOCK_LEAGUES = {
    "Premier League": {
        "country": "Inglaterra",
        "teams": [
            {"name": "Manchester City", "attack": 2.3, "defense": 0.9},
            {"name": "Arsenal", "attack": 2.1, "defense": 0.8},
            {"name": "Liverpool", "attack": 2.2, "defense": 1.0},
            {"name": "Chelsea", "attack": 1.7, "defense": 1.2},
            {"name": "Manchester United", "attack": 1.5, "defense": 1.3},
            {"name": "Tottenham", "attack": 1.8, "defense": 1.4},
            {"name": "Newcastle", "attack": 1.7, "defense": 1.3},
            {"name": "Aston Villa", "attack": 1.6, "defense": 1.2}
        ]
    },
    "Brasileirão": {
        "country": "Brasil",
        "teams": [
            {"name": "Flamengo", "attack": 1.9, "defense": 0.8},
            {"name": "Palmeiras", "attack": 1.8, "defense": 0.7},
            {"name": "São Paulo", "attack": 1.4, "defense": 1.0},
            {"name": "Corinthians", "attack": 1.2, "defense": 1.2},
            {"name": "Atlético-MG", "attack": 1.5, "defense": 1.1},
            {"name": "Botafogo", "attack": 1.7, "defense": 1.0},
            {"name": "Grêmio", "attack": 1.4, "defense": 1.3},
            {"name": "Fluminense", "attack": 1.3, "defense": 1.2}
        ]
    },
    "La Liga": {
        "country": "Espanha",
        "teams": [
            {"name": "Real Madrid", "attack": 2.4, "defense": 0.8},
            {"name": "Barcelona", "attack": 2.0, "defense": 1.0},
            {"name": "Atlético de Madrid", "attack": 1.6, "defense": 0.9},
            {"name": "Real Sociedad", "attack": 1.3, "defense": 1.0},
            {"name": "Villarreal", "attack": 1.5, "defense": 1.4},
            {"name": "Sevilla", "attack": 1.2, "defense": 1.3}
        ]
    }
}

def generate_mock_score(att_home: float, def_away: float, att_away: float, def_home: float) -> Tuple[int, int]:
    """
    Simula um placar real baseado no poder de ataque/defesa usando sorteio de Poisson.
    """
    # Gols esperados médios aproximados
    xG_home = att_home * def_away * 1.35
    xG_away = att_away * def_home * 1.05
    
    # Sorteio usando distribuição de Poisson simplificada
    home_score = 0
    p = random.random()
    cum_p = 0.0
    for k in range(10):
        cum_p += (math.pow(xG_home, k) * math.exp(-xG_home)) / math.factorial(k) if xG_home > 0 else 0.0
        if p <= cum_p:
            home_score = k
            break
            
    away_score = 0
    p = random.random()
    cum_p = 0.0
    for k in range(10):
        cum_p += (math.pow(xG_away, k) * math.exp(-xG_away)) / math.factorial(k) if xG_away > 0 else 0.0
        if p <= cum_p:
            away_score = k
            break
            
    return home_score, away_score

import math

def populate_teams_and_history(db: Session):
    """
    Sub-função auxiliar para criar os times e o histórico de partidas finalizadas.
    """
    db.query(Match).delete()
    db.query(Team).delete()
    db.commit()
    
    team_objects = {}
    
    # 1. Criar Times
    for league_name, league_data in MOCK_LEAGUES.items():
        country = league_data["country"]
        for team_info in league_data["teams"]:
            team = Team(name=team_info["name"], league=league_name, country=country)
            db.add(team)
            db.flush()
            team_objects[team.name] = {
                "id": team.id,
                "att": team_info["attack"],
                "def": team_info["defense"],
                "league": league_name,
                "country": country
            }
    db.commit()

    # 2. Criar Partidas Históricas (Últimos 40 dias)
    start_date = datetime.now() - timedelta(days=40)
    for league_name, league_data in MOCK_LEAGUES.items():
        teams_list = [team_objects[t["name"]] for t in league_data["teams"]]
        
        for day_offset in range(40):
            match_date = start_date + timedelta(days=day_offset, hours=random.randint(12, 20))
            sampled = random.sample(teams_list, 2)
            home_t = sampled[0]
            away_t = sampled[1]
            
            home_score, away_score = generate_mock_score(
                home_t["att"], away_t["def"], away_t["att"], home_t["def"]
            )
            
            historical_match = Match(
                date=match_date,
                status="finished",
                league=league_name,
                country=home_t["country"],
                home_team_id=home_t["id"],
                away_team_id=away_t["id"],
                home_score=home_score,
                away_score=away_score,
                odd_volume=random.randint(5000, 30000)
            )
            db.add(historical_match)
    db.commit()


def populate_mock_data(db: Session):
    """
    Popula o banco de dados com times, jogos históricos (finalizados) e jogos futuros (do dia).
    """
    # 1. Verificar se já existem times no banco de dados
    if db.query(Team).count() == 0:
        print("Banco de dados vazio. Realizando carga inicial de times e jogos históricos...")
        populate_teams_and_history(db)
    else:
        # Deletar apenas as partidas agendadas antigas para recriar as de hoje
        db.query(Match).filter(Match.status == "scheduled").delete()
        db.commit()

    # 2. Criar Partidas Futuras (Hoje e Próximas 24 Horas)
    today = datetime.now()
    
    # Carregar os times do banco em um dicionário para consulta rápida
    teams = db.query(Team).all()
    if not teams:
        return
        
    # Organizar por liga
    teams_by_league = {}
    for t in teams:
        if t.league not in teams_by_league:
            teams_by_league[t.league] = []
        teams_by_league[t.league].append(t)
        
    for league_name, league_teams in teams_by_league.items():
        # Obter ataque/defesa do dicionário MOCK_LEAGUES ou usar valores padrão
        mock_league_data = MOCK_LEAGUES.get(league_name, {})
        mock_teams_data = {t["name"]: t for t in mock_league_data.get("teams", [])}
        
        # Gerar 4 jogos para cada liga nas próximas 24h
        for i in range(4):
            match_date = today + timedelta(hours=random.randint(2, 23))
            sampled = random.sample(league_teams, 2)
            home_t = sampled[0]
            away_t = sampled[1]
            
            # Buscar ratings de ataque/defesa mock ou default
            h_data = mock_teams_data.get(home_t.name, {"attack": 1.5, "defense": 1.1})
            a_data = mock_teams_data.get(away_t.name, {"attack": 1.5, "defense": 1.1})
            
            # Calcular a probabilidade real (verdadeira) do mock
            xG_h = h_data["attack"] * a_data["defense"] * 1.35
            xG_a = a_data["attack"] * h_data["defense"] * 1.05
            
            prob_h_raw = 0.0
            prob_d_raw = 0.0
            prob_a_raw = 0.0
            for h_g in range(8):
                for a_g in range(8):
                    p_h = get_poisson_probability(h_g, xG_h)
                    p_a = get_poisson_probability(a_g, xG_a)
                    cell = p_h * p_a
                    if h_g > a_g: prob_h_raw += cell
                    elif h_g == a_g: prob_d_raw += cell
                    else: prob_a_raw += cell
                    
            sum_prob = prob_h_raw + prob_d_raw + prob_a_raw if prob_h_raw + prob_d_raw + prob_a_raw > 0 else 1.0
            ph = prob_h_raw / sum_prob
            pd = prob_d_raw / sum_prob
            pa = prob_a_raw / sum_prob
            
            fair_h = 1.0 / ph if ph > 0 else 9.0
            fair_d = 1.0 / pd if pd > 0 else 9.0
            fair_a = 1.0 / pa if pa > 0 else 9.0
            
            # Odds do Mercado: Odds justas + distorção aleatória
            dist_h = random.choice([0.90, 0.95, 1.0, 1.05, 1.15])
            dist_d = random.choice([0.92, 0.96, 1.0, 1.04])
            dist_a = random.choice([0.88, 0.94, 1.0, 1.07, 1.14])
            
            odd_h = max(1.05, round(fair_h * dist_h, 2))
            odd_d = max(1.05, round(fair_d * dist_d, 2))
            odd_a = max(1.05, round(fair_a * dist_a, 2))
            
            future_match = Match(
                date=match_date,
                status="scheduled",
                league=league_name,
                country=home_t.country,
                home_team_id=home_t.id,
                away_team_id=away_t.id,
                odd_home=odd_h,
                odd_draw=odd_d,
                odd_away=odd_a,
                odd_volume=random.randint(15000, 180000)
            )
            db.add(future_match)
            
    db.commit()
    print("Partidas mock agendadas para as próximas 24h geradas com sucesso!")


def sync_matches_and_run_model(db: Session):
    """
    Sincroniza os jogos (buscando da API ou criando Mock) e roda o motor matemático de Poisson
    para calcular probabilidades, odds justas e recomendações de valor.
    """
    if settings.MOCK_MODE:
        populate_mock_data(db)
    else:
        fetch_real_api_data(db)

    # Executar o motor de probabilidade e value scanner para todos os jogos agendados
    scheduled_matches = db.query(Match).filter(Match.status == "scheduled").all()
    
    for m in scheduled_matches:
        ph, pd, pa, xg_h, xg_a, _ = calculate_match_probabilities(
            m.home_team_id, m.away_team_id, m.league, db
        )
        
        m.prob_home = ph
        m.prob_draw = pd
        m.prob_away = pa
        
        m.fair_home = round(1.0 / ph, 2) if ph > 0 else 999.0
        m.fair_draw = round(1.0 / pd, 2) if pd > 0 else 999.0
        m.fair_away = round(1.0 / pa, 2) if pa > 0 else 999.0
        
        rec, edge, ev, conf, justification = scan_match_value(m, db)
        
        m.recommendation = rec
        m.edge_val = edge
        m.ev_val = ev
        m.confidence_score = conf
        m.explanation = justification
        
    db.commit()
    print(f"Modelo estatístico executado para {len(scheduled_matches)} partidas agendadas.")


def fetch_real_api_data(db: Session):
    """
    Carrega jogos reais das ligas principais suportadas pela API de futebol e atualiza odds.
    """
    if not settings.THE_ODDS_API_KEY or not settings.FOOTBALL_DATA_API_KEY:
        print("Aviso: Chaves de API não configuradas em .env. Rodando no modo de segurança.")
        return
        
    headers = {"X-Auth-Token": settings.FOOTBALL_DATA_API_KEY}
    
    # 1. Limpar agendados antigos no DB para evitar duplicações
    db.query(Match).filter(Match.status == "scheduled").delete()
    db.commit()

    # 2. Buscar partidas da Football-Data API para o dia de hoje
    # Ligas suportadas no plano gratuito da Football-Data.org
    supported_competitions = ["PL", "PD", "SA", "BL1", "FL1", "CL", "BSA", "DED", "PPL"]
    
    try:
        url = "https://api.football-data.org/v4/matches"
        response = requests.get(url, headers=headers, timeout=12)
        if response.status_code == 200:
            data = response.json()
            matches_list = data.get("matches", [])
            
            for m_data in matches_list:
                comp_code = m_data.get("competition", {}).get("code")
                if comp_code not in supported_competitions:
                    continue
                
                # Obter ou criar time da casa
                home_name = m_data["homeTeam"]["name"]
                away_name = m_data["awayTeam"]["name"]
                league_name = m_data["competition"]["name"]
                country = m_data.get("area", {}).get("name", "Europa")
                
                home_team = db.query(Team).filter(Team.name == home_name).first()
                if not home_team:
                    home_team = Team(name=home_name, league=league_name, country=country)
                    db.add(home_team)
                    db.flush()
                    
                away_team = db.query(Team).filter(Team.name == away_name).first()
                if not away_team:
                    away_team = Team(name=away_name, league=league_name, country=country)
                    db.add(away_team)
                    db.flush()
                
                # Parse da data utc
                date_str = m_data["utcDate"].replace("Z", "")
                match_date = datetime.fromisoformat(date_str)
                
                # Determinar status
                status_raw = m_data.get("status")
                status = "finished" if status_raw in ["FINISHED", "AWARDED"] else "scheduled"
                
                home_score = m_data.get("score", {}).get("fullTime", {}).get("home")
                away_score = m_data.get("score", {}).get("fullTime", {}).get("away")
                
                match_obj = Match(
                    date=match_date,
                    status=status,
                    league=league_name,
                    country=country,
                    home_team_id=home_team.id,
                    away_team_id=away_team.id,
                    home_score=home_score,
                    away_score=away_score,
                    odd_volume=random.randint(15000, 100000)
                )
                db.add(match_obj)
            db.commit()
            print("Jogos reais do dia carregados com sucesso da Football-Data API.")
    except Exception as e:
        print(f"Erro ao buscar partidas da Football-Data API: {e}")
        
    # 3. Carregar odds atualizadas da The Odds API e associar aos jogos
    try:
        odds_url = f"https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey={settings.THE_ODDS_API_KEY}&regions=eu&markets=h2h"
        odds_response = requests.get(odds_url, timeout=12)
        if odds_response.status_code == 200:
            odds_data = odds_response.json()
            
            for event in odds_data:
                home_name = event["home_team"]
                away_name = event["away_team"]
                
                db_home = db.query(Team).filter(Team.name.like(f"%{home_name}%")).first()
                db_away = db.query(Team).filter(Team.name.like(f"%{away_name}%")).first()
                
                if not db_home or not db_away:
                    continue
                
                match_obj = db.query(Match).filter(
                    Match.home_team_id == db_home.id,
                    Match.away_team_id == db_away.id,
                    Match.status == "scheduled"
                ).first()
                
                if not match_obj:
                    continue
                
                bookmaker = None
                for b in event.get("bookmakers", []):
                    if b["key"] == "bet365":
                        bookmaker = b
                        break
                if not bookmaker and event.get("bookmakers", []):
                    bookmaker = event["bookmakers"][0]
                    
                if bookmaker:
                    market = [m for m in bookmaker.get("markets", []) if m["key"] == "h2h"]
                    if market:
                        outcomes = market[0].get("outcomes", [])
                        for o in outcomes:
                            price = o.get("price")
                            if o["name"] == event["home_team"]:
                                match_obj.odd_home = price
                            elif o["name"] == event["away_team"]:
                                match_obj.odd_away = price
                            elif o["name"] in ["Draw", "Empate"]:
                                match_obj.odd_draw = price
            db.commit()
            print("Odds reais associadas com sucesso a partir da The Odds API.")
    except Exception as e:
        print(f"Erro ao buscar odds da The Odds API: {e}")
