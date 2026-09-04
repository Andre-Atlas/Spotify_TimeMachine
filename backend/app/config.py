from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: Optional[str] = ""
    DATABASE_URL_SYNC: Optional[str] = ""
    LASTFM_API_KEY: Optional[str] = ""
    LASTFM_SHARED_SECRET: Optional[str] = ""
    SPOTIFY_CLIENT_ID: str = ""
    SPOTIFY_CLIENT_SECRET: str = ""
    SPOTIFY_REDIRECT_URI: str = ""
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    FRONTEND_ORIGIN: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8')

    @property
    def spotify_redirect_uri(self) -> str:
        """URL de callback do OAuth Spotify — antes era uma constante fixa
        em 127.0.0.1 dentro de routers/auth.py, o que quebra em qualquer
        deploy (o Spotify exige o redirect_uri exato cadastrado no app, e
        127.0.0.1 só é aceito sem HTTPS em loopback local). Fallback
        preserva o comportamento de dev local sem exigir configuração."""
        return self.SPOTIFY_REDIRECT_URI or "http://127.0.0.1:8000/v1/auth/spotify/callback"

    @property
    def cors_origins(self) -> list[str]:
        """FRONTEND_ORIGIN aceita uma ou várias origens separadas por
        vírgula (ex: produção + preview da Vercel + dev local ao mesmo
        tempo). Antes o CORSMiddleware usava allow_origins=['*'], que
        aceita chamada de qualquer site.

        Auto-completa "https://" quando falta o esquema — engano fácil de
        cometer copiando só o domínio (ex: "meusite.vercel.app" em vez de
        "https://meusite.vercel.app"), e sem isso o CORSMiddleware nunca
        bate contra o header Origin real do navegador, que sempre inclui
        o esquema. Falha nesse caso é silenciosa (o navegador bloqueia sem
        avisar o backend), então vale mais corrigir do que exigir precisão."""
        raw = [o.strip() for o in self.FRONTEND_ORIGIN.split(',') if o.strip()]
        origins = [o if '://' in o else f'https://{o}' for o in raw]
        return origins or ["http://localhost:5173"]

    @property
    def has_spotify(self) -> bool:
        """Credenciais de app do Spotify presentes (client credentials flow)."""
        return bool(self.SPOTIFY_CLIENT_ID and self.SPOTIFY_CLIENT_SECRET)

    @property
    def has_groq(self) -> bool:
        """Chave da Groq presente — usada só para estimar features acústicas
        das faixas do Spotify (energy/valence/danceability/acousticness).
        Opcional: sem ela, app/services/groq_features.py degrada para
        DEFAULT_FEATURES por faixa (sem crash, sem 500)."""
        return bool(self.GROQ_API_KEY)

    @property
    def use_mock(self) -> bool:
        """True quando falta credencial do Spotify — único requisito para o
        catálogo/gosto reais desde a Fase 4 (MLCurator não depende de
        nenhuma chave; Groq virou só um enriquecimento opcional)."""
        return not self.has_spotify

    # DATABASE_URL / DATABASE_URL_SYNC seguem declaradas para não quebrar
    # quem já tem essas linhas no .env, mas nenhum código atual as usa —
    # não existe camada de persistência em banco neste build (ver Fase 4
    # do plano de execução: motor de ML roda sobre cache em memória/disco,
    # não sobre Postgres/pgvector).

settings = Settings()
