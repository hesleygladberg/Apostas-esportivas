import pytest
import math
from app.services.poisson_model import get_poisson_probability, calculate_match_probabilities
from app.services.value_scanner import scan_match_value
from app.models import Match, Team
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base

# Setup de banco de dados temporário na memória para testes
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_poisson_pmf_math():
    """
    Testa se a função de Poisson bate com valores teóricos conhecidos.
    Para lambda = 2.0 e k = 1: P(1; 2) = 2^1 * e^-2 / 1! = 2 * 0.135335 = 0.27067
    """
    prob = get_poisson_probability(1, 2.0)
    assert pytest.approx(prob, 0.001) == 0.27067

    # Para lambda = 1.5 e k = 0: P(0; 1.5) = e^-1.5 = 0.22313
    prob_zero = get_poisson_probability(0, 1.5)
    assert pytest.approx(prob_zero, 0.001) == 0.22313

def test_poisson_engine_probability_sum(db_session):
    """
    Testa se as probabilidades do modelo Poisson de 1X2 somam exatamente 100%.
    """
    # 1. Adicionar times de teste
    t1 = Team(name="Time A", league="Teste", country="Brasil")
    t2 = Team(name="Time B", league="Teste", country="Brasil")
    db_session.add(t1)
    db_session.add(t2)
    db_session.commit()

    # 2. Rodar cálculo
    ph, pd, pa, xg_h, xg_a, _ = calculate_match_probabilities(t1.id, t2.id, "Teste", db_session)
    
    # A soma das probabilidades deve ser exatamente 1.0 (100%)
    assert pytest.approx(ph + pd + pa, 0.0001) == 1.0
    assert xg_h > 0
    assert xg_a > 0

def test_value_scanner_math(db_session):
    """
    Valida as fórmulas de Edge e EV do value_scanner.py.
    Edge = Probabilidade * Odd - 1
    """
    t1 = Team(name="Time A", league="Teste", country="Brasil")
    t2 = Team(name="Time B", league="Teste", country="Brasil")
    db_session.add_all([t1, t2])
    db_session.commit()

    # Criar um jogo fictício com odds de mercado
    m = Match(
        date=pytest.datetime if hasattr(pytest, 'datetime') else None, # Não importa
        status="scheduled",
        league="Teste",
        country="Brasil",
        home_team_id=t1.id,
        away_team_id=t2.id,
        odd_home=2.00,  # Mercado oferecendo odd 2.00
        odd_draw=3.00,
        odd_away=4.00,
        prob_home=0.60, # Nosso modelo calcula 60% de chances de vitória
        prob_draw=0.20,
        prob_away=0.20,
        fair_home=1.67, # 1 / 0.60
        fair_draw=5.00,
        fair_away=5.00
    )
    
    rec, edge, ev, conf, justification = scan_match_value(m, db_session)
    
    # Para o Mandante: Edge = 0.60 * 2.00 - 1 = 0.20 (+20%)
    # Como 20% é o maior edge e é positivo, a recomendação deve ser BACK HOME
    assert rec == "BACK HOME"
    assert pytest.approx(edge, 0.01) == 0.20
    assert pytest.approx(ev, 0.01) == 0.20
    assert conf > 0
    assert "Edge de 20.0%" in justification
