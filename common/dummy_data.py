"""Load and materialize deterministic dummy datasets for the demo state."""
from __future__ import annotations

import copy
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SCENARIO_DIR = PROJECT_ROOT / "data" / "dummy" / "scenarios"


class DummyDataError(ValueError):
    pass


def list_dummy_datasets() -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    if not SCENARIO_DIR.exists():
        return result
    for path in sorted(SCENARIO_DIR.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        result.append(
            {
                "dataset_id": data.get("dataset_id", path.stem),
                "name": data.get("name", path.stem),
                "description": data.get("description", ""),
                "seed": data.get("seed"),
                "default_strategy": data.get("package", {}).get("default_strategy", "optimized"),
                "weather": data.get("weather", {}).get("condition", "CLEAR"),
            }
        )
    return result


def load_dummy_dataset(dataset_id: str) -> dict[str, Any]:
    safe_id = dataset_id.strip().lower().replace("-", "_")
    if not safe_id or any(char not in "abcdefghijklmnopqrstuvwxyz0123456789_" for char in safe_id):
        raise DummyDataError("잘못된 더미 데이터 세트 ID입니다.")
    path = SCENARIO_DIR / f"{safe_id}.json"
    if not path.exists():
        raise DummyDataError(f"더미 데이터 세트를 찾을 수 없습니다: {safe_id}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise DummyDataError(f"더미 데이터 세트를 읽을 수 없습니다: {safe_id}") from exc
    validate_dummy_dataset(data)
    return data


def validate_dummy_dataset(data: dict[str, Any]) -> None:
    required = {"dataset_id", "name", "weather", "stores", "customers", "riders", "orders", "package"}
    missing = required - data.keys()
    if missing:
        raise DummyDataError(f"더미 데이터 필수 항목 누락: {', '.join(sorted(missing))}")
    ids = {
        "stores": {item["store_id"] for item in data["stores"]},
        "customers": {item["customer_id"] for item in data["customers"]},
        "riders": {item["rider_id"] for item in data["riders"]},
        "orders": {item["order_id"] for item in data["orders"]},
    }
    for order in data["orders"]:
        if order["store_id"] not in ids["stores"]:
            raise DummyDataError(f"주문 {order['order_id']}의 매장을 찾을 수 없습니다.")
        if order["customer_id"] not in ids["customers"]:
            raise DummyDataError(f"주문 {order['order_id']}의 고객을 찾을 수 없습니다.")
    package = data["package"]
    if set(package["order_ids"]) != ids["orders"]:
        raise DummyDataError("패키지 주문 ID와 주문 데이터가 일치하지 않습니다.")
    for strategy in ("optimized", "pickup_first"):
        if strategy not in package["route_blueprints"] or strategy not in package["strategy_profiles"]:
            raise DummyDataError(f"경로 전략 데이터가 없습니다: {strategy}")


def _at(base: datetime, offset_min: int | float | None) -> str | None:
    if offset_min is None:
        return None
    return (base + timedelta(minutes=float(offset_min))).isoformat()


def materialize_dummy_dataset(data: dict[str, Any], base: datetime) -> dict[str, Any]:
    """Convert relative-time scenario data into the exact in-memory state shape."""
    stores = {item["store_id"]: copy.deepcopy(item) for item in data["stores"]}
    customers = {item["customer_id"]: copy.deepcopy(item) for item in data["customers"]}
    riders: dict[str, dict[str, Any]] = {}
    for item in data["riders"]:
        rider = copy.deepcopy(item)
        rider.setdefault("status", "AVAILABLE")
        rider["status_label"] = {
            "AVAILABLE": "배차 대기",
            "OFFERED": "배차 제안 확인",
            "ASSIGNED": "배차 수행 중",
        }.get(rider["status"], rider["status"])
        rider["location_updated_at"] = base.isoformat()
        rider["assigned_package_id"] = None
        riders[rider["rider_id"]] = rider

    orders: dict[str, dict[str, Any]] = {}
    for source in data["orders"]:
        order = copy.deepcopy(source)
        customer = customers[order["customer_id"]]
        ready_at = _at(base, order.pop("ready_offset_min"))
        start_at = _at(base, order.pop("recommended_start_offset_min"))
        created_at = _at(base, order.pop("created_offset_min"))
        order.update(
            {
                "package_id": data["package"]["package_id"],
                "created_at": created_at,
                "status_label": order["status"],
                "delivery_address": customer["delivery_address"],
                "delivery_area": customer["delivery_area"],
                "lat": customer["lat"],
                "lng": customer["lng"],
                "request_note": customer["request_note"],
                "predicted_ready_at": ready_at,
                "target_ready_at": ready_at,
                "recommended_start_at": start_at,
                "actual_ready_at": _at(base, -1) if order["status"] == "READY" else None,
                "picked_up_at": None,
                "delivered_at": None,
                "eta_start": _at(base, 25),
                "eta_end": _at(base, 31),
                "delivery_sequence": 1,
                "quality_guard_passed": order["bag_time_min"] <= order["bag_time_limit_min"],
            }
        )
        orders[order["order_id"]] = order

    package_source = copy.deepcopy(data["package"])
    strategy = package_source.pop("default_strategy")
    route_blueprints = package_source.pop("route_blueprints")
    strategy_profiles = package_source.pop("strategy_profiles")
    package = {
        **package_source,
        "route_strategy": strategy,
        "route_changed": False,
        "route_change_note": None,
        "current_step_index": 0,
        "steps": [],
    }
    selected_profile = copy.deepcopy(strategy_profiles[strategy])
    bag_times = selected_profile.pop("bag_times")
    package.update(selected_profile)
    for order_id, bag_time in bag_times.items():
        orders[order_id]["bag_time_min"] = bag_time
        orders[order_id]["quality_guard_passed"] = bag_time <= orders[order_id]["bag_time_limit_min"]
    package["quality_guard_passed"] = all(orders[order_id]["quality_guard_passed"] for order_id in package["order_ids"])

    weather = copy.deepcopy(data["weather"])
    simulation = {
        "running": False,
        "speed": 1,
        "sim_time": base.isoformat(),
        "scenario": data["name"],
        "rider_progress": data.get("simulation", {}).get("rider_progress", 0.18),
    }
    return {
        "metadata": {
            "dataset_id": data["dataset_id"],
            "name": data["name"],
            "description": data["description"],
            "seed": data.get("seed"),
            "notice": data.get("notice", "가상 테스트 데이터"),
        },
        "simulation": simulation,
        "weather": weather,
        "stores": stores,
        "customers": customers,
        "orders": orders,
        "riders": riders,
        "package": package,
        "route_blueprints": route_blueprints,
        "strategy_profiles": strategy_profiles,
    }
