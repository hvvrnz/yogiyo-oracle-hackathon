"""External-data adapter boundaries.

The running demo uses deterministic in-memory data. Replace these adapters with:
- Public Data Portal restaurant dataset/API
- Kakao Mobility Directions API
- Korea Meteorological Administration API
without changing role-screen contracts.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class RouteLeg:
    distance_km: float
    duration_min: int
    polyline: list[tuple[float, float]]


class RoutingProvider(Protocol):
    async def route(self, origin: tuple[float, float], destination: tuple[float, float]) -> RouteLeg: ...


class MockRoutingProvider:
    async def route(self, origin: tuple[float, float], destination: tuple[float, float]) -> RouteLeg:
        lat_gap = abs(origin[0] - destination[0])
        lng_gap = abs(origin[1] - destination[1])
        distance = round((lat_gap + lng_gap) * 87, 2)
        duration = max(2, round(distance / 0.35))
        polyline = [
            (origin[0] + (destination[0] - origin[0]) * ratio, origin[1] + (destination[1] - origin[1]) * ratio)
            for ratio in [0, 0.25, 0.5, 0.75, 1]
        ]
        return RouteLeg(distance_km=distance, duration_min=duration, polyline=polyline)


class RestaurantProvider(Protocol):
    async def list_restaurants(self) -> list[dict]: ...


class WeatherProvider(Protocol):
    async def current_weather(self, lat: float, lng: float) -> dict: ...
