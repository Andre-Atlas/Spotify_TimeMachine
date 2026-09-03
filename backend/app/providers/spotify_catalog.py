"""TrackCatalog Provider real usando Spotify API + Groq."""
import base64
import json
import random
import asyncio
from typing import AsyncIterator

import httpx

from app.providers.base import TrackCatalog
from app.models.decade import DECADE_MAP

class SpotifyTrackCatalog(TrackCatalog):
    def __init__(self, spotify_client_id: str, spotify_client_secret: str, groq_api_key: str):
        self.client_id = spotify_client_id
        self.client_secret = spotify_client_secret
        self.groq_api_key = groq_api_key
        self._cache: dict[str, list[dict]] = {}
        self._all_tracks: dict[str, dict] = {}
        self._token: str | None = None

    async def _get_token(self) -> str:
        if self._token:
            return self._token
        
        auth_str = f"{self.client_id}:{self.client_secret}"
        b64_auth = base64.b64encode(auth_str.encode()).decode()
        
        async with httpx.AsyncClient() as client:
            res = await client.post(
                "https://accounts.spotify.com/api/token",
                headers={"Authorization": f"Basic {b64_auth}"},
                data={"grant_type": "client_credentials"}
            )
            res.raise_for_status()
            self._token = res.json()["access_token"]
            return self._token

    async def _get_user_top_genres(self, user_token: str) -> list[str]:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                "https://api.spotify.com/v1/me/top/artists?limit=10",
                headers={"Authorization": f"Bearer {user_token}"}
            )
            if res.status_code == 200:
                artists = res.json().get("items", [])
                genres = set()
                for a in artists:
                    for g in a.get("genres", []):
                        genres.add(g)
                return list(genres)[:3] # top 3 genres
        return []

    async def _fetch_from_spotify(self, decade_id: str, user_token: str | None = None) -> list[dict]:
        token = await self._get_token()
        
        offset = random.randint(0, 300)
        
        decade_info = DECADE_MAP.get(decade_id)
        if not decade_info:
            return []
            
        years = decade_info['years'].replace(' – ', '-').replace(' \u2013 ', '-').replace(' - ', '-')
        
        genres_query = ""
        if user_token:
            top_genres = await self._get_user_top_genres(user_token)
            if top_genres:
                genres_query = " " + " OR ".join(f'genre:"{g}"' for g in top_genres)
                offset = 0 # If filtering by specific genre, reset offset to find matches
                
        query = f"year:{years}{genres_query}"
        print(f"Spotify Search Query: {query}")
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            items = []
            for i in range(4):
                req_offset = offset + (i * 10)
                for attempt in range(3):
                    try:
                        res = await client.get(
                            "https://api.spotify.com/v1/search",
                            headers={"Authorization": f"Bearer {token}"},
                            params={"q": query, "type": "track", "limit": 10, "offset": req_offset}
                        )
                        if res.status_code == 200:
                            batch = res.json().get("tracks", {}).get("items", [])
                            items.extend(batch)
                            break
                        else:
                            print(f"Spotify API Error (offset {req_offset}):", res.text)
                            if res.status_code == 502:
                                await asyncio.sleep(0.5)
                                continue
                            break
                    except Exception as e:
                        print("Exception fetching from Spotify:", e)
                        await asyncio.sleep(0.5)
            
            if not items:
                raise Exception("Spotify returned no items or 502 repeatedly.")
            
            return items

    async def _enrich_with_groq(self, spotify_tracks: list[dict]) -> dict[str, dict]:
        track_list_str = "\n".join([f"{t['id']}: {t['name']} - {t['artists'][0]['name']}" for t in spotify_tracks])
        
        prompt = f"""Estime os valores acusticos (0.0 a 1.0) e a popularidade (0 a 100) para as seguintes musicas:
{track_list_str}

Responda SOMENTE com um JSON valido no formato:
{{
  "features": {{
     "ID_DA_MUSICA": {{"energy": 0.8, "valence": 0.5, "danceability": 0.6, "acousticness": 0.1, "popularity": 85}},
     ...
  }}
}}
"""
        headers = {
            "Authorization": f"Bearer {self.groq_api_key}",
            "Content-Type": "application/json"
        }
        req_data = {
            "model": "openai/gpt-oss-20b",
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"},
            "temperature": 0.3
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.post("https://api.groq.com/openai/v1/chat/completions", json=req_data, headers=headers)
            if res.status_code == 200:
                try:
                    content = res.json()["choices"][0]["message"]["content"]
                    data = json.loads(content)
                    return data.get("features", {})
                except Exception as e:
                    print("Error parsing Groq response:", e)
            else:
                print("Groq API Error:", res.text)
        return {}

    async def tracks_for_decade(self, decade_id: str, user_token: str | None = None) -> list[dict]:
        cache_key = f"{decade_id}_{user_token[:10] if user_token else 'anon'}"
        if cache_key in self._cache:
            return self._cache[cache_key]
            
        print(f"Buscando faixas reais para a decada {decade_id} no Spotify...", flush=True)
        items = await self._fetch_from_spotify(decade_id, user_token)
        if not items:
            return []
            
        print(f"Enriquecendo {len(items)} faixas com Groq...", flush=True)
        features_map = await self._enrich_with_groq(items)
        
        processed = []
        for t in items:
            tid = t["id"]
            feat = features_map.get(tid, {
                "energy": 0.5, "valence": 0.5, "danceability": 0.5, "acousticness": 0.5, "popularity": 50
            })
            
            track_dict = {
                "id": f"{decade_id}-{tid}",
                "decade": decade_id,
                "title": t["name"],
                "artist": ", ".join(a["name"] for a in t["artists"]),
                "album": t["album"]["name"],
                "year": int(t["album"]["release_date"][:4]) if len(t["album"].get("release_date", "")) >= 4 else 0,
                "durationMs": t["duration_ms"],
                "palette": ["#202020", "#808080"],
                "features": {
                    "energy": feat.get("energy", 0.5),
                    "valence": feat.get("valence", 0.5),
                    "danceability": feat.get("danceability", 0.5),
                    "acousticness": feat.get("acousticness", 0.5),
                    "tempo": 120.0,
                },
                "music": {
                    "root": 0,
                    "minor": False,
                    "bpm": 120,
                    "drums": True
                },
                "popularity": feat.get("popularity", 50),
                "audioUrl": t.get("preview_url"),
                "coverUrl": t["album"]["images"][0]["url"] if t["album"].get("images") else None,
                "spotify_uri": t["uri"]
            }
            self._all_tracks[track_dict['id']] = track_dict
            processed.append(track_dict)
            
        if not processed:
            raise Exception("No tracks were processed successfully.")
            
        self._cache[cache_key] = processed
        return processed

    async def search_specific_track(self, query: str, decade_id: str) -> dict | None:
        token = await self._get_token()
        async with httpx.AsyncClient() as client:
            res = await client.get(
                "https://api.spotify.com/v1/search",
                headers={"Authorization": f"Bearer {token}"},
                params={"q": query, "type": "track", "limit": 1}
            )
            if res.status_code != 200:
                return None
            items = res.json().get("tracks", {}).get("items", [])
            if not items:
                return None
            t = items[0]
            
            features_map = await self._enrich_with_groq([t])
            feat = features_map.get(t["id"], {
                "energy": 0.5, "valence": 0.5, "danceability": 0.5, "acousticness": 0.5, "popularity": 50
            })
            
            track_dict = {
                "id": f"{decade_id}-{t['id']}",
                "decade": decade_id,
                "title": t["name"],
                "artist": ", ".join(a["name"] for a in t["artists"]),
                "album": t["album"]["name"],
                "year": int(t["album"]["release_date"][:4]) if len(t["album"].get("release_date", "")) >= 4 else 0,
                "durationMs": t["duration_ms"],
                "palette": ["#202020", "#808080"],
                "features": {
                    "energy": feat.get("energy", 0.5),
                    "valence": feat.get("valence", 0.5),
                    "danceability": feat.get("danceability", 0.5),
                    "acousticness": feat.get("acousticness", 0.5),
                    "tempo": 120.0,
                },
                "music": {
                    "root": 0,
                    "minor": False,
                    "bpm": 120,
                    "drums": True
                },
                "popularity": feat.get("popularity", 50),
                "audioUrl": t.get("preview_url"),
                "coverUrl": t["album"]["images"][0]["url"] if t["album"].get("images") else None,
                "spotify_uri": t["uri"]
            }
            self._all_tracks[track_dict['id']] = track_dict
            return track_dict

    def get_track(self, track_id: str) -> dict | None:
        return self._all_tracks.get(track_id)
