"""Estimativa de atributos acústicos via Groq — usado por SpotifyTrackCatalog
e SpotifyTasteSource enquanto o Spotify mantém /audio-features fechado para
apps novos e o motor de ML determinístico (docs/ML_ENGINE_ANALYSIS.md) não
substitui esta etapa.

NOTA: isto é uma estimativa do LLM, não um dado medido. É uma solução de
transição — ver Fase 4 do plano de execução.
"""
from __future__ import annotations

import json

import httpx

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


async def estimate_features(groq_api_key: str, tracks: list[dict]) -> dict[str, dict]:
    """Recebe faixas no formato bruto da Spotify Web API (id, name, artists)
    e devolve {track_id: {energy, valence, danceability, acousticness, popularity}}.

    Em qualquer falha (rede, parsing, HTTP != 200), devolve {} — quem chama
    já trata isso com DEFAULT_FEATURES por faixa.
    """
    if not tracks:
        return {}

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
