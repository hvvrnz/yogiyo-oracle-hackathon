#!/usr/bin/env python3
"""Generate deterministic dummy data for the Yogiyo AI batch-delivery demo.

The generated files are intentionally credential-free and contain no real user
information. Re-running this script with the same seed produces the same data.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import random
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "dummy"
CENTER_LAT = 37.5019
CENTER_LNG = 127.0396


@dataclass
class Point:
    lat: float
    lng: float


def jitter(rng: random.Random, center: Point, radius_km: float) -> Point:
    angle = rng.random() * 2 * math.pi
    distance = radius_km * math.sqrt(rng.random())
    lat_delta = (distance / 111.0) * math.cos(angle)
    lng_delta = (distance / (111.0 * math.cos(math.radians(center.lat)))) * math.sin(angle)
    return Point(round(center.lat + lat_delta, 6), round(center.lng + lng_delta, 6))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        return
    fieldnames = list(rows[0].keys())
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def build_catalogs(rng: random.Random) -> dict[str, list[dict[str, Any]]]:
    center = Point(CENTER_LAT, CENTER_LNG)
    store_templates = [
        ("낭만치킨", "치킨", 22, 12),
        ("젊음버거", "버거", 17, 12),
        ("사랑한식", "한식", 19, 14),
        ("오늘의피자", "피자", 24, 15),
        ("따뜻한분식", "분식", 14, 10),
        ("서울돈까스", "돈까스", 20, 13),
        ("바른샐러드", "샐러드", 11, 9),
        ("골목중식", "중식", 21, 13),
        ("도시락연구소", "도시락", 16, 12),
        ("면과국물", "일식", 18, 11),
        ("매일카페", "카페", 9, 8),
        ("정성족발", "족발·보쌈", 27, 15),
    ]
    districts = ["역삼", "선릉", "삼성", "논현", "대치", "도곡", "청담", "개포"]
    stores: list[dict[str, Any]] = []
    for idx, (brand, category, cooking_min, bag_limit) in enumerate(store_templates, start=1):
        point = jitter(rng, center, 3.2)
        district = districts[(idx - 1) % len(districts)]
        stores.append(
            {
                "store_id": f"S-{idx:03d}",
                "name": f"{brand} {district}점",
                "category": category,
                "address": f"서울 강남구 {district}동 테스트로 {100 + idx}",
                "lat": point.lat,
                "lng": point.lng,
                "base_cooking_min": cooking_min,
                "bag_time_limit_min": bag_limit,
                "correction_factor": round(rng.uniform(0.91, 1.10), 2),
                "prediction_accuracy_pct": rng.randint(82, 94),
                "open": True,
            }
        )

    customers: list[dict[str, Any]] = []
    surnames = ["김", "이", "박", "최", "정", "윤", "한", "송", "임", "오"]
    given = ["하늘", "서준", "민지", "지호", "수빈", "예린", "도윤", "현우", "지민", "나연"]
    for idx in range(1, 37):
        point = jitter(rng, center, 4.0)
        customers.append(
            {
                "customer_id": f"C-{idx:03d}",
                "display_name": f"{rng.choice(surnames)}{rng.choice(given)}",
                "delivery_area": f"강남구 테스트권역 {(idx - 1) % 9 + 1}",
                "delivery_address": f"서울 강남구 테스트동 {200 + idx} 테스트아파트 {idx}동",
                "lat": point.lat,
                "lng": point.lng,
                "request_note": rng.choice(
                    ["문 앞에 놓아주세요.", "벨을 누르지 말아주세요.", "경비실에 맡겨주세요.", "도착 후 메시지 부탁드려요."]
                ),
            }
        )

    riders: list[dict[str, Any]] = []
    for idx in range(1, 9):
        point = jitter(rng, center, 3.8)
        riders.append(
            {
                "rider_id": f"R-{idx:03d}",
                "display_name": f"라이더 {idx:02d}",
                "vehicle": rng.choice(["오토바이", "전기자전거"]),
                "status": "AVAILABLE",
                "lat": point.lat,
                "lng": point.lng,
                "average_speed_kmh": rng.randint(19, 27),
            }
        )

    menu_catalog = [
        {"category": "치킨", "items": ["후라이드치킨", "양념치킨", "간장치킨", "콜라 1.25L"]},
        {"category": "버거", "items": ["클래식버거 세트", "치즈버거 세트", "치킨버거", "감자튀김"]},
        {"category": "한식", "items": ["제육볶음 도시락", "불고기 도시락", "김치찌개", "계란말이"]},
        {"category": "피자", "items": ["페퍼로니 피자", "고구마 피자", "치즈 피자", "윙봉"]},
        {"category": "분식", "items": ["떡볶이", "순대", "모둠튀김", "김밥"]},
        {"category": "돈까스", "items": ["등심돈까스", "치즈돈까스", "냉모밀", "우동"]},
        {"category": "샐러드", "items": ["닭가슴살 샐러드", "리코타 샐러드", "수프", "주스"]},
        {"category": "중식", "items": ["짜장면", "짬뽕", "탕수육", "볶음밥"]},
        {"category": "도시락", "items": ["닭갈비 도시락", "소불고기 도시락", "두부강정", "샐러드"]},
        {"category": "일식", "items": ["돈코츠라멘", "규동", "가라아게", "유부초밥"]},
        {"category": "카페", "items": ["아메리카노", "카페라떼", "크로플", "샌드위치"]},
        {"category": "족발·보쌈", "items": ["족발 중", "보쌈 중", "막국수", "주먹밥"]},
    ]
    return {"stores": stores, "customers": customers, "riders": riders, "menu_catalog": menu_catalog}


def build_history(rng: random.Random, catalogs: dict[str, list[dict[str, Any]]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    stores = catalogs["stores"]
    customers = catalogs["customers"]
    menu_by_category = {item["category"]: item["items"] for item in catalogs["menu_catalog"]}
    historical_orders: list[dict[str, Any]] = []
    cooking_history: list[dict[str, Any]] = []
    start = date(2026, 6, 1)
    for idx in range(1, 81):
        store = rng.choice(stores)
        customer = rng.choice(customers)
        day = start + timedelta(days=rng.randint(0, 62))
        hour = rng.choice([11, 12, 13, 17, 18, 19, 20, 21])
        menu = rng.choice(menu_by_category[store["category"]])
        quantity = rng.randint(1, 3)
        predicted = max(7, round(store["base_cooking_min"] * store["correction_factor"] + rng.uniform(-2.5, 3.5)))
        weather = rng.choice(["CLEAR", "CLEAR", "CLOUDY", "RAIN"])
        load = rng.randint(0, 8)
        actual = max(5, predicted + rng.randint(-3, 5) + (2 if load >= 6 else 0))
        order_id = f"HIST-{idx:04d}"
        historical_orders.append(
            {
                "order_id": order_id,
                "store_id": store["store_id"],
                "customer_id": customer["customer_id"],
                "ordered_date": day.isoformat(),
                "ordered_hour": hour,
                "menu_name": menu,
                "quantity": quantity,
                "amount": rng.randrange(9000, 39001, 500),
                "weather": weather,
                "store_load": load,
                "predicted_cooking_min": predicted,
                "actual_cooking_min": actual,
                "prediction_error_min": actual - predicted,
            }
        )
        cooking_history.append(
            {
                "history_id": f"COOK-{idx:04d}",
                "order_id": order_id,
                "store_id": store["store_id"],
                "category": store["category"],
                "weekday": day.weekday(),
                "hour": hour,
                "menu_count": quantity,
                "store_load": load,
                "weather": weather,
                "base_cooking_min": store["base_cooking_min"],
                "correction_factor": store["correction_factor"],
                "predicted_cooking_min": predicted,
                "actual_cooking_min": actual,
            }
        )
    return historical_orders, cooking_history


def scenario_order(
    order_id: str,
    customer_id: str,
    store_id: str,
    menu_summary: str,
    items: list[dict[str, Any]],
    amount: int,
    created_offset_min: int,
    ready_offset_min: int,
    cooking_min: int,
    bag_time_min: int,
    bag_limit_min: int,
    status: str,
) -> dict[str, Any]:
    return {
        "order_id": order_id,
        "customer_id": customer_id,
        "store_id": store_id,
        "created_offset_min": created_offset_min,
        "status": status,
        "menu_summary": menu_summary,
        "items": items,
        "amount": amount,
        "predicted_cooking_min": cooking_min,
        "ready_offset_min": ready_offset_min,
        "recommended_start_offset_min": ready_offset_min - cooking_min,
        "bag_time_min": bag_time_min,
        "bag_time_limit_min": bag_limit_min,
        "food_sitting_min": 2,
    }


def build_scenario(
    catalogs: dict[str, list[dict[str, Any]]],
    *,
    dataset_id: str,
    name: str,
    description: str,
    seed: int,
    condition: str,
    travel_delay_min: int,
    default_strategy: str,
    ready_offsets: tuple[int, int, int],
    statuses: tuple[str, str, str],
    congestion: tuple[str, str, str],
    strategy_adjustment: dict[str, Any] | None = None,
) -> dict[str, Any]:
    stores = [dict(item) for item in catalogs["stores"][:3]]
    customers = [dict(item) for item in catalogs["customers"][:3]]
    customer_locations = [
        ("역삼동 인근", "서울 강남구 역삼동 고객 주소", 37.4974, 127.0411, "문 앞에 놓아주세요."),
        ("선릉동 인근", "서울 강남구 선릉동 고객 주소", 37.5014, 127.0446, "벨을 누르지 말아주세요."),
        ("삼성동 인근", "서울 강남구 삼성동 고객 주소", 37.5083, 127.0518, "경비실에 맡겨주세요."),
    ]
    for customer, (area, address, lat, lng, note) in zip(customers, customer_locations):
        customer.update({"delivery_area": area, "delivery_address": address, "lat": lat, "lng": lng, "request_note": note})
    riders = [dict(item) for item in catalogs["riders"][:4]]
    # 재배차 순서를 눈으로 확인하기 쉽도록 첫 픽업 매장 주변에
    # 후보 라이더를 가까운 순서대로 배치합니다.
    first_store = stores[0]
    rider_offsets = [(-0.0014, -0.0018), (-0.0030, -0.0028), (0.0038, -0.0035), (-0.0050, 0.0042)]
    for index, (rider, (lat_offset, lng_offset)) in enumerate(zip(riders, rider_offsets), start=1):
        rider.update(
            {
                "display_name": f"라이더 {index:02d}",
                "status": "AVAILABLE",
                "lat": round(first_store["lat"] + lat_offset, 6),
                "lng": round(first_store["lng"] + lng_offset, 6),
                "average_speed_kmh": 24 - index,
            }
        )
    for store, value in zip(stores, congestion):
        store["congestion"] = value
    weather_table = {
        "CLEAR": {"label": "맑음", "temperature_c": 29, "precipitation_mm": 0.0, "wind_speed_mps": 1.8},
        "RAIN": {"label": "비", "temperature_c": 26, "precipitation_mm": 5.5, "wind_speed_mps": 3.4},
        "HEAVY_RAIN": {"label": "강한 비", "temperature_c": 25, "precipitation_mm": 13.0, "wind_speed_mps": 5.2},
    }
    weather = {
        "condition": condition,
        **weather_table[condition],
        "travel_delay_min": travel_delay_min,
        "advisory": (
            "현재 날씨로 인한 추가 지연은 크지 않습니다."
            if travel_delay_min == 0
            else f"강수 영향으로 이동시간이 평소보다 약 {travel_delay_min}분 늘어날 수 있어요."
        ),
        "source": "가상 기상 데이터 · 실제 API 호출 아님",
    }
    orders = [
        scenario_order(
            "O-001", "C-001", "S-001", "후라이드치킨 외 1개",
            [{"name": "후라이드치킨", "quantity": 1}, {"name": "콜라 1.25L", "quantity": 1}],
            23900, -15, ready_offsets[0], 22, 9, 12, statuses[0],
        ),
        scenario_order(
            "O-002", "C-002", "S-002", "클래식버거 세트",
            [{"name": "클래식버거 세트", "quantity": 1}],
            14900, -13, ready_offsets[1], 18, 7, 12, statuses[1],
        ),
        scenario_order(
            "O-003", "C-003", "S-003", "제육볶음 도시락 외 1개",
            [{"name": "제육볶음 도시락", "quantity": 1}, {"name": "계란말이", "quantity": 1}],
            18500, -12, ready_offsets[2], 19, 10, 14, statuses[2],
        ),
    ]
    optimized_profile = {
        "route_strategy": "optimized",
        "route_strategy_label": "혼합 최적화",
        "route_strategy_description": "조리 완료시각과 품질 제한을 고려해 픽업과 배달을 섞어 이동합니다.",
        "estimated_duration_min": 18 + travel_delay_min,
        "hourly_revenue": round(7500 / ((18 + travel_delay_min) / 60), -2),
        "total_distance_km": 4.2,
        "total_wait_min": 1,
        "route_overlap_pct": 82,
        "extra_distance_km": 0.7,
        "extra_duration_min": 3 + travel_delay_min,
        "selected_route_reason": "조리 완료 시각이 가깝고 이동 방향이 겹치는 경로",
        "bag_times": {"O-001": 9 + travel_delay_min // 2, "O-002": 7, "O-003": 10 + travel_delay_min // 2},
    }
    pickup_profile = {
        "route_strategy": "pickup_first",
        "route_strategy_label": "전체 픽업 후 배달",
        "route_strategy_description": "세 매장의 음식을 모두 픽업한 뒤 고객에게 순서대로 배달합니다.",
        "estimated_duration_min": 21 + travel_delay_min,
        "hourly_revenue": round(7500 / ((21 + travel_delay_min) / 60), -2),
        "total_distance_km": 4.6,
        "total_wait_min": 2,
        "route_overlap_pct": 78,
        "extra_distance_km": 1.1,
        "extra_duration_min": 5 + travel_delay_min,
        "selected_route_reason": "모든 픽업을 먼저 완료해 픽업 흐름을 단순화한 경로",
        "bag_times": {"O-001": 11 + travel_delay_min // 2, "O-002": 8, "O-003": 13 + travel_delay_min // 2},
    }
    if strategy_adjustment:
        optimized_profile.update(strategy_adjustment.get("optimized", {}))
        pickup_profile.update(strategy_adjustment.get("pickup_first", {}))
    return {
        "schema_version": 1,
        "dataset_id": dataset_id,
        "name": name,
        "description": description,
        "seed": seed,
        "generated": True,
        "notice": "모든 인물·매장·주소·수치는 테스트를 위해 생성한 가상 데이터입니다.",
        "simulation": {"rider_progress": 0.18},
        "weather": weather,
        "stores": stores,
        "customers": customers,
        "riders": riders,
        "orders": orders,
        "package": {
            "package_id": "PKG-001",
            "status": "OFFERED",
            "status_label": "라이더 제안 중",
            "order_ids": ["O-001", "O-002", "O-003"],
            "rider_id": None,
            "offered_rider_id": "R-001",
            "auto_reassign_enabled": True,
            "offer_timeout_sec": 30,
            "bundle_size": 3,
            "default_strategy": default_strategy,
            "ready_gap_min": max(ready_offsets) - min(ready_offsets),
            "candidate_route_count": 90,
            "package_revenue": 7500,
            "eta_confidence_pct": 92 if condition == "CLEAR" else 86,
            "quality_guard_passed": True,
            "eta_guard_passed": True,
            "promise_eta_preserved": True,
            "reroute_enabled": True,
            "fallback_when_late": "묶음 해제 후 재배차",
            "strategy_profiles": {
                "optimized": optimized_profile,
                "pickup_first": pickup_profile,
            },
            "route_blueprints": {
                "optimized": [
                    {"type": "PICKUP", "order_id": "O-001", "duration_min": 4, "label": "낭만치킨 픽업"},
                    {"type": "PICKUP", "order_id": "O-002", "duration_min": 3, "label": "젊음버거 픽업"},
                    {"type": "DELIVERY", "order_id": "O-002", "duration_min": 6, "label": "주문 B 배달"},
                    {"type": "PICKUP", "order_id": "O-003", "duration_min": 4, "label": "사랑한식 픽업"},
                    {"type": "DELIVERY", "order_id": "O-001", "duration_min": 7, "label": "고객님 주문 배달"},
                    {"type": "DELIVERY", "order_id": "O-003", "duration_min": 6, "label": "주문 C 배달"},
                ],
                "pickup_first": [
                    {"type": "PICKUP", "order_id": "O-001", "duration_min": 4, "label": "낭만치킨 픽업"},
                    {"type": "PICKUP", "order_id": "O-002", "duration_min": 3, "label": "젊음버거 픽업"},
                    {"type": "PICKUP", "order_id": "O-003", "duration_min": 4, "label": "사랑한식 픽업"},
                    {"type": "DELIVERY", "order_id": "O-002", "duration_min": 6, "label": "주문 B 배달"},
                    {"type": "DELIVERY", "order_id": "O-001", "duration_min": 7, "label": "고객님 주문 배달"},
                    {"type": "DELIVERY", "order_id": "O-003", "duration_min": 6, "label": "주문 C 배달"},
                ],
            },
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=20260804)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    rng = random.Random(args.seed)
    output: Path = args.output.resolve()

    catalogs = build_catalogs(rng)
    historical_orders, cooking_history = build_history(rng, catalogs)

    write_json(output / "catalog" / "stores.json", catalogs["stores"])
    write_json(output / "catalog" / "customers.json", catalogs["customers"])
    write_json(output / "catalog" / "riders.json", catalogs["riders"])
    write_json(output / "catalog" / "menu_catalog.json", catalogs["menu_catalog"])
    write_json(output / "catalog" / "historical_orders.json", historical_orders)
    write_json(output / "catalog" / "cooking_history.json", cooking_history)
    write_csv(output / "catalog" / "stores.csv", catalogs["stores"])
    write_csv(output / "catalog" / "customers.csv", catalogs["customers"])
    write_csv(output / "catalog" / "riders.csv", catalogs["riders"])
    write_csv(output / "catalog" / "historical_orders.csv", historical_orders)
    write_csv(output / "catalog" / "cooking_history.csv", cooking_history)

    scenarios = [
        build_scenario(
            catalogs,
            dataset_id="balanced",
            name="평시 균형형 3건 묶음배달",
            description="조리시간과 이동방향이 고르게 맞는 기본 발표 시나리오입니다.",
            seed=args.seed,
            condition="CLEAR",
            travel_delay_min=0,
            default_strategy="optimized",
            ready_offsets=(7, 9, 11),
            statuses=("COOKING", "COOKING", "READY"),
            congestion=("보통", "혼잡", "여유"),
        ),
        build_scenario(
            catalogs,
            dataset_id="rainy_rush",
            name="우천 피크타임 시나리오",
            description="강한 비와 매장 혼잡으로 ETA와 수익 효율이 낮아지는 상황을 확인합니다.",
            seed=args.seed + 1,
            condition="HEAVY_RAIN",
            travel_delay_min=6,
            default_strategy="optimized",
            ready_offsets=(8, 12, 13),
            statuses=("COOKING", "DELAYED", "COOKING"),
            congestion=("혼잡", "매우 혼잡", "혼잡"),
        ),
        build_scenario(
            catalogs,
            dataset_id="store_delay",
            name="버거 매장 조리 지연 시나리오",
            description="두 번째 매장의 조리가 늦어 혼합 경로 재계산이 필요한 상황입니다.",
            seed=args.seed + 2,
            condition="RAIN",
            travel_delay_min=3,
            default_strategy="optimized",
            ready_offsets=(7, 17, 11),
            statuses=("COOKING", "DELAYED", "READY"),
            congestion=("보통", "매우 혼잡", "여유"),
            strategy_adjustment={"optimized": {"total_wait_min": 3, "route_overlap_pct": 76}},
        ),
        build_scenario(
            catalogs,
            dataset_id="pickup_first",
            name="전체 픽업 후 배달 시나리오",
            description="세 매장의 조리 완료시각이 가까워 모든 픽업을 먼저 수행할 수 있습니다.",
            seed=args.seed + 3,
            condition="CLEAR",
            travel_delay_min=0,
            default_strategy="pickup_first",
            ready_offsets=(7, 8, 9),
            statuses=("READY", "READY", "READY"),
            congestion=("여유", "보통", "여유"),
        ),
    ]
    for scenario in scenarios:
        write_json(output / "scenarios" / f"{scenario['dataset_id']}.json", scenario)

    weather_samples = [
        {"weather_id": "W-001", "condition": "CLEAR", "temperature_c": 29, "precipitation_mm": 0.0, "wind_speed_mps": 1.8, "travel_delay_min": 0},
        {"weather_id": "W-002", "condition": "RAIN", "temperature_c": 26, "precipitation_mm": 5.5, "wind_speed_mps": 3.4, "travel_delay_min": 3},
        {"weather_id": "W-003", "condition": "HEAVY_RAIN", "temperature_c": 25, "precipitation_mm": 13.0, "wind_speed_mps": 5.2, "travel_delay_min": 6},
    ]
    write_json(output / "catalog" / "weather_samples.json", weather_samples)
    write_csv(output / "catalog" / "weather_samples.csv", weather_samples)

    manifest = {
        "schema_version": 1,
        "seed": args.seed,
        "notice": "모든 데이터는 테스트용으로 생성되었으며 실제 사용자·매장·라이더 정보가 아닙니다.",
        "counts": {
            "stores": len(catalogs["stores"]),
            "customers": len(catalogs["customers"]),
            "riders": len(catalogs["riders"]),
            "historical_orders": len(historical_orders),
            "cooking_history": len(cooking_history),
            "scenarios": len(scenarios),
        },
        "scenarios": [
            {"dataset_id": item["dataset_id"], "name": item["name"], "description": item["description"]}
            for item in scenarios
        ],
    }
    write_json(output / "manifest.json", manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
