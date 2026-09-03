"""Endpoint SSE do curador musical."""
import json
from fastapi import APIRouter, Depends, Header
from sse_starlette.sse import EventSourceResponse

from app.schemas.curator import CurateRequest
from app.deps import get_catalog, get_taste_source, get_curator
from app.providers.base import TrackCatalog, TasteSource, CuratorProvider
from app.services.affinity import compute_affinity

router = APIRouter(tags=['curator'])

@router.post('/curate')
async def curate(
    req: CurateRequest,
    authorization: str | None = Header(None),
    catalog: TrackCatalog = Depends(get_catalog),
    taste_source: TasteSource = Depends(get_taste_source),
    curator: CuratorProvider = Depends(get_curator),
):
    """Curadoria musical via streaming SSE.
    
    Eventos:
      - event: chunk  → {"text": "..."}
      - event: done   → {"trackIds": [...]}
    """
    # Mesmo padrão de decades.py — sem isso a curadoria sempre usava o
    # perfil demo, mesmo com usuário Spotify autenticado.
    user_token = authorization.split(" ")[1] if authorization and authorization.startswith("Bearer ") else None
    taste = await taste_source.get_taste(user_token)
    raw_tracks = await catalog.tracks_for_decade(req.decade, user_token)
    
    # Enriquecer com afinidade
    candidates = []
    for t in raw_tracks:
        aff = compute_affinity(t['features'], taste)
        candidates.append({**t, 'affinity': aff})
    
    # Ordenar por afinidade, pegar top 40 (ou todos se < 40)
    candidates.sort(key=lambda x: x['affinity'], reverse=True)
    candidates = candidates[:40]
    
    async def event_generator():
        async for chunk in curator.curate(req.prompt, candidates, taste, req.decade, req.size, catalog=catalog):
            # Verificar se é o sinal final
            try:
                data = json.loads(chunk)
                if data.get('__done__'):
                    yield {
                        'event': 'done',
                        'data': json.dumps({'trackIds': data['trackIds']}),
                    }
                    return
            except (json.JSONDecodeError, TypeError, AttributeError):
                pass
            
            yield {
                'event': 'chunk',
                'data': json.dumps({'text': chunk}),
            }
    
    return EventSourceResponse(event_generator())
