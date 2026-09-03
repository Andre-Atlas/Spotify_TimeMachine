"""Implementações mock dos providers — réplica da lógica do frontend."""
import json
import asyncio
import re
from pathlib import Path
from typing import AsyncIterator

from app.providers.base import TasteSource, TrackCatalog, CuratorProvider
from app.services.affinity import compute_affinity

# Perfil de gosto demo (espelho de DEMO_TASTE no frontend)
DEMO_TASTE = {
    'energy': 0.78,
    'valence': 0.55,
    'danceability': 0.70,
    'acousticness': 0.08,
}

class MockTasteSource(TasteSource):
    async def get_taste(self, user_id=None):
        return DEMO_TASTE.copy()

class MockTrackCatalog(TrackCatalog):
    def __init__(self):
        data_path = Path(__file__).parent.parent / 'data' / 'seed_tracks.json'
        with open(data_path, 'r', encoding='utf-8') as f:
            self._tracks = json.load(f)
    
    async def tracks_for_decade(self, decade_id: str, user_token: str | None = None) -> list[dict]:
        return [t for t in self._tracks if t['decade'] == decade_id]

    async def search_specific_track(self, query: str, decade_id: str) -> dict | None:
        return None

    def get_track(self, track_id: str) -> dict | None:
        return next((t for t in self._tracks if t['id'] == track_id), None)

class MockCurator(CuratorProvider):
    """Réplica da lógica de curator.ts — regex de humor + scoring."""
    
    MOODS = [
        ('noturna', re.compile(r'noite|madrugada|dirigir|escuro|night', re.I),
         lambda f: 1 - f['valence'] + f['energy'] * 0.4),
        ('dançante', re.compile(r'dan[çc]ar|festa|balada|dance|party', re.I),
         lambda f: f['danceability']),
        ('introspectiva', re.compile(r'calma|relax|tranquil|chill|acústic', re.I),
         lambda f: f['acousticness'] + (1 - f['energy'])),
        ('energética', re.compile(r'treino|academia|correr|energia|workout', re.I),
         lambda f: f['energy'] + f['features_tempo_norm']),
        ('solar', re.compile(r'feliz|alegre|verão|happy|sol', re.I),
         lambda f: f['valence']),
    ]
    
    async def curate(
        self, prompt: str, candidates: list[dict], taste: dict, decade_id: str, size: int = 15, catalog=None
    ) -> AsyncIterator[str]:
        # Detectar humor
        mood_name = 'geral'
        mood_fn = lambda f: f['energy'] * 0.5 + f['valence'] * 0.5
        for name, regex, fn in self.MOODS:
            if regex.search(prompt):
                mood_name = name
                mood_fn = fn
                break
        
        # Scoring: mood*0.6 + affinity/100*0.4
        scored = []
        for t in candidates:
            feats = t['features'].copy()
            feats['features_tempo_norm'] = feats['tempo'] / 400
            aff = compute_affinity(t['features'], taste)
            mood_score = mood_fn(feats)
            total = mood_score * 0.6 + (aff / 100) * 0.4
            scored.append((total, t, aff))
        
        scored.sort(key=lambda x: -x[0])
        top5 = scored[:5]
        
        # Montar resposta
        lines = [f'Uma seleção {mood_name} dos {decade_id}:\n\n']
        for i, (_, t, aff) in enumerate(top5, 1):
            lines.append(f'{i}. **{t["title"]}** — {t["artist"]} ({t["year"]})\n')
            lines.append(f'   Afinidade: {aff}% · ')
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
        track_ids = [t['id'] for _, t, _ in top5[:size]]
        
        # Streaming simulado
        await asyncio.sleep(0.42)
        words = re.findall(r'\S+\s*', full_text)
        for word in words:
            yield word
            await asyncio.sleep(0.012 + 0.026 * (hash(word) % 100) / 100)
        
        # Sinal final com trackIds (JSON)
        yield json.dumps({'__done__': True, 'trackIds': track_ids})
