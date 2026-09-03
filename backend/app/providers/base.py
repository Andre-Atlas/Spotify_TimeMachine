from abc import ABC, abstractmethod
from typing import AsyncIterator

class TasteSource(ABC):
    @abstractmethod
    async def get_taste(self, user_id: str | None = None) -> dict:
        """Retorna perfil de gosto {energy, valence, danceability, acousticness}."""

class TrackCatalog(ABC):
    @abstractmethod
    async def tracks_for_decade(self, decade_id: str, user_token: str | None = None) -> list[dict]:
        """Retorna faixas brutas para uma década."""

    @abstractmethod
    async def search_specific_track(self, query: str, decade_id: str) -> dict | None:
        """Busca faixa especifica no spotify"""

    @abstractmethod
    def get_track(self, track_id: str) -> dict | None:
        """Retorna uma faixa previamente cacheada por ID."""

class CuratorProvider(ABC):
    @abstractmethod
    async def curate(
        self,
        prompt: str,
        candidates: list[dict],
        taste: dict,
        decade_id: str,
        size: int = 15,
        catalog: TrackCatalog = None,
    ) -> AsyncIterator[str]:
        """Gera chunks de texto via streaming. Último chunk é JSON com trackIds."""
