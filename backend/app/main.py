"""The Time Machine — API principal."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings
from app.deps import register_providers

settings = Settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Registra providers no startup.

    Desde a Fase 4, o curador é sempre o MLCurator (determinístico, sem
    credenciais) — deixou de ser condicionado a settings.has_groq. Catálogo
    e gosto reais dependem só do Spotify: o Groq virou um enriquecimento
    opcional de features (estimate_features já degrada sozinho para
    DEFAULT_FEATURES quando a chave falta ou expira), não um requisito duro.
    Isso também é por que settings.use_mock hoje só olha has_spotify.
    """
    from app.providers.mock import MockTasteSource, MockTrackCatalog
    from app.providers.ml_curator import MLCurator

    taste: object
    catalog: object

    if settings.has_spotify:
        from app.providers.spotify_catalog import SpotifyTrackCatalog
        from app.providers.spotify_taste import SpotifyTasteSource

        catalog = SpotifyTrackCatalog(
            spotify_client_id=settings.SPOTIFY_CLIENT_ID,
            spotify_client_secret=settings.SPOTIFY_CLIENT_SECRET,
            groq_api_key=settings.GROQ_API_KEY,
        )
        taste = SpotifyTasteSource(groq_api_key=settings.GROQ_API_KEY)
    else:
        catalog = MockTrackCatalog()
        taste = MockTasteSource()

    curator = MLCurator()

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
    allow_origins=settings.cors_origins,
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
    return {
        'status': 'ok',
        'mock': settings.use_mock,
        'has_spotify': settings.has_spotify,
        'has_groq': settings.has_groq,
    }
