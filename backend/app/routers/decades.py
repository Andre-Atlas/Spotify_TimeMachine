"""Rotas de décadas e faixas."""
from fastapi import APIRouter, Depends, HTTPException, Query, Header

from app.schemas.decade import DecadeOut
from app.schemas.track import TrackOut
from app.models.decade import DECADES, DECADE_MAP, DECADE_IDS
from app.deps import get_catalog, get_taste_source
from app.services.affinity import compute_affinity
from app.providers.base import TrackCatalog, TasteSource

router = APIRouter(prefix='/decades', tags=['decades'])

@router.get('', response_model=list[DecadeOut])
async def list_decades():
    """Lista as 7 décadas com metadados completos."""
    return [DecadeOut(**d) for d in DECADES]

@router.get('/{decade_id}/tracks', response_model=list[TrackOut])
async def decade_tracks(
    decade_id: str,
    taste: int = Query(0, description='1 = ordenar por afinidade'),
    authorization: str | None = Header(None),
    catalog: TrackCatalog = Depends(get_catalog),
    taste_source: TasteSource = Depends(get_taste_source),
):
    """Faixas de uma década, opcionalmente ordenadas por afinidade."""
    if decade_id not in DECADE_IDS:
        raise HTTPException(404, f'Década "{decade_id}" não encontrada')
    
    user_token = authorization.split(" ")[1] if authorization and authorization.startswith("Bearer ") else None

    # O catálogo real depende de rede, de token de app válido e da resposta do
    # Spotify. Qualquer uma dessas coisas pode falhar em produção, e antes
    # disso a exceção subia como 500 — o frontend só via a lista sumir. Agora
    # a falha degrada para o catálogo local, com o motivo no log.
    raw_tracks = []
    try:
        raw_tracks = await catalog.tracks_for_decade(decade_id, user_token)
    except Exception as e:
        print(f"Catálogo real falhou para {decade_id}: {type(e).__name__}: {e}", flush=True)

    if not raw_tracks:
        from app.providers.mock import MockTrackCatalog
        print(f"Usando catálogo local para {decade_id} (o real não retornou faixas)", flush=True)
        raw_tracks = await MockTrackCatalog().tracks_for_decade(decade_id, user_token)

    try:
        user_taste = await taste_source.get_taste(user_token)
    except Exception as e:
        print(f"Perfil de gosto falhou, usando o padrão: {e}", flush=True)
        from app.providers.mock import MockTasteSource
        user_taste = await MockTasteSource().get_taste()
    
    # Calcular afinidade para cada faixa
    tracks = []
    for t in raw_tracks:
        aff = compute_affinity(t['features'], user_taste)
        track = {**t, 'affinity': aff}
        tracks.append(TrackOut(**track))
    
    if taste == 1:
        tracks.sort(key=lambda x: x.affinity, reverse=True)
    
    return tracks
