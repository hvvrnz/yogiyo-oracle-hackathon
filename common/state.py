from __future__ import annotations

import asyncio
import copy
import math
import os
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from common.config import settings
from common.dummy_data import DummyDataError, list_dummy_datasets, load_dummy_dataset, materialize_dummy_dataset
from sequencing_engine.dispatch import DispatchEngine
from sequencing_engine.optimizer import RouteOptimizer

SEOUL = ZoneInfo("Asia/Seoul")


def now_seoul() -> datetime:
    return datetime.now(SEOUL).replace(second=0, microsecond=0)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def hhmm(value: str | datetime | None) -> str:
    if value is None:
        return "-"
    dt = value if isinstance(value, datetime) else datetime.fromisoformat(value)
    return dt.astimezone(SEOUL).strftime("%H:%M")


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return the great-circle distance between two WGS84 points."""
    radius_km = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lng2 - lng1)
    value = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    return radius_km * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


@dataclass
class ActionResult:
    ok: bool
    message: str
    event_type: str | None = None


class DemoState:
    """In-memory state for the integrated hackathon demo.

    The UI and API contract are intentionally separated from future Kafka, Redis,
    Oracle AI Database and external API adapters. The demo is fully functional
    without credentials, while preserving the same role-specific data boundaries.
    """

    def __init__(self) -> None:
        self.lock = asyncio.Lock()
        self.dispatch_engine = DispatchEngine()
        self.route_optimizer = RouteOptimizer()
        self.version = 0
        self.active_dataset_id = settings.dummy_dataset
        self.dummy_dataset_meta: dict[str, Any] = {}
        self.route_blueprints: dict[str, list[dict[str, Any]]] = {}
        self.strategy_profiles: dict[str, dict[str, Any]] = {}
        self.customers: dict[str, dict[str, Any]] = {}
        self.reset()

    def _route_blueprint(self, strategy: str) -> list[tuple[str, str, int, float, float, str]]:
        return self.route_optimizer.route_blueprint(
            strategy, self.stores, self.orders, getattr(self, "route_blueprints", {})
        )

    def _build_route_steps(self, strategy: str, base: datetime) -> list[dict[str, Any]]:
        return self.route_optimizer.build_route_steps(
            strategy, base, self.stores, self.orders, getattr(self, "route_blueprints", {})
        )

    def _strategy_profile(self, strategy: str) -> dict[str, Any]:
        return self.route_optimizer.strategy_profile(
            strategy, getattr(self, "strategy_profiles", {})
        )

    def _apply_strategy_profile(self, package: dict[str, Any], strategy: str) -> None:
        self.route_optimizer.apply_strategy_profile(
            package, strategy, self.orders, getattr(self, "strategy_profiles", {})
        )

    def _sync_delivery_estimates_from_steps(self, package: dict[str, Any]) -> None:
        self.route_optimizer.sync_delivery_estimates(package, self.orders)

    def _load_dummy_state(self, dataset_id: str, base: datetime) -> bool:
        try:
            source = load_dummy_dataset(dataset_id)
            payload = materialize_dummy_dataset(source, base)
        except DummyDataError as exc:
            self.dummy_dataset_meta = {
                "dataset_id": "legacy",
                "name": "내장 기본 데이터",
                "description": "더미 데이터 로딩에 실패해 기존 내장 상태를 사용합니다.",
                "load_error": str(exc),
            }
            return False

        self.active_dataset_id = payload["metadata"]["dataset_id"]
        self.dummy_dataset_meta = payload["metadata"]
        self.simulation = payload["simulation"]
        self.weather = payload["weather"]
        self.stores = payload["stores"]
        self.customers = payload["customers"]
        self.orders = payload["orders"]
        self.riders = payload["riders"]
        self.route_blueprints = payload["route_blueprints"]
        self.strategy_profiles = payload["strategy_profiles"]
        for order in self.orders.values():
            order["status_label"] = self._order_status_label(order["status"])
        package = payload["package"]
        strategy = package["route_strategy"]
        package["steps"] = self._build_route_steps(strategy, base)
        self.packages = {package["package_id"]: package}
        self._sync_delivery_estimates_from_steps(package)
        self.events = []
        self._initialize_dispatch(package, package.get("offered_rider_id") or "R-001")
        self._append_event(
            "dummy.dataset.loaded",
            f"가상 데이터 세트 '{self.dummy_dataset_meta['name']}'을 불러왔습니다.",
            {"package_id": package["package_id"], "dataset_id": self.active_dataset_id},
        )
        offered = self.riders.get(package.get("offered_rider_id"), {})
        self._append_event(
            "package.offered",
            f"{package['bundle_size']}건 묶음배달이 {offered.get('display_name', '라이더')}에게 제안되었습니다.",
            {"package_id": package["package_id"], "rider_id": package.get("offered_rider_id"), "offer_attempt": 1},
        )
        return True

    def reset(self, dataset_id: str | None = None) -> None:
        base = now_seoul()
        self.version += 1
        selected_dataset = dataset_id or getattr(self, "active_dataset_id", None) or os.getenv("DUMMY_DATASET", "balanced")
        if self._load_dummy_state(selected_dataset, base):
            return
        self.active_dataset_id = "legacy"
        self.route_blueprints = {}
        self.strategy_profiles = {}
        self.customers = {}
        self.simulation = {
            "running": False,
            "speed": 1,
            "sim_time": iso(base),
            "scenario": "AI 3건 묶음배달",
            "rider_progress": 0.18,
        }
        self.weather = {
            "condition": "RAIN",
            "label": "비",
            "temperature_c": 27,
            "precipitation_mm": 3.5,
            "wind_speed_mps": 2.8,
            "travel_delay_min": 3,
            "advisory": "비로 인해 이동시간이 평소보다 약 3분 늘어날 수 있어요.",
            "source": "기상청 API 연동 예정 · 현재 시연용 데이터",
        }
        self.stores = {
            "S-001": {
                "store_id": "S-001",
                "name": "낭만치킨 역삼점",
                "category": "치킨",
                "address": "서울 강남구 테헤란로 인근",
                "lat": 37.5009,
                "lng": 127.0364,
                "open": True,
                "congestion": "보통",
                "base_cooking_min": 22,
                "correction_factor": 0.94,
                "prediction_accuracy_pct": 89,
            },
            "S-002": {
                "store_id": "S-002",
                "name": "젊음버거 선릉점",
                "category": "버거",
                "address": "서울 강남구 선릉로 인근",
                "lat": 37.5037,
                "lng": 127.0410,
                "open": True,
                "congestion": "혼잡",
                "base_cooking_min": 17,
                "correction_factor": 1.08,
                "prediction_accuracy_pct": 86,
            },
            "S-003": {
                "store_id": "S-003",
                "name": "사랑한식 삼성점",
                "category": "한식",
                "address": "서울 강남구 삼성로 인근",
                "lat": 37.5061,
                "lng": 127.0473,
                "open": True,
                "congestion": "여유",
                "base_cooking_min": 19,
                "correction_factor": 0.98,
                "prediction_accuracy_pct": 91,
            },
        }
        ready_times = {
            "O-001": base + timedelta(minutes=7),
            "O-002": base + timedelta(minutes=9),
            "O-003": base + timedelta(minutes=11),
        }
        self.orders = {
            "O-001": {
                "order_id": "O-001",
                "customer_id": "C-001",
                "store_id": "S-001",
                "package_id": "PKG-001",
                "created_at": iso(base - timedelta(minutes=15)),
                "status": "COOKING",
                "status_label": "조리 중",
                "menu_summary": "후라이드치킨 외 1개",
                "items": [
                    {"name": "후라이드치킨", "quantity": 1},
                    {"name": "콜라 1.25L", "quantity": 1},
                ],
                "amount": 23900,
                "delivery_address": "서울 강남구 역삼동 고객 주소",
                "delivery_area": "역삼동 인근",
                "lat": 37.4974,
                "lng": 127.0411,
                "predicted_cooking_min": 22,
                "predicted_ready_at": iso(ready_times["O-001"]),
                "target_ready_at": iso(ready_times["O-001"]),
                "recommended_start_at": iso(base - timedelta(minutes=15)),
                "actual_ready_at": None,
                "picked_up_at": None,
                "delivered_at": None,
                "eta_start": iso(base + timedelta(minutes=25)),
                "eta_end": iso(base + timedelta(minutes=31)),
                "delivery_sequence": 2,
                "bag_time_min": 9,
                "bag_time_limit_min": 12,
                "food_sitting_min": 2,
                "quality_guard_passed": True,
                "request_note": "문 앞에 놓아주세요.",
            },
            "O-002": {
                "order_id": "O-002",
                "customer_id": "C-002",
                "store_id": "S-002",
                "package_id": "PKG-001",
                "created_at": iso(base - timedelta(minutes=13)),
                "status": "COOKING",
                "status_label": "조리 중",
                "menu_summary": "클래식버거 세트",
                "items": [{"name": "클래식버거 세트", "quantity": 1}],
                "amount": 14900,
                "delivery_address": "서울 강남구 선릉동 고객 주소",
                "delivery_area": "선릉동 인근",
                "lat": 37.5014,
                "lng": 127.0446,
                "predicted_cooking_min": 18,
                "predicted_ready_at": iso(ready_times["O-002"]),
                "target_ready_at": iso(ready_times["O-002"]),
                "recommended_start_at": iso(base - timedelta(minutes=9)),
                "actual_ready_at": None,
                "picked_up_at": None,
                "delivered_at": None,
                "eta_start": iso(base + timedelta(minutes=19)),
                "eta_end": iso(base + timedelta(minutes=24)),
                "delivery_sequence": 1,
                "bag_time_min": 7,
                "bag_time_limit_min": 12,
                "food_sitting_min": 1,
                "quality_guard_passed": True,
                "request_note": "벨을 누르지 말아주세요.",
            },
            "O-003": {
                "order_id": "O-003",
                "customer_id": "C-003",
                "store_id": "S-003",
                "package_id": "PKG-001",
                "created_at": iso(base - timedelta(minutes=12)),
                "status": "READY",
                "status_label": "조리 완료",
                "menu_summary": "제육볶음 도시락 외 1개",
                "items": [
                    {"name": "제육볶음 도시락", "quantity": 1},
                    {"name": "계란말이", "quantity": 1},
                ],
                "amount": 18500,
                "delivery_address": "서울 강남구 삼성동 고객 주소",
                "delivery_area": "삼성동 인근",
                "lat": 37.5083,
                "lng": 127.0518,
                "predicted_cooking_min": 19,
                "predicted_ready_at": iso(ready_times["O-003"]),
                "target_ready_at": iso(ready_times["O-003"]),
                "recommended_start_at": iso(base - timedelta(minutes=8)),
                "actual_ready_at": iso(base - timedelta(minutes=1)),
                "picked_up_at": None,
                "delivered_at": None,
                "eta_start": iso(base + timedelta(minutes=31)),
                "eta_end": iso(base + timedelta(minutes=37)),
                "delivery_sequence": 3,
                "bag_time_min": 10,
                "bag_time_limit_min": 14,
                "food_sitting_min": 3,
                "quality_guard_passed": True,
                "request_note": "경비실에 맡겨주세요.",
            },
        }
        self.riders = {
            "R-001": {"rider_id": "R-001", "display_name": "라이더 01", "status": "AVAILABLE", "status_label": "배차 대기", "lat": 37.4991, "lng": 127.0312, "location_updated_at": iso(base), "assigned_package_id": None, "vehicle": "오토바이", "average_speed_kmh": 23},
            "R-002": {"rider_id": "R-002", "display_name": "라이더 02", "status": "AVAILABLE", "status_label": "배차 대기", "lat": 37.4978, "lng": 127.0299, "location_updated_at": iso(base), "assigned_package_id": None, "vehicle": "오토바이", "average_speed_kmh": 22},
            "R-003": {"rider_id": "R-003", "display_name": "라이더 03", "status": "AVAILABLE", "status_label": "배차 대기", "lat": 37.5047, "lng": 127.0324, "location_updated_at": iso(base), "assigned_package_id": None, "vehicle": "전기자전거", "average_speed_kmh": 20},
            "R-004": {"rider_id": "R-004", "display_name": "라이더 04", "status": "AVAILABLE", "status_label": "배차 대기", "lat": 37.4949, "lng": 127.0406, "location_updated_at": iso(base), "assigned_package_id": None, "vehicle": "오토바이", "average_speed_kmh": 21},
        }
        steps = self._build_route_steps("optimized", base)
        self.packages = {
            "PKG-001": {
                "package_id": "PKG-001",
                "status": "OFFERED",
                "status_label": "라이더 제안 중",
                "order_ids": ["O-001", "O-002", "O-003"],
                "rider_id": None,
                "offered_rider_id": "R-001",
                "auto_reassign_enabled": True,
                "offer_timeout_sec": 30,
                "bundle_size": 3,
                "route_strategy": "optimized",
                "route_strategy_label": "혼합 최적화",
                "route_strategy_description": "조리 완료시각과 품질 제한을 고려해 픽업과 배달을 섞어 이동합니다.",
                "ready_gap_min": 4,
                "ready_times": [hhmm(ready_times[key]) for key in ["O-001", "O-002", "O-003"]],
                "route_overlap_pct": 82,
                "extra_distance_km": 0.7,
                "extra_duration_min": 3,
                "candidate_route_count": 90,
                "estimated_duration_min": 18,
                "total_distance_km": 4.2,
                "total_wait_min": 1,
                "package_revenue": 7500,
                "hourly_revenue": 25000,
                "eta_confidence_pct": 92,
                "quality_guard_passed": True,
                "eta_guard_passed": True,
                "promise_eta_preserved": True,
                "reroute_enabled": True,
                "fallback_when_late": "묶음 해제 후 재배차",
                "selected_route_reason": "조리 완료 시각이 가깝고 이동 방향이 겹치는 경로",
                "route_changed": False,
                "route_change_note": None,
                "current_step_index": 0,
                "steps": steps,
            }
        }
        self.events: list[dict[str, Any]] = []
        self._initialize_dispatch(self.packages["PKG-001"], "R-001")
        self._append_event(
            "package.offered",
            "3건 묶음배달이 라이더 01에게 제안되었습니다.",
            {"package_id": "PKG-001", "rider_id": "R-001", "offer_attempt": 1},
        )

    def _append_event(self, event_type: str, message: str, data: dict[str, Any] | None = None) -> None:
        self.version += 1
        self.events.insert(
            0,
            {
                "event_id": f"EVT-{self.version:05d}",
                "version": self.version,
                "type": event_type,
                "message": message,
                "occurred_at": iso(datetime.now(SEOUL)),
                "data": data or {},
            },
        )
        self.events = self.events[:100]

    def _store_orders(self, store_id: str) -> list[dict[str, Any]]:
        return [order for order in self.orders.values() if order["store_id"] == store_id]

    def _package(self, package_id: str = "PKG-001") -> dict[str, Any]:
        return self.packages[package_id]

    def _first_pending_pickup(self, package: dict[str, Any]) -> dict[str, Any] | None:
        return self.dispatch_engine.first_pending_pickup(package)

    def _candidate_metrics(self, rider: dict[str, Any], package: dict[str, Any]) -> dict[str, Any]:
        return self.dispatch_engine.candidate_metrics(rider, package, self.weather)

    def _rank_dispatch_candidates(self, package: dict[str, Any]) -> list[dict[str, Any]]:
        return self.dispatch_engine.rank_candidates(self.riders.values(), package, self.weather)

    def _initialize_dispatch(self, package: dict[str, Any], initial_rider_id: str) -> None:
        package["auto_reassign_enabled"] = settings.auto_reassign_enabled
        package["offer_timeout_sec"] = settings.rider_offer_timeout_sec
        package.setdefault("rejected_rider_ids", [])
        package.setdefault("timed_out_rider_ids", [])
        package.setdefault("offer_history", [])
        package.setdefault("offer_attempt", 0)
        package.setdefault("fallback_triggered", False)
        package.setdefault("reassignment_note", None)
        package["candidate_rider_ids"] = list(self.riders)
        if initial_rider_id not in self.riders:
            ranked = self._rank_dispatch_candidates(package)
            initial_rider_id = ranked[0]["rider_id"] if ranked else ""
        if initial_rider_id:
            self._offer_to_rider(package, initial_rider_id, initial=True)

    def _offer_to_rider(self, package: dict[str, Any], rider_id: str, *, initial: bool = False) -> None:
        for other in self.riders.values():
            if other.get("status") == "OFFERED" and other["rider_id"] != rider_id:
                other["status"] = "AVAILABLE"
                other["status_label"] = "배차 대기"
        rider = self.riders[rider_id]
        package["status"] = "OFFERED"
        package["status_label"] = "라이더 제안 중" if initial else "다음 라이더 제안 중"
        package["rider_id"] = None
        package["offered_rider_id"] = rider_id
        package["offer_attempt"] = 1 if initial else int(package.get("offer_attempt", 0)) + 1
        offered_at = datetime.now(SEOUL)
        package["offered_at"] = iso(offered_at)
        package["offer_expires_at"] = iso(offered_at + timedelta(seconds=int(package.get("offer_timeout_sec", 30))))
        package["reassignment_status"] = "OFFERED"
        package["fallback_triggered"] = False
        rider["status"] = "OFFERED"
        rider["status_label"] = "배차 제안 확인"
        rider["assigned_package_id"] = None
        metrics = self._candidate_metrics(rider, package)
        package["offer_history"].append(
            {
                "attempt": package["offer_attempt"],
                "rider_id": rider_id,
                "rider_name": rider["display_name"],
                "status": "OFFERED",
                "offered_at": package["offered_at"],
                **metrics,
            }
        )
        package["reassignment_note"] = (
            f"{rider['display_name']}에게 첫 배차를 제안했습니다."
            if initial
            else f"다음 후보인 {rider['display_name']}에게 자동으로 배차를 제안했습니다."
        )

    def _offer_next_candidate(self, package: dict[str, Any]) -> dict[str, Any] | None:
        ranked = self._rank_dispatch_candidates(package)
        if not ranked:
            package["status"] = "NO_RIDER_AVAILABLE"
            package["status_label"] = "배차 후보 소진"
            package["offered_rider_id"] = None
            package["reassignment_status"] = "FAILED"
            package["fallback_triggered"] = True
            package["reassignment_note"] = "배차 가능한 후보가 없어 단건 배차 또는 탐색 반경 확대가 필요합니다."
            return None
        candidate = ranked[0]
        self._offer_to_rider(package, candidate["rider_id"], initial=False)
        return candidate

    def _active_rider(self, package: dict[str, Any]) -> dict[str, Any]:
        rider_id = package.get("rider_id") or package.get("offered_rider_id")
        if rider_id and rider_id in self.riders:
            return self.riders[rider_id]
        return next(iter(self.riders.values()))

    def _current_step(self, package: dict[str, Any]) -> dict[str, Any] | None:
        index = package["current_step_index"]
        if index >= len(package["steps"]):
            return None
        return package["steps"][index]

    def _order_status_label(self, status: str) -> str:
        return {
            "NEW": "신규 주문",
            "ACCEPTED": "주문 수락",
            "COOKING": "조리 중",
            "DELAYED": "조리 지연",
            "READY": "조리 완료",
            "PICKED_UP": "픽업 완료",
            "DELIVERING": "배달 중",
            "DELIVERED": "배달 완료",
            "CANCELLED": "주문 취소",
        }.get(status, status)

    def _rider_arrival_for_store(self, store_id: str) -> tuple[str | None, int | None, str]:
        package = self._package()
        store_order_ids = {o["order_id"] for o in self._store_orders(store_id)}
        for step in package["steps"]:
            if step["type"] == "PICKUP" and step["order_id"] in store_order_ids and step["status"] != "COMPLETED":
                eta_dt = datetime.fromisoformat(step["eta"])
                sim_dt = datetime.fromisoformat(self.simulation["sim_time"])
                remaining = max(0, math.ceil((eta_dt - sim_dt).total_seconds() / 60))
                current = self._current_step(package)
                context = (
                    f"현재 {package.get('offer_attempt', 1)}번째 라이더에게 배차를 제안 중입니다."
                    if package["status"] == "OFFERED"
                    else "현재 배차 제안을 확인 중입니다."
                )
                if package["status"] in {"ASSIGNED", "IN_PROGRESS"} and current:
                    context = f"현재 {current['label']} 단계입니다."
                return step["eta"], remaining, context
        return None, None, "해당 매장 픽업이 완료되었습니다."

    def _eta_window(self, order: dict[str, Any]) -> str:
        return f"{hhmm(order['eta_start'])}~{hhmm(order['eta_end'])}"

    def snapshot(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "dummy_dataset": {
                **copy.deepcopy(self.dummy_dataset_meta),
                "available": list_dummy_datasets(),
            },
            "simulation": copy.deepcopy(self.simulation),
            "weather": copy.deepcopy(self.weather),
            "stores": copy.deepcopy(self.stores),
            "orders": copy.deepcopy(self.orders),
            "riders": copy.deepcopy(self.riders),
            "packages": copy.deepcopy(self.packages),
            "events": copy.deepcopy(self.events),
        }

    def customer_view(self, customer_id: str) -> dict[str, Any]:
        order = next((item for item in self.orders.values() if item["customer_id"] == customer_id), None)
        if not order:
            raise KeyError("customer not found")
        store = self.stores[order["store_id"]]
        package = self.packages[order["package_id"]]
        rider = self._active_rider(package)
        current_step = self._current_step(package)
        progress_order = ["NEW", "ACCEPTED", "COOKING", "READY", "PICKED_UP", "DELIVERING", "DELIVERED"]
        normalized = "DELIVERING" if order["status"] == "PICKED_UP" else order["status"]
        try:
            progress_index = progress_order.index(normalized)
        except ValueError:
            progress_index = 2
        current_message = {
            "COOKING": "매장에서 음식을 준비하고 있어요.",
            "DELAYED": "조리 상황을 반영해 도착시간을 다시 계산했어요.",
            "READY": "음식이 준비되어 라이더 픽업을 기다리고 있어요.",
            "PICKED_UP": "음식이 라이더에게 전달되었어요.",
            "DELIVERING": "라이더가 고객님께 이동하고 있어요.",
            "DELIVERED": "배달이 완료되었어요.",
        }.get(order["status"], "주문을 확인하고 있어요.")
        if package["status"] == "OFFERED":
            if package.get("offer_attempt", 1) > 1:
                current_message = "첫 라이더의 거절로 다음 라이더에게 자동 재배차 중이에요."
            else:
                current_message = "효율적인 묶음 경로에 맞는 라이더를 찾고 있어요."
        elif package["status"] == "NO_RIDER_AVAILABLE":
            current_message = "배차 범위를 넓혀 새로운 라이더를 찾고 있어요."
        elif package["status"] == "ASSIGNED" and current_step:
            current_message = f"라이더가 {current_step['label']}을 진행하고 있어요."
        return {
            "version": self.version,
            "customer_id": customer_id,
            "order": {
                **copy.deepcopy(order),
                "eta_window": self._eta_window(order),
                "eta_updated_label": f"{hhmm(self.simulation['sim_time'])} 기준",
                "status_label": self._order_status_label(order["status"]),
                "current_message": current_message,
                "remaining_min": max(
                    0,
                    math.ceil(
                        (
                            datetime.fromisoformat(order["eta_start"])
                            - datetime.fromisoformat(self.simulation["sim_time"])
                        ).total_seconds()
                        / 60
                    ),
                ),
                "progress_index": progress_index,
                "quality_margin_min": order["bag_time_limit_min"] - order["bag_time_min"],
            },
            "store": {
                "store_id": store["store_id"],
                "name": store["name"],
                "category": store["category"],
                "lat": store["lat"],
                "lng": store["lng"],
            },
            "package": {
                "package_id": package["package_id"],
                "status": package["status"],
                "bundle_size": package["bundle_size"],
                "route_strategy": package["route_strategy"],
                "route_strategy_label": package["route_strategy_label"],
                "route_strategy_description": package["route_strategy_description"],
                "ready_gap_min": package["ready_gap_min"],
                "route_overlap_pct": package["route_overlap_pct"],
                "extra_distance_km": package["extra_distance_km"],
                "extra_duration_min": package["extra_duration_min"],
                "candidate_route_count": package["candidate_route_count"],
                "eta_confidence_pct": package["eta_confidence_pct"],
                "quality_guard_passed": order["quality_guard_passed"],
                "eta_guard_passed": package["eta_guard_passed"],
                "route_changed": package["route_changed"],
                "route_change_note": package["route_change_note"],
                "offer_attempt": package.get("offer_attempt", 0),
                "reassignment_note": package.get("reassignment_note"),
                "privacy_note": "다른 주문자의 상세 주소와 메뉴는 표시하지 않습니다.",
            },
            "rider": {
                "assigned": bool(package.get("rider_id")) and package["status"] in {"ASSIGNED", "IN_PROGRESS", "COMPLETED"},
                "display_name": rider["display_name"] if package.get("rider_id") else None,
                "status_label": rider["status_label"],
                "lat": rider["lat"],
                "lng": rider["lng"],
                "location_updated_at": rider["location_updated_at"],
                "current_step_label": (
                    current_step["label"]
                    if current_step and package.get("rider_id")
                    else "배차 제안 중"
                    if package["status"] == "OFFERED"
                    else "새 라이더 탐색 중"
                    if package["status"] == "NO_RIDER_AVAILABLE"
                    else "모든 배달 완료"
                ),
            },
            "route": self._anonymized_route_for_customer(order["order_id"]),
            "weather": copy.deepcopy(self.weather),
            "events": [event for event in self.events if self._event_visible_to_customer(event, order)],
        }

    def _anonymized_route_for_customer(self, own_order_id: str) -> list[dict[str, Any]]:
        package = self._package()
        result = []
        for step in package["steps"]:
            is_own = step["order_id"] == own_order_id
            label = step["label"] if is_own else ("다른 매장 픽업" if step["type"] == "PICKUP" else "다른 배달지")
            result.append(
                {
                    "sequence": step["sequence"],
                    "type": step["type"],
                    "label": label,
                    "eta": hhmm(step["eta"]),
                    "status": step["status"],
                    "lat": step["lat"] if is_own else round(step["lat"], 3),
                    "lng": step["lng"] if is_own else round(step["lng"], 3),
                    "is_own": is_own,
                }
            )
        return result

    def _event_visible_to_customer(self, event: dict[str, Any], order: dict[str, Any]) -> bool:
        data = event.get("data", {})
        return not data.get("order_id") or data.get("order_id") == order["order_id"] or data.get("package_id") == order["package_id"]

    def merchant_view(self, store_id: str) -> dict[str, Any]:
        if store_id not in self.stores:
            raise KeyError("store not found")
        store = self.stores[store_id]
        orders = self._store_orders(store_id)
        eta, remaining, rider_context = self._rider_arrival_for_store(store_id)
        enhanced_orders = []
        for order in orders:
            predicted = datetime.fromisoformat(order["predicted_ready_at"])
            rider_dt = datetime.fromisoformat(eta) if eta else predicted
            wait_min = max(0, math.ceil((rider_dt - predicted).total_seconds() / 60))
            start_dt = datetime.fromisoformat(order["recommended_start_at"])
            sim_dt = datetime.fromisoformat(self.simulation["sim_time"])
            start_delta = math.ceil((start_dt - sim_dt).total_seconds() / 60)
            if order["status"] in {"READY", "PICKED_UP", "DELIVERED"}:
                start_recommendation = "조리가 완료된 주문입니다."
            elif start_delta <= 0:
                start_recommendation = "지금 조리를 진행해 주세요."
            else:
                start_recommendation = f"약 {start_delta}분 후 조리를 시작해도 괜찮아요."
            enhanced_orders.append(
                {
                    **copy.deepcopy(order),
                    "status_label": self._order_status_label(order["status"]),
                    "predicted_ready_label": hhmm(order["predicted_ready_at"]),
                    "target_ready_label": hhmm(order["target_ready_at"]),
                    "recommended_start_label": hhmm(order["recommended_start_at"]),
                    "start_recommendation": start_recommendation,
                    "expected_rider_wait_min": wait_min,
                    "prediction_confidence_pct": store["prediction_accuracy_pct"],
                }
            )
        summary = {
            "new_count": sum(1 for o in orders if o["status"] == "NEW"),
            "cooking_count": sum(1 for o in orders if o["status"] in {"ACCEPTED", "COOKING", "DELAYED"}),
            "ready_count": sum(1 for o in orders if o["status"] == "READY"),
            "average_delay_min": 2 if store_id == "S-002" else 0,
        }
        package = self._package()
        return {
            "version": self.version,
            "store": copy.deepcopy(store),
            "summary": summary,
            "orders": enhanced_orders,
            "rider": {
                "assigned": bool(package.get("rider_id")) and package["status"] in {"ASSIGNED", "IN_PROGRESS", "COMPLETED"},
                "offered_rider_name": self._active_rider(package)["display_name"] if package.get("offered_rider_id") else None,
                "arrival_at": eta,
                "arrival_label": hhmm(eta),
                "remaining_min": remaining,
                "context": rider_context,
                "distance_km": round(0.7 + (remaining or 0) * 0.16, 1) if remaining is not None else None,
            },
            "package": {
                "package_id": package["package_id"],
                "status": package["status"],
                "status_label": package["status_label"],
                "bundle_size": package["bundle_size"],
                "route_strategy": package["route_strategy"],
                "route_strategy_label": package["route_strategy_label"],
                "route_strategy_description": package["route_strategy_description"],
                "ready_gap_min": package["ready_gap_min"],
                "total_wait_min": package["total_wait_min"],
                "selected_route_reason": package["selected_route_reason"],
                "route_changed": package["route_changed"],
                "route_change_note": package["route_change_note"],
                "offer_attempt": package.get("offer_attempt", 0),
                "reassignment_note": package.get("reassignment_note"),
            },
            "weather": copy.deepcopy(self.weather),
            "events": [event for event in self.events if self._event_visible_to_merchant(event, store_id)],
        }

    def _event_visible_to_merchant(self, event: dict[str, Any], store_id: str) -> bool:
        data = event.get("data", {})
        order_id = data.get("order_id")
        if order_id and order_id in self.orders:
            return self.orders[order_id]["store_id"] == store_id
        return bool(data.get("package_id")) or event["type"].startswith("weather")

    def rider_view(self, rider_id: str) -> dict[str, Any]:
        if rider_id not in self.riders:
            raise KeyError("rider not found")
        rider = self.riders[rider_id]
        package = self._package()
        accepted = package.get("rider_id") == rider_id and package["status"] in {"ASSIGNED", "IN_PROGRESS", "COMPLETED"}
        is_current_offer = package["status"] == "OFFERED" and package.get("offered_rider_id") == rider_id
        was_rejected = rider_id in package.get("rejected_rider_ids", [])
        offered_rider = self.riders.get(package.get("offered_rider_id", ""))
        steps = []
        for step in package["steps"]:
            order = self.orders[step["order_id"]]
            store = self.stores[order["store_id"]]
            if step["type"] == "PICKUP":
                destination = store["name"]
                address = store["address"]
                readiness = self._order_status_label(order["status"])
            else:
                destination = order["delivery_area"] if not accepted else order["delivery_address"]
                address = "배차 수락 후 상세 주소 공개" if not accepted else order["delivery_address"]
                readiness = "배달 예정"
            steps.append(
                {
                    **copy.deepcopy(step),
                    "eta_label": hhmm(step["eta"]),
                    "destination": destination,
                    "address": address,
                    "readiness": readiness,
                    "is_current": step["sequence"] - 1 == package["current_step_index"],
                }
            )
        store_readiness = []
        for order_id in package["order_ids"]:
            order = self.orders[order_id]
            store = self.stores[order["store_id"]]
            ready_dt = datetime.fromisoformat(order["predicted_ready_at"])
            sim_dt = datetime.fromisoformat(self.simulation["sim_time"])
            remaining = max(0, math.ceil((ready_dt - sim_dt).total_seconds() / 60))
            store_readiness.append(
                {
                    "store_name": store["name"],
                    "order_id": order_id,
                    "status": order["status"],
                    "status_label": self._order_status_label(order["status"]),
                    "ready_at": hhmm(order["predicted_ready_at"]),
                    "remaining_min": remaining,
                }
            )
        ranked = self._rank_dispatch_candidates(package)
        return {
            "version": self.version,
            "rider": {
                **copy.deepcopy(rider),
                "is_current_offer": is_current_offer,
                "was_rejected": was_rejected,
            },
            "package": {
                **{key: copy.deepcopy(value) for key, value in package.items() if key != "steps"},
                "accepted": accepted,
                "can_accept": is_current_offer,
                "can_reject": is_current_offer,
                "was_rejected": was_rejected,
                "offered_rider_name": offered_rider["display_name"] if offered_rider else None,
                "remaining_candidate_count": len(ranked),
                "current_step": copy.deepcopy(self._current_step(package)),
                "efficiency_reason": [
                    f"세 주문의 조리 완료 예상 시각 차이가 {package['ready_gap_min']}분이라 매장 대기가 짧아요.",
                    f"이동 경로가 {package['route_overlap_pct']}% 겹쳐 추가 이동거리가 약 {package['extra_distance_km']}km예요.",
                    f"추천 순서대로 이동하면 약 {package['estimated_duration_min']}분에 {package['bundle_size']}건을 완료할 수 있어요.",
                ],
            },
            "steps": steps,
            "store_readiness": store_readiness,
            "weather": copy.deepcopy(self.weather),
            "events": [event for event in self.events if event.get("data", {}).get("package_id") == package["package_id"] or event["type"].startswith("weather")],
        }

    async def merchant_action(self, order_id: str, action: str, delay_min: int = 0) -> ActionResult:
        async with self.lock:
            if order_id not in self.orders:
                return ActionResult(False, "주문을 찾을 수 없습니다.")
            order = self.orders[order_id]
            if action == "accept":
                order["status"] = "ACCEPTED"
                message = f"{order_id} 주문을 수락했습니다."
                event_type = "merchant.order.accepted"
            elif action == "start":
                order["status"] = "COOKING"
                message = f"{order_id} 조리를 시작했습니다."
                event_type = "merchant.cooking.started"
            elif action == "delay":
                delay_min = delay_min or 5
                self._apply_delay(order_id, delay_min)
                message = f"{order_id} 조리 지연 {delay_min}분을 반영했습니다."
                event_type = "merchant.order.delayed"
            elif action == "ready":
                order["status"] = "READY"
                order["actual_ready_at"] = self.simulation["sim_time"]
                message = f"{order_id} 조리 완료를 등록했습니다."
                event_type = "merchant.order.ready"
            else:
                return ActionResult(False, "지원하지 않는 작업입니다.")
            order["status_label"] = self._order_status_label(order["status"])
            self._append_event(event_type, message, {"order_id": order_id, "package_id": order["package_id"], "delay_min": delay_min})
            return ActionResult(True, message, event_type)

    def _apply_delay(self, order_id: str, delay_min: int) -> None:
        order = self.orders[order_id]
        order["status"] = "DELAYED"
        for field in ["predicted_ready_at", "target_ready_at", "eta_start", "eta_end"]:
            order[field] = iso(datetime.fromisoformat(order[field]) + timedelta(minutes=delay_min))
        package = self._package(order["package_id"])
        package["ready_gap_min"] += delay_min
        package["route_changed"] = True
        package["route_change_note"] = f"{self.stores[order['store_id']]['name']} 조리가 {delay_min}분 지연되어 방문 순서를 다시 계산했습니다."
        package["status_label"] = "경로 재계산 완료"
        package["total_wait_min"] = max(1, package["total_wait_min"] + max(0, delay_min - 5))
        # Shift unfinished route ETAs. A production system would fully rerun 90 valid routes.
        for step in package["steps"]:
            if step["status"] != "COMPLETED":
                step["eta"] = iso(datetime.fromisoformat(step["eta"]) + timedelta(minutes=max(1, delay_min // 2)))
        delayed_step_index = next(
            (i for i, step in enumerate(package["steps"]) if step["order_id"] == order_id and step["type"] == "PICKUP" and step["status"] != "COMPLETED"),
            None,
        )
        if package.get("route_strategy") == "pickup_first":
            # Keep every remaining pickup before the first remaining delivery.
            if delayed_step_index is not None:
                delayed_step = package["steps"].pop(delayed_step_index)
                last_pickup_index = max(
                    (i for i, candidate in enumerate(package["steps"]) if candidate["type"] == "PICKUP" and candidate["status"] != "COMPLETED"),
                    default=-1,
                )
                package["steps"].insert(last_pickup_index + 1, delayed_step)
        else:
            # In mixed optimization, a delayed pickup may move behind a delivery.
            delivery_index = next(
                (i for i, step in enumerate(package["steps"]) if step["type"] == "DELIVERY" and step["status"] != "COMPLETED" and step["order_id"] != order_id),
                None,
            )
            if delayed_step_index is not None and delivery_index is not None and delayed_step_index < delivery_index:
                delayed_step = package["steps"].pop(delayed_step_index)
                delivery_index = next(
                    i for i, candidate in enumerate(package["steps"]) if candidate["type"] == "DELIVERY" and candidate["status"] != "COMPLETED" and candidate["order_id"] != order_id
                )
                package["steps"].insert(delivery_index + 1, delayed_step)
        for idx, route_step in enumerate(package["steps"], start=1):
            route_step["sequence"] = idx
        self._sync_delivery_estimates_from_steps(package)

    async def set_route_strategy(self, strategy: str) -> ActionResult:
        async with self.lock:
            if strategy not in {"optimized", "pickup_first"}:
                return ActionResult(False, "지원하지 않는 경로 전략입니다.")
            package = self._package()
            if any(step["status"] == "COMPLETED" for step in package["steps"]):
                return ActionResult(False, "운행이 시작된 뒤에는 경로 전략을 바꿀 수 없습니다.")
            if package.get("route_strategy") == strategy:
                return ActionResult(True, f"이미 {package['route_strategy_label']} 전략을 사용 중입니다.", "package.route_strategy.unchanged")
            base = datetime.fromisoformat(self.simulation["sim_time"])
            package["steps"] = self._build_route_steps(strategy, base)
            package["current_step_index"] = 0
            self._apply_strategy_profile(package, strategy)
            self._sync_delivery_estimates_from_steps(package)
            package["route_changed"] = True
            package["route_change_note"] = f"경로 전략을 {package['route_strategy_label']} 방식으로 변경했습니다."
            self.simulation["rider_progress"] = 0.0
            message = package["route_change_note"]
            self._append_event(
                "package.route_strategy.updated",
                message,
                {"package_id": package["package_id"], "route_strategy": strategy},
            )
            return ActionResult(True, message, "package.route_strategy.updated")

    async def rider_action(self, rider_id: str, action: str) -> ActionResult:
        async with self.lock:
            if rider_id not in self.riders:
                return ActionResult(False, "라이더를 찾을 수 없습니다.")
            rider = self.riders[rider_id]
            package = self._package()
            if action == "accept":
                if package["status"] != "OFFERED" or package.get("offered_rider_id") != rider_id:
                    return ActionResult(False, "현재 이 라이더에게 제안된 배차가 아닙니다.")
                package["status"] = "ASSIGNED"
                package["status_label"] = "배차 수락"
                package["rider_id"] = rider_id
                package["offered_rider_id"] = None
                package["reassignment_status"] = "ASSIGNED"
                package["reassignment_note"] = f"{rider['display_name']}가 {package['offer_attempt']}번째 제안을 수락했습니다."
                rider["assigned_package_id"] = package["package_id"]
                rider["status"] = "ASSIGNED"
                rider["status_label"] = "배차 수행 중"
                if package.get("offer_history"):
                    package["offer_history"][-1]["status"] = "ACCEPTED"
                    package["offer_history"][-1]["responded_at"] = iso(datetime.now(SEOUL))
                event_type = "rider.package.accepted"
                message = f"{rider['display_name']}가 3건 묶음배달을 수락했습니다."
                self._append_event(event_type, message, {"rider_id": rider_id, "package_id": package["package_id"], "offer_attempt": package["offer_attempt"]})
                return ActionResult(True, message, event_type)
            if action == "reject":
                if package["status"] != "OFFERED" or package.get("offered_rider_id") != rider_id:
                    return ActionResult(False, "현재 이 라이더에게 제안된 배차가 아닙니다.")
                if rider_id not in package["rejected_rider_ids"]:
                    package["rejected_rider_ids"].append(rider_id)
                rider["status"] = "AVAILABLE"
                rider["status_label"] = "배차 대기"
                rider["last_rejected_package_id"] = package["package_id"]
                if package.get("offer_history"):
                    package["offer_history"][-1]["status"] = "REJECTED"
                    package["offer_history"][-1]["responded_at"] = iso(datetime.now(SEOUL))
                self._append_event(
                    "rider.package.rejected",
                    f"{rider['display_name']}가 배차를 거절했습니다.",
                    {"rider_id": rider_id, "package_id": package["package_id"], "offer_attempt": package["offer_attempt"]},
                )
                package["offered_rider_id"] = None
                if not package.get("auto_reassign_enabled", True):
                    package["status"] = "REJECTED_BY_RIDER"
                    package["status_label"] = "수동 재배차 대기"
                    package["reassignment_status"] = "PAUSED"
                    message = "배차를 거절했습니다. 자동 재배차가 비활성화되어 있습니다."
                    return ActionResult(True, message, "rider.package.rejected")
                next_candidate = self._offer_next_candidate(package)
                if next_candidate:
                    next_rider = self.riders[next_candidate["rider_id"]]
                    message = f"배차를 거절했습니다. {next_rider['display_name']}에게 자동으로 다음 배차를 제안했습니다."
                    self._append_event(
                        "package.reoffered",
                        f"{next_rider['display_name']}에게 {package['offer_attempt']}번째 배차 제안을 전송했습니다.",
                        {
                            "rider_id": next_rider["rider_id"],
                            "previous_rider_id": rider_id,
                            "package_id": package["package_id"],
                            "offer_attempt": package["offer_attempt"],
                            "arrival_min": next_candidate["arrival_min"],
                            "distance_km": next_candidate["distance_km"],
                        },
                    )
                    return ActionResult(True, message, "package.reoffered")
                message = "배차를 거절했습니다. 남은 후보가 없어 탐색 반경 확대 또는 단건 배차가 필요합니다."
                self._append_event(
                    "package.reassignment.failed",
                    message,
                    {"package_id": package["package_id"], "rejected_rider_ids": copy.deepcopy(package["rejected_rider_ids"])},
                )
                return ActionResult(True, message, "package.reassignment.failed")
            return ActionResult(False, "지원하지 않는 작업입니다.")

    async def complete_current_step(self, rider_id: str) -> ActionResult:
        async with self.lock:
            rider = self.riders.get(rider_id)
            if not rider:
                return ActionResult(False, "라이더를 찾을 수 없습니다.")
            package = self._package()
            if package["rider_id"] != rider_id:
                return ActionResult(False, "먼저 배차를 수락해 주세요.")
            step = self._current_step(package)
            if not step:
                return ActionResult(False, "완료할 단계가 없습니다.")
            step["status"] = "COMPLETED"
            order = self.orders[step["order_id"]]
            if step["type"] == "PICKUP":
                order["status"] = "PICKED_UP"
                order["picked_up_at"] = self.simulation["sim_time"]
                event_type = "rider.order.picked_up"
                message = f"{step['label']}을 완료했습니다."
            else:
                order["status"] = "DELIVERED"
                order["delivered_at"] = self.simulation["sim_time"]
                event_type = "order.delivered"
                message = f"{step['label']}을 완료했습니다."
            order["status_label"] = self._order_status_label(order["status"])
            package["current_step_index"] += 1
            self.simulation["rider_progress"] = 0.0
            next_step = self._current_step(package)
            if next_step:
                package["status"] = "IN_PROGRESS"
                package["status_label"] = "배달 수행 중"
            else:
                package["status"] = "COMPLETED"
                package["status_label"] = "3건 배달 완료"
                rider["status"] = "AVAILABLE"
                rider["status_label"] = "배차 대기"
                rider["assigned_package_id"] = None
                event_type = "package.completed"
                message = "3건 묶음배달을 모두 완료했습니다."
            self._append_event(event_type, message, {"order_id": order["order_id"], "package_id": package["package_id"], "step_id": step["step_id"]})
            return ActionResult(True, message, event_type)

    async def set_weather(self, condition: str) -> ActionResult:
        async with self.lock:
            if condition == "CLEAR":
                self.weather.update(
                    {
                        "condition": "CLEAR",
                        "label": "맑음",
                        "precipitation_mm": 0,
                        "travel_delay_min": 0,
                        "advisory": "현재 날씨로 인한 추가 이동 지연은 반영되지 않았어요.",
                    }
                )
            else:
                self.weather.update(
                    {
                        "condition": "RAIN",
                        "label": "비",
                        "precipitation_mm": 3.5,
                        "travel_delay_min": 3,
                        "advisory": "비로 인해 이동시간이 평소보다 약 3분 늘어날 수 있어요.",
                    }
                )
            message = f"날씨를 {self.weather['label']} 시나리오로 변경했습니다."
            self._append_event("weather.updated", message, {"condition": self.weather["condition"]})
            return ActionResult(True, message, "weather.updated")

    async def toggle_simulation(self, running: bool) -> ActionResult:
        async with self.lock:
            self.simulation["running"] = running
            message = "자동 위치 시뮬레이션을 시작했습니다." if running else "자동 위치 시뮬레이션을 일시정지했습니다."
            self._append_event("simulation.updated", message, {"running": running})
            return ActionResult(True, message, "simulation.updated")


    async def process_offer_timeout(self) -> ActionResult | None:
        """응답 기한이 지난 제안을 다음 후보에게 자동 재배차합니다."""
        async with self.lock:
            package = self._package()
            if package.get("status") != "OFFERED" or not package.get("offered_rider_id"):
                return None
            expires_at = package.get("offer_expires_at")
            if not expires_at or datetime.now(SEOUL) < datetime.fromisoformat(expires_at):
                return None

            rider_id = package["offered_rider_id"]
            rider = self.riders[rider_id]
            if rider_id not in package["timed_out_rider_ids"]:
                package["timed_out_rider_ids"].append(rider_id)
            rider["status"] = "AVAILABLE"
            rider["status_label"] = "배차 대기"
            if package.get("offer_history"):
                package["offer_history"][-1]["status"] = "TIMED_OUT"
                package["offer_history"][-1]["responded_at"] = iso(datetime.now(SEOUL))
            self._append_event(
                "rider.offer.timed_out",
                f"{rider['display_name']}가 제안 시간 안에 응답하지 않아 다음 후보를 찾습니다.",
                {"rider_id": rider_id, "package_id": package["package_id"], "offer_attempt": package["offer_attempt"]},
            )
            package["offered_rider_id"] = None

            if not package.get("auto_reassign_enabled", True):
                package["status"] = "REJECTED_BY_RIDER"
                package["status_label"] = "수동 재배차 대기"
                package["reassignment_status"] = "PAUSED"
                return ActionResult(True, "배차 제안 응답 시간이 만료됐습니다.", "rider.offer.timed_out")

            next_candidate = self._offer_next_candidate(package)
            if next_candidate:
                next_rider = self.riders[next_candidate["rider_id"]]
                message = f"응답 시간이 만료되어 {next_rider['display_name']}에게 자동으로 다음 배차를 제안했습니다."
                self._append_event(
                    "package.reoffered",
                    message,
                    {
                        "rider_id": next_rider["rider_id"],
                        "previous_rider_id": rider_id,
                        "package_id": package["package_id"],
                        "offer_attempt": package["offer_attempt"],
                        "reason": "TIMEOUT",
                    },
                )
                return ActionResult(True, message, "package.reoffered")

            message = "응답 가능한 라이더 후보가 없어 탐색 반경 확대 또는 단건 배차가 필요합니다."
            self._append_event(
                "package.reassignment.failed",
                message,
                {
                    "package_id": package["package_id"],
                    "rejected_rider_ids": copy.deepcopy(package["rejected_rider_ids"]),
                    "timed_out_rider_ids": copy.deepcopy(package["timed_out_rider_ids"]),
                },
            )
            return ActionResult(True, message, "package.reassignment.failed")

    async def tick(self, seconds: int = 2) -> None:
        async with self.lock:
            sim_dt = datetime.fromisoformat(self.simulation["sim_time"]) + timedelta(seconds=seconds * self.simulation["speed"])
            self.simulation["sim_time"] = iso(sim_dt)
            package = self._package()
            rider = self._active_rider(package)
            if package["status"] not in {"ASSIGNED", "IN_PROGRESS"}:
                return
            step = self._current_step(package)
            if not step:
                return
            progress = clamp(self.simulation["rider_progress"] + 0.025 * self.simulation["speed"], 0, 0.98)
            self.simulation["rider_progress"] = progress
            start_lat, start_lng = rider["lat"], rider["lng"]
            rider["lat"] = start_lat + (step["lat"] - start_lat) * 0.06
            rider["lng"] = start_lng + (step["lng"] - start_lng) * 0.06
            rider["location_updated_at"] = iso(datetime.now(SEOUL))
            self.version += 1

    async def demo_reset(self) -> ActionResult:
        async with self.lock:
            self.reset(self.active_dataset_id)
            return ActionResult(True, "현재 가상 데이터 세트를 초기 상태로 되돌렸습니다.", "demo.reset")

    async def set_dummy_dataset(self, dataset_id: str) -> ActionResult:
        async with self.lock:
            try:
                load_dummy_dataset(dataset_id)
            except DummyDataError as exc:
                return ActionResult(False, str(exc))
            self.reset(dataset_id)
            return ActionResult(
                True,
                f"가상 데이터 세트를 '{self.dummy_dataset_meta['name']}'으로 변경했습니다.",
                "dummy.dataset.changed",
            )

    async def demo_seed_new_order(self) -> ActionResult:
        async with self.lock:
            order = self.orders["O-001"]
            order["status"] = "NEW"
            order["status_label"] = "신규 주문"
            self._append_event("order.created", "낭만치킨에 신규 주문이 도착했습니다.", {"order_id": "O-001", "package_id": "PKG-001"})
            return ActionResult(True, "신규 주문 상태로 변경했습니다.", "order.created")

    async def demo_force_delay(self) -> ActionResult:
        return await self.merchant_action("O-002", "delay", 7)

    async def demo_force_accept(self) -> ActionResult:
        package = self._package()
        rider_id = package.get("offered_rider_id")
        if not rider_id:
            return ActionResult(False, "현재 제안 중인 라이더가 없습니다.")
        return await self.rider_action(rider_id, "accept")

    async def demo_force_reject(self) -> ActionResult:
        package = self._package()
        rider_id = package.get("offered_rider_id")
        if not rider_id:
            return ActionResult(False, "현재 제안 중인 라이더가 없습니다.")
        return await self.rider_action(rider_id, "reject")

    async def demo_force_timeout(self) -> ActionResult:
        async with self.lock:
            package = self._package()
            if package.get("status") != "OFFERED" or not package.get("offered_rider_id"):
                return ActionResult(False, "현재 만료시킬 배차 제안이 없습니다.")
            package["offer_expires_at"] = iso(datetime.now(SEOUL) - timedelta(seconds=1))
        result = await self.process_offer_timeout()
        return result or ActionResult(False, "배차 제안 만료를 처리하지 못했습니다.")

    async def demo_next(self) -> ActionResult:
        package = self._package()
        if package["status"] == "OFFERED":
            rider_id = package.get("offered_rider_id")
            if not rider_id:
                return ActionResult(False, "현재 제안 중인 라이더가 없습니다.")
            return await self.rider_action(rider_id, "accept")
        if package["status"] in {"ASSIGNED", "IN_PROGRESS"}:
            return await self.complete_current_step(package["rider_id"])
        if package["status"] == "COMPLETED":
            return await self.demo_reset()
        return await self.rider_action("R-001", "accept")
