"""TrackCatalog Provider real usando Spotify API + Groq."""
import base64
import time
import zlib
import asyncio
from pathlib import Path

import httpx

from app.providers.base import TrackCatalog
from app.models.decade import DECADE_MAP
from app.services.groq_features import estimate_features, DEFAULT_FEATURES
from app.services.cache import TTLCache

# 6h: décadas não mudam, mas o resultado de busca pode variar levemente
# entre execuções do Spotify — TTL evita tanto "nunca expira" (débito
# antigo) quanto "expira toda hora" (custa 4 buscas + 1 chamada Groq).
CACHE_TTL_SECONDS = 6 * 3600
CACHE_PATH = Path(__file__).parent.parent / "data" / "cache" / "catalog_cache.json"


def _stable_offset(decade_id: str, salt: str = "", span: int = 190) -> int:
    """Offset determinístico por década (e opcionalmente por usuário) —
    substitui random.randint(0, 300).

    O aleatório antigo fazia o resultado mudar a cada cold start e podia
    superar o total de resultados de uma busca estreita (gênero + década),
    devolvendo lista vazia sem motivo. crc32 é estável entre processos
    (diferente de hash() de str, que tem seed aleatória por padrão).

    `salt` (fatia do token do usuário) existe para separar o pool de
    faixas entre usuários que não têm gênero de destaque detectável — sem
    isso, todo mundo nessa situação cai exatamente na mesma busca
    "year:198X" sem filtro nenhum, e as mesmas faixas aparecem pra
    qualquer perfil, disfarçando qualquer diferença na curadoria."""
    return zlib.crc32(f"{decade_id}:{salt}".encode()) % span


class SpotifyTrackCatalog(TrackCatalog):
    def __init__(
        self,
        spotify_client_id: str,
        spotify_client_secret: str,
        groq_api_key: str,
        cache_ttl_seconds: float = CACHE_TTL_SECONDS,
    ):
        self.client_id = spotify_client_id
        self.client_secret = spotify_client_secret
        self.groq_api_key = groq_api_key
        self._cache = TTLCache(cache_ttl_seconds, persist_path=CACHE_PATH)
        self._all_tracks: dict[str, dict] = {}
        self._token: str | None = None
        self._token_exp: float = 0.0
        self._locks: dict[str, asyncio.Lock] = {}

        # repovoa o índice de lookup por id com o que sobreviveu no disco,
        # senão get_track() (usado no export de playlist) fica vazio até a
        # primeira requisição de cada década depois de um restart
        for track_list in self._cache.values():
            for t in track_list:
                self._all_tracks[t["id"]] = t

    async def _get_token(self, force: bool = False) -> str:
        # O token de client credentials do Spotify expira em ~1h. Antes isto
        # guardava self._token para sempre e nunca renovava: o processo do
        # Render fica de pé por horas, então depois da primeira hora TODA
        # busca voltava 401, items ficava vazio e a década inteira quebrava
        # com 500 — sintoma "estava funcionando e parou de aparecer".
        now = time.time()
        if self._token and not force and now < self._token_exp:
            return self._token

        auth_str = f"{self.client_id}:{self.client_secret}"
        b64_auth = base64.b64encode(auth_str.encode()).decode()

        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                "https://accounts.spotify.com/api/token",
                headers={"Authorization": f"Basic {b64_auth}"},
                data={"grant_type": "client_credentials"}
            )
            res.raise_for_status()
            payload = res.json()
            self._token = payload["access_token"]
            # renova 60 s antes de expirar, para não perder uma corrida
            self._token_exp = time.time() + payload.get("expires_in", 3600) - 60
            return self._token

    async def _get_user_top_genres(self, user_token: str) -> list[str]:
        async with httpx.AsyncClient(timeout=15.0) as client:
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
                return sorted(genres)[:3]  # top 3 genres, ordem estável
        return []

    async def _search(self, client: httpx.AsyncClient, query: str, offset: int) -> list[dict]:
        """Busca até 4 páginas de 10. Renova o token em 401 e recua de
        verdade em 429 — se a PRIMEIRA página já vier 429 depois de 3
        tentativas, desiste do resto em vez de continuar batendo nas outras
        3 páginas (cada uma com suas próprias 3 tentativas): antes disso
        cada década podia gastar até 12 chamadas mesmo já sabendo que a
        cota estava estourada, e com várias décadas em paralelo isso
        alimentava o próprio 429 (visto em produção: rajada de
        QUOTA_EXCEEDED)."""
        items: list[dict] = []
        for i in range(4):
            req_offset = offset + (i * 10)
            got_page = False
            for attempt in range(3):
                try:
                    token = await self._get_token()
                    res = await client.get(
                        "https://api.spotify.com/v1/search",
                        headers={"Authorization": f"Bearer {token}"},
                        params={"q": query, "type": "track", "limit": 10, "offset": req_offset}
                    )
                    if res.status_code == 200:
                        items.extend(res.json().get("tracks", {}).get("items", []))
                        got_page = True
                        break
                    if res.status_code == 401:
                        print("Spotify 401: renovando token de app")
                        await self._get_token(force=True)
                        continue
                    print(f"Spotify API Error (offset {req_offset}):", res.text)
                    if res.status_code == 429:
                        retry_after = res.headers.get("Retry-After")
                        wait = float(retry_after) if retry_after else 0.6 * (2 ** attempt)
                        await asyncio.sleep(min(wait, 4.0))
                        continue
                    if res.status_code in (502, 503):
                        await asyncio.sleep(0.5 * (attempt + 1))
                        continue
                    break
                except Exception as e:
                    print("Exception fetching from Spotify:", e)
                    await asyncio.sleep(0.5)
            if not got_page:
                # a página falhou mesmo depois de retry — a cota está
                # apertada agora; corta o prejuízo em vez de insistir nas
                # próximas páginas.
                break
        return items

    async def _fetch_from_spotify(self, decade_id: str, genres: list[str]) -> list[dict]:
        decade_info = DECADE_MAP.get(decade_id)
        if not decade_info:
            return []

        years = decade_info['years'].replace(' – ', '-').replace(' \u2013 ', '-').replace(' - ', '-')
        base_query = f"year:{years}"
        genre_sig = ",".join(genres) if genres else ""
        offset = _stable_offset(decade_id, salt=genre_sig)

        query, q_offset = base_query, offset
        if genres:
            query = base_query + " " + " OR ".join(f'genre:"{g}"' for g in genres)
            q_offset = 0

        async with httpx.AsyncClient(timeout=15.0) as client:
            print(f"Spotify Search Query: {query}")
            items = await self._search(client, query, q_offset)

            # gênero + década é um recorte estreito e legitimamente pode não
            # ter resultado nenhum. Antes isso levantava exceção e derrubava
            # a década inteira com 500; agora cai para a busca só por ano.
            if not items and query != base_query:
                print("Sem resultados com filtro de gênero — repetindo só por ano")
                items = await self._search(client, base_query, offset)

            return items

    async def _enrich_with_groq(self, spotify_tracks: list[dict]) -> dict[str, dict]:
        return await estimate_features(self.groq_api_key, spotify_tracks)

    async def tracks_for_decade(self, decade_id: str, user_token: str | None = None) -> list[dict]:
        # Chave por SIGNATURE DE GÊNERO, não por usuário individual — antes
        # cada usuário tinha sua própria fatia de cache e disparava sua
        # própria bateria de buscas do zero, mesmo que outro usuário
        # segundos antes tivesse acabado de buscar a mesma coisa (mesmos
        # gêneros de destaque, ou nenhum). Isso multiplicava o consumo da
        # cota do Spotify pelo número de usuários simultâneos — a causa
        # direta do 429 QUOTA_EXCEEDED visto em produção. Usuários com o
        # mesmo perfil de gênero (comum — pop/rock/hip-hop dominam) agora
        # dividem a mesma busca e o mesmo resultado.
        genres = await self._get_user_top_genres(user_token) if user_token else []
        genre_sig = ",".join(genres) if genres else "anon"
        cache_key = f"{decade_id}_{genre_sig}"

        # Serializa buscas concorrentes para a MESMA chave: sem isso, três
        # pessoas com o mesmo perfil pedindo a mesma década ao mesmo tempo
        # (cache ainda vazio) disparavam três buscas idênticas em paralelo.
        lock = self._locks.setdefault(cache_key, asyncio.Lock())
        async with lock:
            cached = self._cache.get(cache_key)
            if cached is not None:
                return cached

            print(f"Buscando faixas reais para a decada {decade_id} no Spotify...", flush=True)
            items = await self._fetch_from_spotify(decade_id, genres)
            if not items:
                return []

            print(f"Enriquecendo {len(items)} faixas com Groq...", flush=True)
            features_map = await self._enrich_with_groq(items)

            processed = []
            for t in items:
                tid = t["id"]
                feat = features_map.get(tid, DEFAULT_FEATURES)

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
                print(f"Nenhuma faixa processada para {decade_id}")
                return []

            self._cache.set(cache_key, processed)
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
            feat = features_map.get(t["id"], DEFAULT_FEATURES)
            
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
