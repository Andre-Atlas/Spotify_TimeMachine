"""Injeção de dependências — conecta providers ao ciclo de vida da app."""
from app.providers.base import TasteSource, TrackCatalog, CuratorProvider

# Singletons registrados no lifespan da app
_taste_source: TasteSource | None = None
_catalog: TrackCatalog | None = None
_curator: CuratorProvider | None = None

def register_providers(
    taste: TasteSource,
    catalog: TrackCatalog,
    curator: CuratorProvider,
) -> None:
    global _taste_source, _catalog, _curator
    _taste_source = taste
    _catalog = catalog
    _curator = curator

def get_taste_source() -> TasteSource:
    assert _taste_source is not None, 'TasteSource não registrado'
    return _taste_source

def get_catalog() -> TrackCatalog:
    assert _catalog is not None, 'TrackCatalog não registrado'
    return _catalog

def get_curator() -> CuratorProvider:
    assert _curator is not None, 'CuratorProvider não registrado'
    return _curator
