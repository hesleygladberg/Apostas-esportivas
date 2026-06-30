from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# Ajustar string de conexão do SQLite se necessário
db_url = settings.DATABASE_URL
if db_url.startswith("sqlite"):
    # SQLite exige check_same_thread=False para FastAPI rodar de forma assíncrona
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
else:
    # Para Postgres, o pool_pre_ping ajuda a prevenir quedas de conexão
    engine = create_engine(db_url, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
