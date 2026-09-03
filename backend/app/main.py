"""The Time Machine — API principal."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings
from app.deps import register_providers

settings = Settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Registra providers no startup."""
    # Fase 1: sempre carrega mocks como fallback
    from app.providers.mock import MockTasteSource, MockTrackCatalog, MockCurator
    
    taste = MockTasteSource()
    catalog: object
    curator: object

    if settings.SPOTIFY_CLIENT_ID and settings.SPOTIFY_CLIENT_SECRET and settings.GROQ_API_KEY:
        from app.providers.spotify_catalog import SpotifyTrackCatalog
        catalog = SpotifyTrackCatalog(
            spotify_client_id=settings.SPOTIFY_CLIENT_ID,
            spotify_client_secret=settings.SPOTIFY_CLIENT_SECRET,
            groq_api_key=settings.GROQ_API_KEY
        )
    else:
        catalog = MockTrackCatalog()
    
    # Se tiver chave Groq, usar curador real
    if settings.GROQ_API_KEY:
        try:
            from app.providers.curator_llm import GroqCurator
            curator = GroqCurator(api_key=settings.GROQ_API_KEY)
        except Exception:
            curator = MockCurator()
    else:
        curator = MockCurator()
    
    register_providers(taste=taste, catalog=catalog, curator=curator)
    yield

app = FastAPI(
    title='The Time Machine API',
    version='0.1.0',
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

# Routers
from app.routers import decades, taste, curator, auth, playlists, tracks
app.include_router(decades.router, prefix='/v1')
app.include_router(taste.router, prefix='/v1')
app.include_router(curator.router, prefix='/v1')
app.include_router(auth.router, prefix='/v1')
app.include_router(playlists.router, prefix='/v1')
app.include_router(tracks.router, prefix='/v1')

@app.get('/healthz')
async def healthz():
    return {'status': 'ok', 'mock': settings.use_mock}
