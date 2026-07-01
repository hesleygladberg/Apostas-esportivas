import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Carrega o arquivo .env robustamente independente de onde o processo foi iniciado
if os.path.exists(".env"):
    load_dotenv(".env")
elif os.path.exists("backend/.env"):
    load_dotenv("backend/.env")
elif os.path.exists("../.env"):
    load_dotenv("../.env")
else:
    load_dotenv()

class Settings(BaseSettings):
    PORT: int = int(os.getenv("PORT", 8000))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./trade_scanner.db")
    MOCK_MODE: bool = os.getenv("MOCK_MODE", "true").lower() == "true"
    
    THE_ODDS_API_KEY: str = os.getenv("THE_ODDS_API_KEY", "")
    FOOTBALL_DATA_API_KEY: str = os.getenv("FOOTBALL_DATA_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
