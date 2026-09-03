"""Curador musical via Groq API - streaming ou non-streaming."""
from __future__ import annotations

import json
import re
from typing import AsyncIterator

import httpx

from app.providers.base import CuratorProvider, TrackCatalog
from app.services.affinity import compute_affinity

_MAX_TRACKS = 8

_SYSTEM_PROMPT = """\
Você é o curador musical do The Time Machine, uma plataforma de descoberta \
musical por década. Seu trabalho é reordenar e justificar uma seleção de \
faixas candidatas com base no pedido do usuário e no perfil de gosto dele.

REGRAS ESTRITAS:
1. Responda APENAS com faixas da lista de candidatos fornecida.
2. NUNCA invente faixas, artistas ou álbuns que não estejam na lista.
3. Selecione de 3 a 5 faixas, ordenadas por relevância ao pedido.
4. Para cada faixa, escreva 1-2 frases justificando a escolha com base \
   nos atributos acústicos e na afinidade com o perfil do usuário.
5. Encerre com uma pergunta de follow-up para refinar a seleção.
6. Escreva em português brasileiro, tom coloquial mas informado.
7. Use **negrito** para títulos de faixas.
8. Ao final da resposta, em uma linha separada, escreva exatamente:
   TRACK_IDS: id1, id2, id3, ...
   (usando os IDs exatos da lista de candidatos)

SUPERPODER DE BUSCA:
Se o usuário pedir explicitamente por uma música específica (ex: "toca X do Y") \
e essa música NÃO estiver na lista de candidatas, você tem permissão especial \
para pedir ao sistema que a busque. Para isso, responda APENAS com a seguinte linha (sem aspas):
[BUSCAR_NO_SPOTIFY: "NOME DA MÚSICA - ARTISTA"]
Não gere mais nenhum texto se usar este comando. O sistema fará a busca e te devolverá a música na próxima rodada.
"""

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

class GroqCurator(CuratorProvider):
    """Curador que usa Groq (via API REST) para reordenar."""

    def __init__(self, api_key: str, model: str = "openai/gpt-oss-20b"):
        self._model = model
        self._api_key = api_key

    def _build_user_prompt(
        self, prompt: str, candidates: list[dict], taste: dict, decade_id: str
    ) -> str:
        tracks_desc = []
        for t in candidates[:41]: # 40 + 1 injetada
            tracks_desc.append(
                f"- ID: {t['id']} | {t['title']} - {t['artist']} ({t['year']}) | "
                f"energia={t['features']['energy']:.2f} "
                f"valência={t['features']['valence']:.2f} "
                f"dançabilidade={t['features']['danceability']:.2f} "
                f"acústico={t['features']['acousticness']:.2f} "
                f"tempo={t['features']['tempo']:.0f}bpm | "
                f"afinidade={t.get('affinity', '?')}%"
            )

        return (
            f"DÉCADA: {decade_id}\n\n"
            f"PERFIL DO USUÁRIO:\n"
            f"  energia={taste['energy']:.2f}, "
            f"valência={taste['valence']:.2f}, "
            f"dançabilidade={taste['danceability']:.2f}, "
            f"acústico={taste['acousticness']:.2f}\n\n"
            f"FAIXAS CANDIDATAS:\n"
            + "\n".join(tracks_desc)
            + f"\n\nPEDIDO DO USUÁRIO: {prompt}"
        )

    async def curate(
        self,
        prompt: str,
        candidates: list[dict],
        taste: dict,
        decade_id: str,
        size: int = 15,
        catalog: TrackCatalog = None,
    ) -> AsyncIterator[str]:
        system_prompt = _SYSTEM_PROMPT.replace("3 a 5 faixas", f"{size} faixas")
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": self._build_user_prompt(prompt, candidates, taste, decade_id)}
        ]
        
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json"
        }

        full_text = ""
        max_turns = 2
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                for turn in range(max_turns):
                    req_data = {
                        "model": self._model,
                        "messages": messages,
                        "temperature": 0.7,
                        "max_tokens": 1024,
                        "stream": False
                    }
                    response = await client.post(GROQ_URL, json=req_data, headers=headers)
                    if response.status_code != 200:
                        yield f"Erro na curadoria: HTTP {response.status_code} - {response.text[:200]}"
                        yield json.dumps({"__done__": True, "trackIds": []})
                        return
                    
                    content = response.json().get("choices", [])[0].get("message", {}).get("content", "")
                    
                    match = re.search(r"\[BUSCAR_NO_SPOTIFY:\s*\"([^\"]+)\"\]", content, re.IGNORECASE)
                    if match and catalog and turn < max_turns - 1:
                        query = match.group(1)
                        yield f"*(Buscando {query} no Spotify...)*\n\n"
                        
                        new_track = await catalog.search_specific_track(query, decade_id)
                        if new_track:
                            new_track['affinity'] = compute_affinity(new_track['features'], taste)
                            candidates.append(new_track)
                            messages.append({"role": "assistant", "content": content})
                            messages.append({
                                "role": "user", 
                                "content": f"SISTEMA: A música foi encontrada com sucesso! Foi adicionada aos candidatos com o ID: {new_track['id']}. Por favor, gere a curadoria final recomendando esta música."
                            })
                        else:
                            messages.append({"role": "assistant", "content": content})
                            messages.append({
                                "role": "user", 
                                "content": f"SISTEMA: A música '{query}' não foi encontrada no Spotify. Por favor, peça desculpas ao usuário e recomende outras músicas da lista de candidatos original."
                            })
                        continue
                    
                    full_text = content
                    # Streaming simulado do resultado final
                    words = re.findall(r'\S+\s*', content)
                    for word in words:
                        yield word
                    break

        except Exception as e:
            yield f"Erro na curadoria: {str(e)}"
            yield json.dumps({"__done__": True, "trackIds": []})
            return

        valid_ids = {t["id"] for t in candidates}
        track_ids = self._extract_track_ids(full_text, valid_ids, size)
        if not track_ids:
            sorted_cands = sorted(candidates, key=lambda x: x.get("affinity", 0), reverse=True)
            track_ids = [t["id"] for t in sorted_cands[:size]]

        yield json.dumps({"__done__": True, "trackIds": track_ids})

    def _extract_track_ids(self, text: str, valid_ids: set[str], size: int) -> list[str]:
        match = re.search(r"TRACK_IDS:\s*(.+)", text, re.IGNORECASE)
        if match:
            raw_ids = [s.strip() for s in match.group(1).split(",")]
            validated = [tid for tid in raw_ids if tid in valid_ids]
            if validated:
                return validated[:size]

        found = re.findall(r"\b(\d{2}s-[A-Za-z0-9]+)\b", text)
        validated = [tid for tid in found if tid in valid_ids]
        seen: set[str] = set()
        unique: list[str] = []
        for tid in validated:
            if tid not in seen:
                seen.add(tid)
                unique.append(tid)
        return unique[:size]
