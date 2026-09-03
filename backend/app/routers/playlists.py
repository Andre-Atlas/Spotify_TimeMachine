from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
import httpx

from app.deps import get_catalog

router = APIRouter(prefix="/playlists", tags=["playlists"])

class ExportRequest(BaseModel):
    title: str
    trackIds: list[str]

@router.post("/export")
async def export_playlist(request: Request, payload: ExportRequest, catalog = Depends(get_catalog)):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
        
    token = auth_header.split(" ")[1]

    # Antes disso forçava sempre MockTrackCatalog() aqui, então IDs vindos
    # do catálogo real do Spotify (ex: "80s-3xK9...") nunca batiam com os
    # IDs do seed mock ("80s-0") e o export quebrava com 404 sempre que o
    # app estava rodando em modo real. get_track() já existe nos dois
    # providers (mock e Spotify) — usar o catálogo injetado de verdade.
    local_tracks = []
    for tid in payload.trackIds:
        t = catalog.get_track(tid)
        if t:
            local_tracks.append(t)

    if not local_tracks:
        raise HTTPException(status_code=404, detail="No valid tracks found in catalog")
        
    async with httpx.AsyncClient() as client:
        # Obter o ID do usuário no Spotify
        me_resp = await client.get(
            "https://api.spotify.com/v1/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        if me_resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Spotify token")
            
        user_id = me_resp.json()["id"]
        print(f"USER ID: {user_id}", flush=True)

        # Criar a playlist (API 2026)
        create_resp = await client.post(
            "https://api.spotify.com/v1/me/playlists",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": payload.title, "public": False}
        )
        if create_resp.status_code not in (200, 201):
            print("SPOTIFY ERROR CREATE PLAYLIST:", create_resp.text, flush=True)
            raise HTTPException(status_code=500, detail=f"Failed to create playlist: {create_resp.text}")
            
        playlist_id = create_resp.json()["id"]
        
        # Resolver URIs: faixas que já vieram do catálogo Spotify carregam
        # spotify_uri direto (evita uma busca redundante); só faixas do
        # catálogo mock (sem esse campo) caem no fallback de busca por
        # título/artista.
        spotify_uris = []
        for t in local_tracks:
            uri = t.get("spotify_uri")
            if uri:
                spotify_uris.append(uri)
                continue

            query = f"track:{t['title']} artist:{t['artist']}"
            search_resp = await client.get(
                "https://api.spotify.com/v1/search",
                headers={"Authorization": f"Bearer {token}"},
                params={"q": query, "type": "track", "limit": 1}
            )
            if search_resp.status_code == 200:
                items = search_resp.json().get("tracks", {}).get("items", [])
                if items:
                    spotify_uris.append(items[0]["uri"])
                    
        # Adicionar tracks à playlist (API 2026)
        if spotify_uris:
            add_resp = await client.post(
                f"https://api.spotify.com/v1/playlists/{playlist_id}/items",
                headers={"Authorization": f"Bearer {token}"},
                json={"uris": spotify_uris}
            )
            if add_resp.status_code != 201:
                print("SPOTIFY ERROR ADD TRACKS:", add_resp.text, flush=True)
                
    return {"status": "success", "playlist_id": playlist_id, "spotify_uris_added": len(spotify_uris)}
