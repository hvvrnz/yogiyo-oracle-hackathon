from __future__ import annotations

import copy
from datetime import datetime, timedelta
from typing import Any


def iso(dt: datetime) -> str:
    return dt.isoformat()


class RouteOptimizer:
    """해커톤 POC의 경로 전략과 화면용 지표를 생성합니다.

    프로덕션에서는 이 인터페이스 내부를 최대 3건 주문의 유효 순열 완전탐색과
    카카오모빌리티 구간 비용으로 교체할 수 있습니다.
    """

    def route_blueprint(
        self,
        strategy: str,
        stores: dict[str, dict[str, Any]],
        orders: dict[str, dict[str, Any]],
        custom_blueprints: dict[str, list[dict[str, Any]]] | None = None,
    ) -> list[tuple[str, str, int, float, float, str]]:
        custom = (custom_blueprints or {}).get(strategy)
        if custom:
            result: list[tuple[str, str, int, float, float, str]] = []
            for step in custom:
                order = orders[step["order_id"]]
                target = stores[order["store_id"]] if step["type"] == "PICKUP" else order
                result.append(
                    (
                        step["type"],
                        step["order_id"],
                        int(step["duration_min"]),
                        float(target["lat"]),
                        float(target["lng"]),
                        step["label"],
                    )
                )
            return result

        optimized = [
            ("PICKUP", "O-001", 4, stores["S-001"]["lat"], stores["S-001"]["lng"], "낭만치킨 픽업"),
            ("PICKUP", "O-002", 3, stores["S-002"]["lat"], stores["S-002"]["lng"], "젊음버거 픽업"),
            ("DELIVERY", "O-002", 6, orders["O-002"]["lat"], orders["O-002"]["lng"], "주문 B 배달"),
            ("PICKUP", "O-003", 4, stores["S-003"]["lat"], stores["S-003"]["lng"], "사랑한식 픽업"),
            ("DELIVERY", "O-001", 7, orders["O-001"]["lat"], orders["O-001"]["lng"], "고객님 주문 배달"),
            ("DELIVERY", "O-003", 6, orders["O-003"]["lat"], orders["O-003"]["lng"], "주문 C 배달"),
        ]
        pickup_first = [
            ("PICKUP", "O-001", 4, stores["S-001"]["lat"], stores["S-001"]["lng"], "낭만치킨 픽업"),
            ("PICKUP", "O-002", 3, stores["S-002"]["lat"], stores["S-002"]["lng"], "젊음버거 픽업"),
            ("PICKUP", "O-003", 4, stores["S-003"]["lat"], stores["S-003"]["lng"], "사랑한식 픽업"),
            ("DELIVERY", "O-002", 6, orders["O-002"]["lat"], orders["O-002"]["lng"], "주문 B 배달"),
            ("DELIVERY", "O-001", 7, orders["O-001"]["lat"], orders["O-001"]["lng"], "고객님 주문 배달"),
            ("DELIVERY", "O-003", 6, orders["O-003"]["lat"], orders["O-003"]["lng"], "주문 C 배달"),
        ]
        return pickup_first if strategy == "pickup_first" else optimized

    def build_route_steps(
        self,
        strategy: str,
        base: datetime,
        stores: dict[str, dict[str, Any]],
        orders: dict[str, dict[str, Any]],
        custom_blueprints: dict[str, list[dict[str, Any]]] | None = None,
    ) -> list[dict[str, Any]]:
        cursor = base + timedelta(minutes=4)
        steps: list[dict[str, Any]] = []
        blueprint = self.route_blueprint(strategy, stores, orders, custom_blueprints)
        for idx, (step_type, order_id, minutes, lat, lng, label) in enumerate(blueprint, start=1):
            cursor += timedelta(minutes=minutes)
            steps.append(
                {
                    "step_id": f"STEP-{idx:02d}",
                    "sequence": idx,
                    "type": step_type,
                    "order_id": order_id,
                    "status": "PENDING",
                    "eta": iso(cursor),
                    "duration_min": minutes,
                    "distance_km": round(0.45 + minutes * 0.12, 1),
                    "label": label,
                    "lat": lat,
                    "lng": lng,
                }
            )
        return steps

    def strategy_profile(
        self,
        strategy: str,
        custom_profiles: dict[str, dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        custom = (custom_profiles or {}).get(strategy)
        if custom:
            return copy.deepcopy(custom)
        if strategy == "pickup_first":
            return {
                "route_strategy": "pickup_first",
                "route_strategy_label": "전체 픽업 후 배달",
                "route_strategy_description": "세 매장의 음식을 모두 픽업한 뒤 고객에게 순서대로 배달합니다.",
                "estimated_duration_min": 21,
                "hourly_revenue": 21400,
                "total_distance_km": 4.6,
                "total_wait_min": 2,
                "route_overlap_pct": 78,
                "extra_distance_km": 1.1,
                "extra_duration_min": 5,
                "selected_route_reason": "모든 픽업을 먼저 완료해 픽업 흐름을 단순화한 경로",
                "bag_times": {"O-001": 11, "O-002": 8, "O-003": 13},
            }
        return {
            "route_strategy": "optimized",
            "route_strategy_label": "혼합 최적화",
            "route_strategy_description": "조리 완료시각과 품질 제한을 고려해 픽업과 배달을 섞어 이동합니다.",
            "estimated_duration_min": 18,
            "hourly_revenue": 25000,
            "total_distance_km": 4.2,
            "total_wait_min": 1,
            "route_overlap_pct": 82,
            "extra_distance_km": 0.7,
            "extra_duration_min": 3,
            "selected_route_reason": "조리 완료 시각이 가깝고 이동 방향이 겹치는 경로",
            "bag_times": {"O-001": 9, "O-002": 7, "O-003": 10},
        }

    def apply_strategy_profile(
        self,
        package: dict[str, Any],
        strategy: str,
        orders: dict[str, dict[str, Any]],
        custom_profiles: dict[str, dict[str, Any]] | None = None,
    ) -> None:
        profile = self.strategy_profile(strategy, custom_profiles)
        bag_times = profile.pop("bag_times")
        package.update(profile)
        for order_id, bag_time in bag_times.items():
            order = orders[order_id]
            order["bag_time_min"] = bag_time
            order["quality_guard_passed"] = bag_time <= order["bag_time_limit_min"]
        package["quality_guard_passed"] = all(orders[order_id]["quality_guard_passed"] for order_id in package["order_ids"])

    def sync_delivery_estimates(
        self,
        package: dict[str, Any],
        orders: dict[str, dict[str, Any]],
    ) -> None:
        deliveries = [step for step in package["steps"] if step["type"] == "DELIVERY"]
        for delivery_sequence, step in enumerate(deliveries, start=1):
            order = orders[step["order_id"]]
            eta = datetime.fromisoformat(step["eta"])
            order["delivery_sequence"] = delivery_sequence
            order["eta_start"] = iso(eta - timedelta(minutes=2))
            order["eta_end"] = iso(eta + timedelta(minutes=4))
