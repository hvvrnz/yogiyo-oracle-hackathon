from fastapi import APIRouter, HTTPException
from vector_search.handler.congestion import build_congestion_notice
from datetime import datetime
from pydantic import BaseModel

router = APIRouter(prefix="/api/demo", tags=["demo"])

demo_state = {"step": 0}
route_progress = {"current_index": 0}
demo_explanations = {}

# ── 매장 3개 (889/894/815 강남 - 815는 30분짜리 긴 조리시간 매장) ──
STORE_A = {"store_id": 889, "name": "요기요햄버거 강남점🍔", "category": "버거", "region": "강남", "lat": 37.505486, "lng": 127.02069, "avg_delivery_eta_min": 35}
STORE_B = {"store_id": 894, "name": "정통도시락 강남점🍱", "category": "도시락", "region": "강남", "lat": 37.507781, "lng": 127.02166, "avg_delivery_eta_min": 25}
STORE_C = {"store_id": 815, "name": "매운갈비찜 강남점🍲", "category": "찜류", "region": "강남", "lat": 37.506200, "lng": 127.02300, "avg_delivery_eta_min": 45}

# ── 배달지 (주소 포함) ──
DELIVERY_A = {"lat": 37.510200, "lng": 127.02550, "address": "서울 강남구 테헤란로 152, 강남파이낸스타워 15층"}
DELIVERY_B = {"lat": 37.512400, "lng": 127.02100, "address": "서울 강남구 역삼로 231, 역삼푸르지오 302동 1204호"}
DELIVERY_C = {"lat": 37.509800, "lng": 127.01900, "address": "서울 강남구 봉은사로 114, 강남오피스텔 8층 810호"}

ORDER_A_MENU = [{"menu": "치즈버거세트", "qty": 1, "price": 12000}]
ORDER_B_MENU = [{"menu": "제육도시락", "qty": 1, "price": 9000}]
ORDER_C_MENU = [{"menu": "매운갈비찜", "qty": 1, "price": 22000}]

PACKAGE_ID = 80001
RIDER_ID = "rider_12"
RIDER_NAME = "역주행금지마스터"
RIDER_LAT = 37.504000
RIDER_LNG = 127.019000

# 완전탐색이 계산한 것처럼, 짧은 것부터 픽업하고 긴 것(815, 30분)을 마지막에 픽업
ROUTE_DETAIL = [
    {"order_id": 90002, "type": "pickup", "lat": STORE_B["lat"], "lng": STORE_B["lng"]},
    {"order_id": 90001, "type": "pickup", "lat": STORE_A["lat"], "lng": STORE_A["lng"]},
    {"order_id": 90003, "type": "pickup", "lat": STORE_C["lat"], "lng": STORE_C["lng"]},
    {"order_id": 90002, "type": "dropoff", "lat": DELIVERY_B["lat"], "lng": DELIVERY_B["lng"]},
    {"order_id": 90001, "type": "dropoff", "lat": DELIVERY_A["lat"], "lng": DELIVERY_A["lng"]},
    {"order_id": 90003, "type": "dropoff", "lat": DELIVERY_C["lat"], "lng": DELIVERY_C["lng"]},
]

# 라이더 화면에 "지금 뭘 해야 하는지" 하나씩 순서대로 보여줄 목록 (매장명/주소 포함)
STOP_SEQUENCE = [
    {"order_id": 90002, "type": "pickup", "label": STORE_B["name"], "lat": STORE_B["lat"], "lng": STORE_B["lng"]},
    {"order_id": 90001, "type": "pickup", "label": STORE_A["name"], "lat": STORE_A["lat"], "lng": STORE_A["lng"]},
    {"order_id": 90003, "type": "pickup", "label": STORE_C["name"], "lat": STORE_C["lat"], "lng": STORE_C["lng"]},
    {"order_id": 90002, "type": "dropoff", "label": DELIVERY_B["address"], "lat": DELIVERY_B["lat"], "lng": DELIVERY_B["lng"]},
    {"order_id": 90001, "type": "dropoff", "label": DELIVERY_A["address"], "lat": DELIVERY_A["lat"], "lng": DELIVERY_A["lng"]},
    {"order_id": 90003, "type": "dropoff", "label": DELIVERY_C["address"], "lat": DELIVERY_C["lat"], "lng": DELIVERY_C["lng"]},
]

# 조리시간: 889=사장님 입력값(기본 20), 894=15분, 815=30분(긴 것, 핵심 스토리)
_owner_cook_min = {"value": 20}

SCORE_DETAIL = {
    "food_sitting_time": 2.1,
    "courier_wait_time": 5.4,
    "bag_time": 11.2,
    "total_time": 33.8,
    "timeline": [
        {"order_id": 90002, "type": "pickup", "move_time_min": 0.0, "arrival_time_min": 1.5,
         "owner_cook_min": 15, "predicted_cook_min": 15.0, "wait_min": 0, "food_sitting_min": 0, "bag_min": 0},
        {"order_id": 90001, "type": "pickup", "move_time_min": 2.0, "arrival_time_min": 3.5,
         "owner_cook_min": 20, "predicted_cook_min": 20.0, "wait_min": 0, "food_sitting_min": 0, "bag_min": 2.0},
        {"order_id": 90003, "type": "pickup", "move_time_min": 2.5, "arrival_time_min": 6.0,
         "owner_cook_min": 30, "predicted_cook_min": 30.0, "wait_min": 5.4, "food_sitting_min": 0, "bag_min": 4.5},
        {"order_id": 90002, "type": "dropoff", "move_time_min": 8.4, "arrival_time_min": 19.8,
         "owner_cook_min": None, "predicted_cook_min": None, "wait_min": 0, "food_sitting_min": 0, "bag_min": 16.3},
        {"order_id": 90001, "type": "dropoff", "move_time_min": 6.9, "arrival_time_min": 26.7,
         "owner_cook_min": None, "predicted_cook_min": None, "wait_min": 0, "food_sitting_min": 0, "bag_min": 21.2},
        {"order_id": 90003, "type": "dropoff", "move_time_min": 7.1, "arrival_time_min": 33.8,
         "owner_cook_min": None, "predicted_cook_min": None, "wait_min": 0, "food_sitting_min": 2.1, "bag_min": 27.8},
    ],
}

PACKAGE_SCORE = 41
PACKAGE_REVENUE = 12700
HOURLY_REVENUE = 22500

# step: 0=조리전, 1=조리중+제안뜸, 2=수락(MATCHING), 3=전부픽업완료(PICKED_UP), 4=전부배달완료(DELIVERED)


class CookTimeInput(BaseModel):
    owner_cook_min: int = 20


def _package_summary():
    return {
        "package_id": PACKAGE_ID, "package_type": "BUNDLE",
        "score": PACKAGE_SCORE, "package_revenue": PACKAGE_REVENUE, "hourly_revenue": HOURLY_REVENUE,
        "bundle_size": 3, "order_ids": [90001, 90002, 90003], "route_detail": ROUTE_DETAIL,
    }


def _demo_orders():
    return [
        {"order_id": 90001, "store_name": STORE_A["name"], "status": "COOKING", "owner_cook_min": _owner_cook_min["value"], "predicted_cook_min": 20},
        {"order_id": 90002, "store_name": STORE_B["name"], "status": "COOKING", "owner_cook_min": 15, "predicted_cook_min": 15},
        {"order_id": 90003, "store_name": STORE_C["name"], "status": "COOKING", "owner_cook_min": 30, "predicted_cook_min": 30},
    ]


def _demo_explanation_context(explanation_stage):
    customer_order = {
        "order_id": 90001, "store_name": STORE_A["name"],
        "delivery_address": DELIVERY_A["address"], "status": "MATCHED",
        "package_id": PACKAGE_ID, "rider_id": RIDER_ID,
        "route_detail": ROUTE_DETAIL, "score_detail": SCORE_DETAIL,
        "eta_min": SCORE_DETAIL["total_time"],
    }
    return {
        "explanation_stage": explanation_stage,
        "package": dict(_package_summary(), score_detail=SCORE_DETAIL, status="OFFERED"),
        "orders": _demo_orders(),
        "customer_order": customer_order,
        "merchant_order": _demo_orders()[0],
        "rider_profile": {"rider_id": RIDER_ID, "status": "AVAILABLE"},
    }


def _get_demo_explanations(explanation_stage):
    """Generate once per demo package and keep demo state usable on LLM errors."""
    cache_key = (PACKAGE_ID, explanation_stage)
    cached = demo_explanations.get(cache_key)
    if cached:
        return cached

    from explanation.generator import (
        LLMConfigurationError,
        LLMGenerationError,
        demo_explanation_fallback,
        generate_demo_explanations,
    )

    context = _demo_explanation_context(explanation_stage)
    try:
        generated = generate_demo_explanations(context)
    except (LLMConfigurationError, LLMGenerationError):
        generated = demo_explanation_fallback(context)
    demo_explanations[cache_key] = generated
    return generated


def _customer_response():
    step = demo_state["step"]
    status_map = {0: "NEW", 1: "COOKING", 2: "MATCHED", 3: "PICKED_UP", 4: "DELIVERED"}
    response = {
        "order_id": 90001, "store_name": STORE_A["name"],
        "store_lat": STORE_A["lat"], "store_lng": STORE_A["lng"],
        "delivery_lat": DELIVERY_A["lat"], "delivery_lng": DELIVERY_A["lng"],
        "delivery_address": DELIVERY_A["address"],
        "menu_items": ORDER_A_MENU, "amount": 12000, "delivery_fee": 3000,
        "status": status_map[step],
        "package_id": PACKAGE_ID if step >= 1 else None,
        "rider_id": RIDER_ID if step >= 2 else None,
        "route_detail": ROUTE_DETAIL if step >= 2 else None,
        "score_detail": SCORE_DETAIL if step >= 2 else None,
        "eta_min": SCORE_DETAIL["total_time"] if step >= 2 else None,
    }
    if step >= 2:
        response["consumer_text"] = _get_demo_explanations("MATCHED")["consumer_text"]
    return response


@router.get("/customer/order")
def demo_customer_order():
    """소비자 화면 - 5초마다 호출."""
    return _customer_response()


@router.get("/merchant/next-to-cook")
def demo_merchant_next():
    """
    사장님 화면 - 5초마다 호출.
    조리시작 전(step 0): 조리시간 입력 대기 화면
    조리시작 후(step 1): COOKING 상태로 계속 보임 (사라지지 않음)
    배차 확정 후(step 2+): 대기 주문 없음
    """
    step = demo_state["step"]
    if step == 0:
        return {"order_id": 90001, "menu_items": ORDER_A_MENU, "amount": 12000, "status": "NEW"}
    if step == 1:
        return {"order_id": 90001, "menu_items": ORDER_A_MENU, "amount": 12000,
                "status": "COOKING", "owner_cook_min": _owner_cook_min["value"],
                "merchant_text": _get_demo_explanations("COOKING")["merchant_text"]}
    return {"message": "조리 대기 주문 없음", "merchant_text": _get_demo_explanations("MATCHED")["merchant_text"]}


@router.post("/merchant/cook-start")
def demo_cook_start(body: CookTimeInput):
    """
    사장님이 조리시간 입력하고 조리시작 버튼 클릭.
    889는 사장님이 입력한 값 그대로, 894/815는 강남 매장 자동 트리거.
    """
    _owner_cook_min["value"] = body.owner_cook_min
    demo_state["step"] = 1
    _get_demo_explanations("COOKING")
    return {
        "triggered": [
            {"order_id": 90001, "store_id": STORE_A["store_id"], "owner_cook_min": body.owner_cook_min, "triggered_by": "user"},
            {"order_id": 90002, "store_id": STORE_B["store_id"], "owner_cook_min": 15, "triggered_by": "auto"},
            {"order_id": 90003, "store_id": STORE_C["store_id"], "owner_cook_min": 30, "triggered_by": "auto"},
        ]
    }


@router.get("/rider/offers")
def demo_rider_offers():
    """라이더 화면 - 5초마다 호출."""
    if demo_state["step"] != 1:
        return {"rider_id": RIDER_ID, "offers": []}
    offer = _package_summary()
    offer["rider_text"] = _get_demo_explanations("COOKING")["rider_text"]
    return {"rider_id": RIDER_ID, "offers": [offer]}


@router.get("/rider/profile")
def demo_rider_profile():
    step = demo_state["step"]
    return {
        "rider_id": RIDER_ID, "name": RIDER_NAME, "region": "강남",
        "status": "AVAILABLE" if step < 2 else "BUSY",
        "completed_order_count": 12, "lat": RIDER_LAT, "lng": RIDER_LNG,
    }


@router.get("/rider/packages")
def demo_rider_packages():
    step = demo_state["step"]
    if step < 2:
        return {"rider_id": RIDER_ID, "current_lat": RIDER_LAT, "current_lng": RIDER_LNG, "packages": []}
    status_map = {2: "MATCHING", 3: "PICKED_UP", 4: "COMPLETED"}
    pkg = _package_summary()
    pkg["status"] = status_map[step]
    pkg["score_detail"] = SCORE_DETAIL
    pkg["rider_text"] = _get_demo_explanations("MATCHED")["rider_text"]
    return {"rider_id": RIDER_ID, "current_lat": RIDER_LAT, "current_lng": RIDER_LNG, "packages": [pkg]}


@router.put("/rider/package/{package_id}/accept")
def demo_accept(package_id: int):
    if package_id != PACKAGE_ID:
        raise HTTPException(status_code=404, detail="존재하지 않는 패키지입니다.")
    if demo_state["step"] != 1:
        raise HTTPException(status_code=409, detail="이미 다른 라이더가 수락했거나 존재하지 않는 패키지입니다.")
    demo_state["step"] = 2
    _get_demo_explanations("MATCHED")
    return {"package_id": PACKAGE_ID, "rider_id": RIDER_ID, "status": "MATCHING"}


@router.get("/rider/next-stop")
def demo_next_stop():
    """
    라이더 화면 - 수락 후 5초마다 호출.
    지금 라이더가 다음에 해야 할 일(픽업/배달) 하나만 알려줌.
    """
    idx = route_progress["current_index"]
    if demo_state["step"] < 2:
        return {"message": "아직 배정된 경로 없음"}
    if idx >= len(STOP_SEQUENCE):
        return {"message": "모든 경로 완료"}
    return STOP_SEQUENCE[idx]


@router.post("/rider/arrive")
def demo_arrive_stop():
    """
    라이더가 '완료' 버튼 누르면 호출.
    순서: 90002픽업 -> 90001픽업 -> 90003픽업(여기서 PICKED_UP)
         -> 90002배달 -> 90001배달 -> 90003배달(여기서 COMPLETED)
    """
    if demo_state["step"] < 2:
        raise HTTPException(status_code=400, detail="아직 배차가 확정되지 않았습니다.")

    idx = route_progress["current_index"]
    if idx >= len(STOP_SEQUENCE):
        raise HTTPException(status_code=400, detail="이미 모든 경로를 완료했습니다.")

    current_stop = STOP_SEQUENCE[idx]
    route_progress["current_index"] += 1
    new_idx = route_progress["current_index"]

    if new_idx == 3:
        demo_state["step"] = 3
    elif new_idx == 6:
        demo_state["step"] = 4

    return {
        "completed": current_stop,
        "next": STOP_SEQUENCE[new_idx] if new_idx < 6 else None,
        "package_status": {2: "MATCHING", 3: "PICKED_UP", 4: "COMPLETED"}.get(demo_state["step"], "IN_PROGRESS"),
    }

@router.get("/merchant/llm-data")
def demo_merchant_llm_data():
    """
    사장님 화면용 LLM 프롬프트 재료.
    상황: 비 오는 강남역 퇴근시간대, 매장 혼잡도 + 교통 지연 정보 종합.
    """
    return {
        "case": "BUSIER_THAN_USUAL",
        "store_name": STORE_A["name"],
        "owner_input_cook_min": _owner_cook_min["value"],
        "baseline_cook_min": 24.0,
        "current_time_slot_avg_min": 32.0,
        "sample_count": 15,
        "increase_pct": 33,
        "traffic_area": "테헤란로(강남파이낸스타워 인근)",
        "weather_condition": "비",
        "traffic_delay_min": 8,
    }


@router.get("/rider/llm-data")
def demo_rider_llm_data():
    """
    라이더 화면용 LLM 프롬프트 재료.
    수익(가장 중요) + 교통/날씨 지연 정보.
    """
    return {
        "hourly_revenue": HOURLY_REVENUE,
        "bundle_size": 3,
        "traffic_area": "테헤란로(강남파이낸스타워 인근)",
        "weather_condition": "비",
        "traffic_delay_min": 8,
    }


@router.get("/customer/llm-data")
def demo_customer_llm_data():
    """
    소비자 화면용 LLM 프롬프트 재료.
    has_delay가 false면 프론트에서 템플릿으로, true면 LLM으로 처리.
    """
    food_sitting_min, bag_min = None, None
    for entry in SCORE_DETAIL["timeline"]:
        if entry["order_id"] == 90001 and entry["type"] == "dropoff":
            food_sitting_min = entry["food_sitting_min"]
            bag_min = entry["bag_min"]

    return {
        "food_sitting_min": food_sitting_min,
        "bag_min": bag_min,
        "traffic_delay_min": 8,
        "traffic_area": "테헤란로 인근",
        "weather_condition": "비",
        "has_delay": True,
    }


@router.get("/stores")
def demo_stores():
    return {"count": 3, "stores": [STORE_A, STORE_B, STORE_C]}


@router.post("/reset")
def demo_reset_scenario():
    demo_state["step"] = 0
    route_progress["current_index"] = 0
    _owner_cook_min["value"] = 20
    demo_explanations.clear()
    return {"step": 0}
