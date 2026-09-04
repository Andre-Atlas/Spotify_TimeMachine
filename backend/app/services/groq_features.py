"""Estimativa de atributos acústicos via Groq — usado por SpotifyTrackCatalog
e SpotifyTasteSource enquanto o Spotify mantém /audio-features fechado para
apps novos e o motor de ML determinístico (docs/ML_ENGINE_ANALYSIS.md) não
substitui esta etapa.

NOTA: isto é uma estimativa do LLM, não um dado medido. É uma solução de
transição — ver Fase 4 do plano de execução.
"""
from __future__ import annotations

import json
from pathlib import Path

import httpx

from app.services.cache import TTLCache

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

_PROMPT_TEMPLATE = """Estime os valores acusticos (0.0 a 1.0) e a popularidade (0 a 100) para as seguintes musicas:
{track_list}

Responda SOMENTE com um JSON valido no formato:
{{
  "features": {{
     "ID_DA_MUSICA": {{"energy": 0.8, "valence": 0.5, "danceability": 0.6, "acousticness": 0.1, "popularity": 85}},
     ...
  }}
}}
"""

DEFAULT_FEATURES = {
    "energy": 0.5, "valence": 0.5, "danceability": 0.5, "acousticness": 0.5, "popularity": 50,
}

# Feature de uma faixa é um fato sobre a faixa, não sobre quem pediu — mas
# antes desse cache, cada usuário disparava sua própria estimativa Groq pra
# décadas que já tinham sido estimadas por outra pessoa (o cache de
# catálogo em spotify_catalog.py é por usuário, não por faixa). Isso
# multiplicava o consumo de tokens pelo número de usuários simultâneos e
# estourava o rate limit (visto em produção: "Limit 8000, Used 7906"),
# fazendo lotes inteiros caírem em DEFAULT_FEATURES — faixas empatadas,
# ordenação por afinidade/popularidade sem efeito visível, e as mesmas
# faixas "vencendo" pra qualquer perfil. 30 dias de TTL porque a
# característica sonora de uma faixa não muda.
_FEATURE_CACHE_TTL_SECONDS = 30 * 24 * 3600
_FEATURE_CACHE_PATH = Path(__file__).parent.parent / "data" / "cache" / "track_features_cache.json"
_feature_cache = TTLCache(_FEATURE_CACHE_TTL_SECONDS, persist_path=_FEATURE_CACHE_PATH)


async def _call_groq(groq_api_key: str, tracks: list[dict]) -> dict[str, dict]:
    """Chamada crua à Groq, sem cache — uso interno de estimate_features."""
    track_list_str = "\n".join(
        f"{t['id']}: {t['name']} - {t['artists'][0]['name']}" for t in tracks
    )
    prompt = _PROMPT_TEMPLATE.format(track_list=track_list_str)

    headers = {
        "Authorization": f"Bearer {groq_api_key}",
        "Content-Type": "application/json",
    }
    req_data = {
        "model": "openai/gpt-oss-20b",
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"},
        "temperature": 0.3,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            res = await client.post(GROQ_URL, json=req_data, headers=headers)
        except httpx.HTTPError as e:
            print("Groq request failed:", e)
            return {}

        if res.status_code != 200:
            print("Groq API Error:", res.text)
            return {}

        try:
            content = res.json()["choices"][0]["message"]["content"]
            data = json.loads(content)
            return data.get("features", {})
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            print("Error parsing Groq response:", e)
            return {}


async def estimate_features(groq_api_key: str, tracks: list[dict]) -> dict[str, dict]:
    """Recebe faixas no formato bruto da Spotify Web API (id, name, artists)
    e devolve {track_id: {energy, valence, danceability, acousticness, popularity}}.

    Só chama a Groq para as faixas que ainda não estão no cache — em regime
    permanente (catálogo relativamente estável, muitos usuários pedindo as
    mesmas décadas populares), a maioria das faixas já foi estimada por
    outra requisição antes, então isso reduz drasticamente o volume de
    tokens gasto por usuário novo. Faixas que falham na Groq (não estavam
    em cache e a chamada falhou) simplesmente não entram no dict devolvido
    — quem chama já trata isso com DEFAULT_FEATURES por faixa.
    """
    if not tracks:
        return {}

    result: dict[str, dict] = {}
    missing: list[dict] = []
    for t in tracks:
        cached = _feature_cache.get(t["id"])
        if cached is not None:
            result[t["id"]] = cached
        else:
            missing.append(t)

    if missing:
        fresh = await _call_groq(groq_api_key, missing)
        for tid, feat in fresh.items():
            _feature_cache.set(tid, feat)
        result.update(fresh)

    return result
