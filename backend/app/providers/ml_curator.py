"""Curador determinístico — substitui o GroqCurator como padrão (CLAUDE.md,
seção 4, Observação 3: "Substituir a curadoria LLM pelo Motor de ML").

Não depende de nenhuma chave de API: roda com o catálogo mock ou com o
catálogo Spotify indiferentemente, porque só precisa dos `features` que já
vêm em cada candidato. Isso também resolve o problema de disponibilidade
que motivou a troca — nenhum "model deprecated" pode derrubar isto.

curator_llm.py (Groq) não foi apagado — fica disponível para quem quiser
religar curadoria em linguagem natural mais expressiva no lugar deste, mas
deixou de ser o caminho padrão (ver app/main.py).
"""
from __future__ import annotations

import asyncio
import json
import re
from typing import AsyncIterator

from app.providers.base import CuratorProvider, TrackCatalog
from app.services.ml_recommender import MusicRecommender

# Mesma heurística de humor que já existia em MockCurator — é determinística
# e barata (regex), não precisa de LLM para isso também.
_MOODS = [
    ('noturna', re.compile(r'noite|madrugada|dirigir|escuro|night', re.I),
     lambda f: 1 - f['valence'] + f['energy'] * 0.4),
    ('dançante', re.compile(r'dan[çc]ar|festa|balada|dance|party', re.I),
     lambda f: f['danceability']),
    ('introspectiva', re.compile(r'calma|relax|tranquil|chill|acústic', re.I),
     lambda f: f['acousticness'] + (1 - f['energy'])),
    ('energética', re.compile(r'treino|academia|correr|energia|workout', re.I),
     lambda f: min(1.0, f['energy'] + f.get('tempo', 120) / 400)),
    ('solar', re.compile(r'feliz|alegre|verão|happy|sol', re.I),
     lambda f: f['valence']),
]


def _detect_mood(prompt: str):
    for name, regex, fn in _MOODS:
        if regex.search(prompt):
            return name, fn
    return 'geral', lambda f: f['energy'] * 0.5 + f['valence'] * 0.5


class MLCurator(CuratorProvider):
    """Content-Based Filtering: centroide de gosto + cosseno + MMR.

    Sub-10ms de cálculo (ver docs/ML_ENGINE_ANALYSIS.md) — o "streaming"
    abaixo é só para preservar a UX incremental que o frontend já espera
    (chunks de texto seguidos de um evento done com trackIds).
    """

    def __init__(self):
        self._rec = MusicRecommender()

    async def curate(
        self,
        prompt: str,
        candidates: list[dict],
        taste: dict,
        decade_id: str,
        size: int = 15,
        catalog: TrackCatalog = None,
    ) -> AsyncIterator[str]:
        mood_name, mood_fn = _detect_mood(prompt)
        taste_vector = self._rec.fit_user_taste(taste)

        scored = self._rec.score(candidates, taste_vector, mood_fn)
        selected = self._rec.mmr_select(scored, size)

        lines = [f'Uma seleção {mood_name} dos {decade_id} (motor de similaridade):\n\n']
        for i, (_, t, sim) in enumerate(selected, 1):
            affinity_pct = round(sim * 100)
            lines.append(f'{i}. **{t["title"]}** — {t["artist"]} ({t["year"]})\n')
            lines.append(f'   Afinidade: {affinity_pct}% · ')
            feat = t['features']
            if feat['energy'] > 0.7:
                lines.append('Energia alta. ')
            if feat['danceability'] > 0.7:
                lines.append('Ótima para dançar. ')
            if feat['acousticness'] > 0.5:
                lines.append('Acústica. ')
            lines.append('\n\n')
        lines.append('Quer que eu refine a seleção?')

        full_text = ''.join(lines)
        track_ids = [t['id'] for _, t, _ in selected]

        await asyncio.sleep(0.12)
        words = re.findall(r'\S+\s*', full_text)
        for word in words:
            yield word
            await asyncio.sleep(0.01)

        yield json.dumps({'__done__': True, 'trackIds': track_ids})
