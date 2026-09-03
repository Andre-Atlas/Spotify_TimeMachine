"""Cache com TTL e persistência opcional em disco.

Substitui os dicts em memória sem expiração de SpotifyTrackCatalog e
SpotifyTasteSource (débito técnico registrado em CLAUDE.md, Observação 1:
"Adicionar cache persistente em disco/memória (SQLite, Redis ou JSON
estruturado com TTL)"). JSON estruturado foi a opção escolhida — é
suficiente para o volume atual e não introduz uma dependência de infra
nova (Redis) só para isso.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any


class TTLCache:
    def __init__(self, ttl_seconds: float, persist_path: Path | None = None):
        self.ttl = ttl_seconds
        self._persist_path = persist_path
        self._store: dict[str, tuple[float, Any]] = {}
        if persist_path is not None:
            self._load()

    def _load(self) -> None:
        if not self._persist_path or not self._persist_path.exists():
            return
        try:
            raw = json.loads(self._persist_path.read_text(encoding="utf-8"))
            now = time.time()
            # descarta entradas já expiradas ao carregar
            self._store = {
                k: (ts, v) for k, (ts, v) in raw.items() if now - ts <= self.ttl
            }
        except (json.JSONDecodeError, OSError, ValueError) as e:
            print(f"TTLCache: falha ao carregar {self._persist_path}: {e}")
            self._store = {}

    def _save(self) -> None:
        if not self._persist_path:
            return
        try:
            self._persist_path.parent.mkdir(parents=True, exist_ok=True)
            self._persist_path.write_text(
                json.dumps(self._store, ensure_ascii=False), encoding="utf-8"
            )
        except OSError as e:
            print(f"TTLCache: falha ao salvar {self._persist_path}: {e}")

    def values(self) -> list[Any]:
        """Todos os valores vivos no cache — usado para reconstruir índices
        auxiliares (ex: lookup por id) depois de carregar do disco."""
        return [v for _, v in self._store.values()]

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if not entry:
            return None
        ts, value = entry
        if time.time() - ts > self.ttl:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value: Any) -> None:
        self._store[key] = (time.time(), value)
        self._save()
