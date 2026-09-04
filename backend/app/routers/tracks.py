from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
import httpx
from app.deps import get_catalog
from app.providers.mock import MockTrackCatalog

router = APIRouter(prefix="/tracks", tags=["tracks"])

# Instância única reaproveitada entre requisições — evita reler o JSON do
# seed a cada 404, e serve de fallback de lookup para ids que vieram do
# catálogo local quando o Spotify estava em cooldown (ver routers/decades.py).
# O catálogo real registrado globalmente no app (SpotifyTrackCatalog) nunca
# viu esses ids, porque o fallback de decades.py cria um MockTrackCatalog()
# só para aquela resposta e descarta — sem isso, /audio e /cover devolviam
# 404 para toda faixa que a lista principal já tinha mostrado com sucesso.
_mock_fallback = MockTrackCatalog()


def _lookup_track(catalog, track_id: str) -> dict | None:
    track = catalog.get_track(track_id)
    if track:
        return track
    return _mock_fallback.get_track(track_id)


@router.get("/{track_id}/audio")
async def get_track_audio(track_id: str, catalog = Depends(get_catalog)):
    track = _lookup_track(catalog, track_id)
    if not track:
        raise HTTPException(404, "Track not found")
        
    search_title = track["title"].split(" - ")[0].split(" (")[0]
    search_artist = track["artist"].split(" & ")[0]
    
    url = f"https://api.deezer.com/search?q=track:\"{search_title}\" artist:\"{search_artist}\""
    async with httpx.AsyncClient() as client:
        res = await client.get(url)
        if res.status_code == 200:
            data = res.json()
            if data.get("data") and len(data["data"]) > 0:
                preview_url = data["data"][0].get("preview")
                if preview_url:
                    return RedirectResponse(preview_url)
                    
    raise HTTPException(404, "Audio not found on Deezer")

@router.get("/{track_id}/cover")
async def get_track_cover(track_id: str, catalog = Depends(get_catalog)):
    track = _lookup_track(catalog, track_id)
    if not track:
        raise HTTPException(404, "Track not found")
        
    search_title = track["title"].split(" - ")[0].split(" (")[0]
    search_artist = track["artist"].split(" & ")[0]
    
    url = f"https://api.deezer.com/search?q=track:\"{search_title}\" artist:\"{search_artist}\""
    async with httpx.AsyncClient() as client:
        res = await client.get(url)
        if res.status_code == 200:
            data = res.json()
            if data.get("data") and len(data["data"]) > 0:
                cover_url = data["data"][0]["album"].get("cover_xl")
                if cover_url:
                    return RedirectResponse(cover_url)
                    
    raise HTTPException(404, "Cover not found on Deezer")
