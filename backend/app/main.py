from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.database import engine, Base, get_db
from app.routers import matches, assistant
from app.services.data_fetcher import sync_matches_and_run_model
from app.config import settings

# Criar tabelas do banco de dados se não existirem
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Trade Scanner AI API",
    description="Motor de cálculo de probabilidade e scanner de valor de odds esportivas",
    version="1.0.0"
)

# Configurar CORS para permitir que o frontend da Vercel (ou local) acesse a API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, substitua pelo link da Vercel do seu frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar Roteadores
app.include_router(matches.router, prefix="/api")
app.include_router(assistant.router, prefix="/api")

@app.on_event("startup")
def startup_populate():
    """
    Executa a sincronização inicial de dados de futebol e calcula probabilidades no início.
    Garante que o banco nunca comece vazio.
    """
    db = next(get_db())
    try:
        # Só executa se não houver registros futuros para não retardar o boot do container toda vez
        # No modo Render grátis, é bom ter dados prontos
        sync_matches_and_run_model(db)
    except Exception as e:
        print(f"Erro ao inicializar e sincronizar dados: {e}")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Trade Scanner AI Backend",
        "mock_mode": settings.MOCK_MODE,
        "docs_url": "/docs"
    }
