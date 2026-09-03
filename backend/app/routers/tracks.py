from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
import httpx
from app.deps import get_catalog

router = APIRouter(prefix="/tracks", tags=["tracks"])

@router.get("/{track_id}/audio")
async def get_track_audio(track_id: str, catalog = Depends(get_catalog)):
    track = catalog.get_track(track_id)
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
    track = catalog.get_track(track_id)
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
