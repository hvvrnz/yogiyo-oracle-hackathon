from __future__ import annotations

import hashlib
from typing import Sequence


class MockEmbeddingClient:
    """Cohere Embed 4 연동 전 로컬 테스트용 결정적 임베딩 생성기입니다."""

    def __init__(self, dimensions: int = 16) -> None:
        self.dimensions = dimensions

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for text in texts:
            digest = hashlib.sha256(text.encode("utf-8")).digest()
            vector = [round((digest[i] / 255.0) * 2 - 1, 6) for i in range(self.dimensions)]
            vectors.append(vector)
        return vectors
