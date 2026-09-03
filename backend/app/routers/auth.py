import urllib.parse
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse
import httpx

from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"

@router.get("/spotify/login")
async def login_spotify(request: Request):
    if not settings.SPOTIFY_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Missing SPOTIFY_CLIENT_ID")
    
    # Guardar a origem do usuário no state para redirecionar de volta corretamente
    referer = request.headers.get("referer", settings.cors_origins[0])
    # Extrair apenas origin (scheme + host + port)
    parsed = urllib.parse.urlparse(referer)
    user_origin = f"{parsed.scheme}://{parsed.netloc}" if parsed.netloc else settings.cors_origins[0]
    
    scope = "playlist-modify-public playlist-modify-private user-top-read"
    params = {
        "response_type": "code",
        "client_id": settings.SPOTIFY_CLIENT_ID,
        "scope": scope,
        "redirect_uri": settings.spotify_redirect_uri,
        "state": user_origin,  # Guardar a origem real do usuário
        "show_dialog": "true", # Forçar a exibição da tela de login para permitir troca de conta
    }
    url = f"{SPOTIFY_AUTH_URL}?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url)

@router.get("/spotify/callback")
async def callback_spotify(request: Request, code: str = None, error: str = None, state: str = ""):
    if error:
        # Se o Spotify negou o acesso (ex: usuário não está na whitelist)
        frontend_url = state or settings.cors_origins[0]
        return RedirectResponse(f"{frontend_url}/#error={error}")
        
    if not code:
        raise HTTPException(status_code=400, detail="Missing code")
        
    if not settings.SPOTIFY_CLIENT_ID or not settings.SPOTIFY_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Missing Spotify credentials")
    
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": settings.spotify_redirect_uri,
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            SPOTIFY_TOKEN_URL,
            data=data,
            auth=(settings.SPOTIFY_CLIENT_ID, settings.SPOTIFY_CLIENT_SECRET),
        )
        
    if response.status_code != 200:
        error_detail = response.text
        print("SPOTIFY ERROR:", error_detail)
        raise HTTPException(status_code=400, detail=f"Failed to retrieve token: {error_detail}")
        
    token_data = response.json()
    access_token = token_data.get("access_token")
    
    # Redirecionar para a origem real do usuário (guardada no state)
    frontend_url = state or settings.cors_origins[0]
    return RedirectResponse(f"{frontend_url}/#token={access_token}")
