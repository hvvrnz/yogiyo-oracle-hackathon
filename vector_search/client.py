from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Sequence


@dataclass(frozen=True)
class SimilarOrder:
    order_id: str
    distance: float
    actual_cooking_min: float
    metadata: dict[str, Any]


class MockVectorSearchClient:
    """Oracle AI Vector Search 어댑터의 로컬 POC 구현입니다."""

    def __init__(self, rows: Sequence[SimilarOrder] | None = None) -> None:
        self.rows = list(rows or [])

    async def search(self, _: Sequence[float], limit: int = 5) -> list[SimilarOrder]:
        return sorted(self.rows, key=lambda row: row.distance)[:limit]
