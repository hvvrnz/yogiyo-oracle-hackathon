from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Iterable


@dataclass(frozen=True)
class DispatchCandidate:
    rider_id: str
    display_name: str
    vehicle: str
    distance_km: float
    arrival_min: int
    score: float

    def as_dict(self) -> dict[str, Any]:
        return {
            "rider_id": self.rider_id,
            "display_name": self.display_name,
            "vehicle": self.vehicle,
            "distance_km": self.distance_km,
            "arrival_min": self.arrival_min,
            "score": self.score,
        }


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """WGS84 위경도 두 점의 대권거리(km)를 계산합니다."""
    radius_km = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lng2 - lng1)
    value = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    return radius_km * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


class DispatchEngine:
    """Redis Geo 후보 검색 이후의 라이더 자동 재배차 점수화를 담당합니다.

    현재 POC는 메모리의 가상 라이더를 사용하지만, 입력 계약은 Redis Geo 검색
    결과로 교체할 수 있도록 rider/package/weather 딕셔너리만 받습니다.
    """

    def first_pending_pickup(self, package: dict[str, Any]) -> dict[str, Any] | None:
        return next(
            (step for step in package["steps"] if step["type"] == "PICKUP" and step["status"] != "COMPLETED"),
            None,
        )

    def candidate_metrics(
        self,
        rider: dict[str, Any],
        package: dict[str, Any],
        weather: dict[str, Any],
    ) -> dict[str, Any]:
        first_pickup = self.first_pending_pickup(package)
        if not first_pickup:
            return {"distance_km": 0.0, "arrival_min": 0, "score": 0.0}

        distance = haversine_km(
            float(rider["lat"]),
            float(rider["lng"]),
            float(first_pickup["lat"]),
            float(first_pickup["lng"]),
        )
        speed = max(10.0, float(rider.get("average_speed_kmh", 22)))
        weather_delay = float(weather.get("travel_delay_min", 0)) * 0.25
        arrival_min = max(1, math.ceil(distance / speed * 60 + weather_delay))

        # 가까운 도착시간을 최우선으로 하되 거리와 최근 거절 페널티를 반영합니다.
        rejection_penalty = float(rider.get("recent_rejection_count", 0)) * 0.7
        score = arrival_min + distance * 0.35 + rejection_penalty
        return {
            "distance_km": round(distance, 2),
            "arrival_min": arrival_min,
            "score": round(score, 3),
        }

    def rank_candidates(
        self,
        riders: Iterable[dict[str, Any]],
        package: dict[str, Any],
        weather: dict[str, Any],
    ) -> list[dict[str, Any]]:
        rejected = set(package.get("rejected_rider_ids", [])) | set(package.get("timed_out_rider_ids", []))
        candidates: list[DispatchCandidate] = []

        for rider in riders:
            rider_id = rider["rider_id"]
            if rider_id in rejected:
                continue
            if rider.get("assigned_package_id") not in {None, package["package_id"]}:
                continue
            if rider.get("status") not in {"AVAILABLE", "OFFERED"}:
                continue

            metrics = self.candidate_metrics(rider, package, weather)
            candidates.append(
                DispatchCandidate(
                    rider_id=rider_id,
                    display_name=rider["display_name"],
                    vehicle=rider.get("vehicle", "오토바이"),
                    **metrics,
                )
            )

        candidates.sort(key=lambda item: (item.score, item.arrival_min, item.rider_id))
        return [candidate.as_dict() for candidate in candidates]
