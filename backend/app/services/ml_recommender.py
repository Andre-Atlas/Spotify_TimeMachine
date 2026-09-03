"""Motor de recomendação determinístico — Content-Based Filtering.

Implementa exatamente o que docs/ML_ENGINE_ANALYSIS.md e CLAUDE.md (seção 6,
Passo 3) descrevem: centroide de gosto + similaridade de cosseno sobre os
atributos acústicos, sem LLM na etapa de ranking. Roda em milissegundos,
não depende de nenhuma chave de API, e é 100% determinístico — a mesma
entrada sempre produz a mesma saída.

O termo de diversidade (MMR) evita que a lista vire N variações da mesma
faixa, que é como um recomendador tecnicamente correto acaba parecendo
quebrado na prática.
"""
from __future__ import annotations

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

FEATURE_KEYS = ("energy", "valence", "danceability", "acousticness")


def to_vector(features: dict) -> np.ndarray:
    return np.array([features.get(k, 0.5) for k in FEATURE_KEYS], dtype=float)


class MusicRecommender:
    def fit_user_taste(self, taste: dict) -> np.ndarray:
        """Centroide do gosto do usuário — Fase 1 já entrega isso pronto
        (SpotifyTasteSource já faz a média das top tracks); aqui só convertemos
        para vetor."""
        return to_vector(taste)

    def score(
        self,
        candidates: list[dict],
        taste_vector: np.ndarray,
        mood_fn=None,
        mood_weight: float = 0.3,
    ) -> list[tuple[float, dict, float]]:
        """Retorna [(score_total, candidato, similaridade_pura), ...].

        score_total combina a similaridade de cosseno com o gosto (peso
        1 - mood_weight) e um termo de humor detectado no prompt (peso
        mood_weight) — o mesmo espírito heurístico que já existia no
        MockCurator, só que agora a parte de gosto é cosseno de verdade
        em vez de distância Manhattan.
        """
        if not candidates:
            return []

        vectors = np.array([to_vector(c["features"]) for c in candidates])
        sims = cosine_similarity(vectors, taste_vector.reshape(1, -1)).flatten()

        scored = []
        for c, sim in zip(candidates, sims):
            mood_score = mood_fn(c["features"]) if mood_fn else sim
            total = (1 - mood_weight) * sim + mood_weight * mood_score
            scored.append((float(total), c, float(sim)))
        return scored

    def mmr_select(
        self,
        scored: list[tuple[float, dict, float]],
        size: int,
        lambda_: float = 0.75,
    ) -> list[tuple[float, dict, float]]:
        """Maximal Marginal Relevance: a cada passo escolhe o candidato que
        maximiza (relevância − redundância com o que já foi escolhido), em
        vez de simplesmente pegar os top-N por score. lambda_ alto favorece
        relevância; lambda_ baixo favorece diversidade."""
        remaining = sorted(scored, key=lambda x: -x[0])
        if not remaining:
            return []

        selected = [remaining.pop(0)]
        selected_vectors = [to_vector(selected[0][1]["features"])]

        while remaining and len(selected) < size:
            best_idx, best_mmr = 0, -1e9
            for i, (score, cand, sim) in enumerate(remaining):
                v = to_vector(cand["features"]).reshape(1, -1)
                redundancy = max(
                    cosine_similarity(v, sv.reshape(1, -1))[0][0] for sv in selected_vectors
                )
                mmr = lambda_ * score - (1 - lambda_) * redundancy
                if mmr > best_mmr:
                    best_mmr, best_idx = mmr, i

            chosen = remaining.pop(best_idx)
            selected.append(chosen)
            selected_vectors.append(to_vector(chosen[1]["features"]))

        return selected
