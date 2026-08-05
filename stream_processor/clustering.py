from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any


@dataclass
class OrderCluster:
    cluster_id: str
    created_at: datetime
    orders: list[dict[str, Any]] = field(default_factory=list)


class OrderClusterer:
    """30초 주문 윈도우와 최대 3건 제한을 표현한 경량 클러스터러입니다.

    실제 운영에서는 Kafka Consumer가 이 클래스를 호출하고, 위치 반경·조리시간
    편차 조건을 함께 적용하도록 확장합니다.
    """

    def __init__(self, window_seconds: int = 30, max_orders: int = 3) -> None:
        self.window = timedelta(seconds=window_seconds)
        self.max_orders = max_orders
        self._clusters: list[OrderCluster] = []

    def add(self, order: dict[str, Any], occurred_at: datetime) -> OrderCluster:
        candidate = next(
            (
                cluster
                for cluster in reversed(self._clusters)
                if occurred_at - cluster.created_at <= self.window and len(cluster.orders) < self.max_orders
            ),
            None,
        )
        if candidate is None:
            candidate = OrderCluster(
                cluster_id=f"CLUSTER-{len(self._clusters) + 1:04d}",
                created_at=occurred_at,
            )
            self._clusters.append(candidate)
        candidate.orders.append(order)
        return candidate
