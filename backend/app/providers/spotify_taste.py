"""TasteSource real usando o Spotify /v1/me/top/tracks do usuário logado.

Antes desta implementação, main.py registrava incondicionalmente
MockTasteSource() — mesmo com um usuário autenticado, o perfil de gosto
usado em toda a app (afinidade, curadoria) era sempre o DEMO_TASTE fixo.
O frontend já manda o token pensando em "Taste Alignment"; este provider é
o lado que faltava.

Limitação conhecida: o Spotify não expõe mais /audio-features para apps
novos (ver claude/prototipo-3d-status.md), então as features das faixas do
usuário são estimadas via Groq — a mesma técnica de transição já usada em
SpotifyTrackCatalog. Isso deve ser substituído junto com o catálogo quando
o motor de ML determinístico (Fase 4) entrar.
"""
from __future__ import annotations

from pathlib import Path

import httpx

from app.providers.base import TasteSource
from app.services.groq_features import estimate_features, DEFAULT_FEATURES
from app.services.cache import TTLCache

DEMO_TASTE = {
    "energy": 0.78,
    "valence": 0.55,
    "danceability": 0.70,
    "acousticness": 0.08,
}

_TOP_TRACKS_LIMIT = 20
_CACHE_TTL_SECONDS = 6 * 3600
_CACHE_PATH = Path(__file__).parent.parent / "data" / "cache" / "taste_cache.json"


class SpotifyTasteSource(TasteSource):
    def __init__(self, groq_api_key: str):
        self.groq_api_key = groq_api_key
        self._cache = TTLCache(_CACHE_TTL_SECONDS, persist_path=_CACHE_PATH)

    async def _fetch_top_tracks(self, user_token: str) -> list[dict]:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(
                "https://api.spotify.com/v1/me/top/tracks",
                headers={"Authorization": f"Bearer {user_token}"},
                params={"limit": _TOP_TRACKS_LIMIT, "time_range": "medium_term"},
            )
            if res.status_code != 200:
                print("Spotify top/tracks error:", res.status_code, res.text)
                return []
            return res.json().get("items", [])

    async def get_taste(self, user_id: str | None = None) -> dict:
        """`user_id` aqui é, na prática, o access token do usuário — mesmo
        padrão já usado por TrackCatalog.tracks_for_decade(decade, user_token).
        Sem token, cai no perfil demo (comportamento anterior preservado
        para visitantes não autenticados).
        """
        user_token = user_id
        if not user_token:
            return DEMO_TASTE.copy()

        cache_key = user_token[:16]
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        top_tracks = await self._fetch_top_tracks(user_token)
        if not top_tracks:
            return DEMO_TASTE.copy()

        features_map = await estimate_features(self.groq_api_key, top_tracks)

        keys = ("energy", "valence", "danceability", "acousticness")
        totals = {k: 0.0 for k in keys}
        n = 0
        for t in top_tracks:
            feat = features_map.get(t["id"], DEFAULT_FEATURES)
            for k in keys:
                totals[k] += feat.get(k, DEFAULT_FEATURES[k])
            n += 1

        taste = {k: round(totals[k] / n, 4) for k in keys}
        self._cache.set(cache_key, taste)
        return taste
