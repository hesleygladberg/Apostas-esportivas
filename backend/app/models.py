from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    league = Column(String, index=True, nullable=False)
    country = Column(String, index=True, nullable=False)

    # Relacionamentos
    matches_home = relationship("Match", back_populates="home_team", foreign_keys="Match.home_team_id")
    matches_away = relationship("Match", back_populates="away_team", foreign_keys="Match.away_team_id")


class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, index=True, nullable=False)
    status = Column(String, index=True, default="scheduled")  # "scheduled", "finished"
    league = Column(String, index=True, nullable=False)
    country = Column(String, index=True, nullable=False)
    
    # Chaves estrangeiras
    home_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    away_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)

    # Placares (nulo se não jogou ainda)
    home_score = Column(Integer, nullable=True)
    away_score = Column(Integer, nullable=True)

    # Odds de Mercado (1X2)
    odd_home = Column(Float, nullable=True)
    odd_draw = Column(Float, nullable=True)
    odd_away = Column(Float, nullable=True)
    odd_volume = Column(Float, default=0.0)  # Liquidez

    # Probabilidades do Modelo (Soma = 100%)
    prob_home = Column(Float, nullable=True)
    prob_draw = Column(Float, nullable=True)
    prob_away = Column(Float, nullable=True)

    # Odds Justas Calculadas pelo Modelo (1 / Probabilidade)
    fair_home = Column(Float, nullable=True)
    fair_draw = Column(Float, nullable=True)
    fair_away = Column(Float, nullable=True)

    # Métricas de Valor (Maximizadas nas melhores opções)
    edge_val = Column(Float, default=0.0)  # Exemplo: +0.08 (8%)
    ev_val = Column(Float, default=0.0)    # Exemplo: +0.12 (12%)
    confidence_score = Column(Integer, default=0) # 0 a 100
    
    # Recomendação e Explicação
    recommendation = Column(String, default="SEM VALOR") # "BACK HOME", "LAY AWAY", etc.
    explanation = Column(Text, nullable=True)

    # Relacionamentos para facilitar buscas de nomes
    home_team = relationship("Team", back_populates="matches_home", foreign_keys=[home_team_id])
    away_team = relationship("Team", back_populates="matches_away", foreign_keys=[away_team_id])
