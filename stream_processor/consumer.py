from __future__ import annotations

from datetime import datetime
from typing import Any, AsyncIterator, Protocol

from stream_processor.clustering import OrderCluster, OrderClusterer


class OrderEventSource(Protocol):
    def __aiter__(self) -> AsyncIterator[dict[str, Any]]: ...


class OrderConsumer:
    """Kafka 주문 이벤트 처리 계층의 인터페이스입니다.

    현재 웹 데모는 메모리 상태를 사용하며, OCI VM에서 Kafka를 연결할 때
    `OrderEventSource` 구현체만 교체하면 됩니다.
    """

    def __init__(self, source: OrderEventSource, clusterer: OrderClusterer | None = None) -> None:
        self.source = source
        self.clusterer = clusterer or OrderClusterer()

    async def clusters(self) -> AsyncIterator[OrderCluster]:
        async for event in self.source:
            occurred_at = datetime.fromisoformat(event["occurred_at"])
            yield self.clusterer.add(event["order"], occurred_at)
