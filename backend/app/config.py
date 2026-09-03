from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: Optional[str] = ""
    DATABASE_URL_SYNC: Optional[str] = ""
    LASTFM_API_KEY: Optional[str] = ""
    LASTFM_SHARED_SECRET: Optional[str] = ""
    SPOTIFY_CLIENT_ID: str = ""
    SPOTIFY_CLIENT_SECRET: str = ""
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    FRONTEND_ORIGIN: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8')

    @property
    def use_mock(self) -> bool:
        """Verifica se chaves críticas estão ausentes para ativar mock."""
        return not self.GEMINI_API_KEY or not self.DATABASE_URL

    @property
    def database_url(self) -> str:
        """Retorna a URL do banco de dados (async)."""
        return self.DATABASE_URL or ""

settings = Settings()
