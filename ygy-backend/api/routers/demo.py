from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/demo", tags=["demo"])

demo_explanations = {}

# ── 매장 3개 ──
STORE_A = {"store_id": 889, "name": "요기요햄버거 강남점🍔", "category": "버거", "region": "강남", "lat": 37.505486, "lng": 127.02069, "avg_delivery_eta_min": 35}
STORE_B = {"store_id": 894, "name": "정통도시락 강남점🍱", "category": "도시락", "region": "강남", "lat": 37.507781, "lng": 127.02166, "avg_delivery_eta_min": 25}
STORE_C = {"store_id": 815, "name": "매운갈비찜 강남점🍲", "category": "찜류", "region": "강남", "lat": 37.506200, "lng": 127.02300, "avg_delivery_eta_min": 45}

DELIVERY_A = {"lat": 37.510200, "lng": 127.02550, "address": "서울 강남구 테헤란로 152, 강남파이낸스타워"}
DELIVERY_B = {"lat": 37.512400, "lng": 127.02100, "address": "서울 강남구 역삼로 231, 역삼푸르지오 302동"}
DELIVERY_C = {"lat": 37.509800, "lng": 127.01900, "address": "서울 강남구 봉은사로 114, 강남오피스텔 8층"}

ORDER_A_MENU = [{"menu": "치즈버거세트", "qty": 1, "price": 12000}]
ORDER_B_MENU = [{"menu": "제육도시락", "qty": 1, "price": 9000}]
ORDER_C_MENU = [{"menu": "매운갈비찜", "qty": 1, "price": 22000}]

PACKAGE_ID = 80001
RIDER_ID = "rider_12"
RIDER_NAME = "역주행금지마스터"
RIDER_LAT = 37.504000
RIDER_LNG = 127.019000

ORIGINAL_STOP_SEQUENCE = [
    {"sequence": 1, "order_id": 90002, "type": "pickup", "label": STORE_B["name"], "lat": STORE_B["lat"], "lng": STORE_B["lng"]},
    {"sequence": 2, "order_id": 90001, "type": "pickup", "label": STORE_A["name"], "lat": STORE_A["lat"], "lng": STORE_A["lng"]},
    {"sequence": 3, "order_id": 90003, "type": "pickup", "label": STORE_C["name"], "lat": STORE_C["lat"], "lng": STORE_C["lng"]},
    {"sequence": 4, "order_id": 90002, "type": "dropoff", "label": DELIVERY_B["address"], "lat": DELIVERY_B["lat"], "lng": DELIVERY_B["lng"]},
    {"sequence": 5, "order_id": 90001, "type": "dropoff", "label": DELIVERY_A["address"], "lat": DELIVERY_A["lat"], "lng": DELIVERY_A["lng"]},
    {"sequence": 6, "order_id": 90003, "type": "dropoff", "label": DELIVERY_C["address"], "lat": DELIVERY_C["lat"], "lng": DELIVERY_C["lng"]},
]

STOP_SEQUENCE = [dict(s) for s in ORIGINAL_STOP_SEQUENCE]

SCORE_DETAIL = {
    "food_sitting_time": 2.1, "courier_wait_time": 5.4, "bag_time": 11.2, "total_time": 33.8,
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


class DemoState:
    def __init__(self):
        self.reset()

    def reset(self):
        self.merchant_stage = "NEW"
        self.package_stage = "NONE"
        self.owner_cook_min = 20
        self.picked_up_order_ids = set()
        self.delivered_order_ids = set()

    def visited_keys(self):
        keys = set()
        for oid in self.picked_up_order_ids:
            keys.add(f"{oid}-pickup")
        for oid in self.delivered_order_ids:
            keys.add(f"{oid}-dropoff")
        return keys

    def next_incomplete_stop(self):
        for stop in STOP_SEQUENCE:
            key = f"{stop['order_id']}-{stop['type']}"
            if key not in self.visited_keys():
                return stop
        return None

    def order_status(self, order_id):
        if order_id in self.delivered_order_ids:
            return "DELIVERED"
        if self.package_stage in ("MATCHING", "IN_PROGRESS"):
            if order_id in self.picked_up_order_ids:
                return "PICKED_UP"
            return "MATCHED"
        if self.merchant_stage in ("COOKING", "COOKED"):
            return "COOKING"
        return "NEW"


state = DemoState()


def _stop_summary(stop):
    return {"sequence": stop["sequence"], "order_id": stop["order_id"], "type": stop["type"], "label": stop["label"], "lat": stop["lat"], "lng": stop["lng"]}


def _route_with_visited():
    visited = state.visited_keys()
    result = []
    for stop in STOP_SEQUENCE:
        key = f"{stop['order_id']}-{stop['type']}"
        item = dict(_stop_summary(stop))
        item["visited"] = key in visited
        result.append(item)
    return result


def _package_summary():
    return {
        "package_id": PACKAGE_ID, "package_type": "BUNDLE",
        "score": PACKAGE_SCORE, "package_revenue": PACKAGE_REVENUE, "hourly_revenue": HOURLY_REVENUE,
        "bundle_size": 3, "order_ids": [90001, 90002, 90003],
        "route_detail": _route_with_visited(),
    }


def _demo_orders():
    return [
        {"order_id": 90001, "store_name": STORE_A["name"], "status": "COOKING", "owner_cook_min": state.owner_cook_min, "predicted_cook_min": 20},
        {"order_id": 90002, "store_name": STORE_B["name"], "status": "COOKING", "owner_cook_min": 15, "predicted_cook_min": 15},
        {"order_id": 90003, "store_name": STORE_C["name"], "status": "COOKING", "owner_cook_min": 30, "predicted_cook_min": 30},
    ]


def _demo_explanation_context(explanation_stage):
    customer_order = {
        "order_id": 90001, "store_name": STORE_A["name"],
        "delivery_address": DELIVERY_A["address"], "status": "MATCHED",
        "package_id": PACKAGE_ID, "rider_id": RIDER_ID,
        "route_detail": STOP_SEQUENCE, "score_detail": SCORE_DETAIL,
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


def _customer_response(order_id=90001, store=STORE_A, menu=ORDER_A_MENU, amount=12000, delivery=DELIVERY_A):
    status = state.order_status(order_id)

    consumer_text = None
    if status == "DELIVERED":
        consumer_text = "배달이 완료됐어요. 신선하게 받아보셨길 바라요!"
    elif status in ("MATCHED", "PICKED_UP"):
        consumer_text = _get_demo_explanations("MATCHED")["consumer_text"]

    food_sitting_min, bag_min = None, None
    if status in ("MATCHED", "PICKED_UP", "DELIVERED"):
        for entry in SCORE_DETAIL["timeline"]:
            if entry["order_id"] == order_id and entry["type"] == "dropoff":
                food_sitting_min = entry["food_sitting_min"]
                bag_min = entry["bag_min"]

    return {
        "order_id": order_id, "store_name": store["name"],
        "store_lat": store["lat"], "store_lng": store["lng"],
        "delivery_lat": delivery["lat"], "delivery_lng": delivery["lng"],
        "delivery_address": delivery["address"],
        "menu_items": menu, "amount": amount, "delivery_fee": 3000,
        "status": status,
        "package_id": PACKAGE_ID if status not in ("NEW", "COOKING") else None,
        "rider_id": RIDER_ID if status in ("MATCHED", "PICKED_UP", "DELIVERED") else None,
        "route_detail": None,
        "score_detail": None,
        "eta_min": None if status == "DELIVERED" else (SCORE_DETAIL["total_time"] if status in ("MATCHED", "PICKED_UP") else None),
        "consumer_text": consumer_text,
    }


@router.get("/customer/order")
def demo_customer_order():
    return _customer_response()


@router.get("/merchant/next-to-cook")
def demo_merchant_next():
    if state.merchant_stage == "NEW":
        return {"order_id": 90001, "menu_items": ORDER_A_MENU, "amount": 12000, "status": "NEW"}
    if state.merchant_stage == "COOKING":
        return {
            "order_id": 90001, "menu_items": ORDER_A_MENU, "amount": 12000,
            "status": "COOKING", "owner_cook_min": state.owner_cook_min,
            "merchant_text": _get_demo_explanations("COOKING")["merchant_text"],
        }
    if state.merchant_stage == "COOKED" and 90001 not in state.delivered_order_ids:
        status = state.order_status(90001)
        return {"order_id": 90001, "menu_items": ORDER_A_MENU, "amount": 12000, "status": status}
    return {"message": "조리 대기 주문 없음"}


@router.get("/merchant/completed")
def demo_merchant_completed():
    if state.merchant_stage == "COOKED" and 90001 in state.delivered_order_ids:
        return {"orders": [{"order_id": 90001, "menu_items": ORDER_A_MENU, "amount": 12000, "status": "DELIVERED"}]}
    return {"orders": []}


class CookTimeInput(BaseModel):
    owner_cook_min: int = 20


@router.post("/merchant/cook-start")
def demo_cook_start(body: CookTimeInput):
    state.owner_cook_min = body.owner_cook_min
    state.merchant_stage = "COOKING"
    state.package_stage = "OFFERED"
    _get_demo_explanations("COOKING")
    return {
        "triggered": [
            {"order_id": 90001, "store_id": STORE_A["store_id"], "owner_cook_min": body.owner_cook_min, "triggered_by": "user"},
            {"order_id": 90002, "store_id": STORE_B["store_id"], "owner_cook_min": 15, "triggered_by": "auto"},
            {"order_id": 90003, "store_id": STORE_C["store_id"], "owner_cook_min": 30, "triggered_by": "auto"},
        ]
    }


@router.post("/merchant/cook-complete")
def demo_cook_complete():
    if state.merchant_stage != "COOKING":
        raise HTTPException(status_code=400, detail="조리 중인 주문이 없습니다.")

    state.merchant_stage = "COOKED"

    actual_min = 14
    predicted_min = state.owner_cook_min
    diff = predicted_min - actual_min

    feedback_message = None
    if diff >= 3:
        feedback_message = (
            f"오늘 요기요햄버거는 {predicted_min}분이라고 입력하셨는데, "
            f"실제로는 {actual_min}분 만에 끝나셨어요. "
            f"다음에는 조금 더 정확하게 입력해주시면 배차가 더 수월해질 거예요."
        )

    return {"order_id": 90001, "status": "COOKED", "feedback_message": feedback_message}


@router.get("/rider/offers")
def demo_rider_offers():
    if state.package_stage != "OFFERED":
        return {"rider_id": RIDER_ID, "offers": []}
    offer = _package_summary()
    offer["rider_text"] = _get_demo_explanations("COOKING")["rider_text"]
    return {"rider_id": RIDER_ID, "offers": [offer]}


@router.get("/rider/profile")
def demo_rider_profile():
    busy = state.package_stage in ("MATCHING", "IN_PROGRESS")
    return {"rider_id": RIDER_ID, "name": RIDER_NAME, "region": "강남", "status": "BUSY" if busy else "AVAILABLE",
            "completed_order_count": 12, "lat": RIDER_LAT, "lng": RIDER_LNG}


@router.get("/rider/packages")
def demo_rider_packages():
    if state.package_stage not in ("MATCHING", "IN_PROGRESS", "COMPLETED"):
        return {"rider_id": RIDER_ID, "current_lat": RIDER_LAT, "current_lng": RIDER_LNG, "packages": []}
    pkg = _package_summary()
    pkg["status"] = state.package_stage
    pkg["score_detail"] = SCORE_DETAIL
    pkg["rider_text"] = _get_demo_explanations("MATCHED")["rider_text"]
    return {"rider_id": RIDER_ID, "current_lat": RIDER_LAT, "current_lng": RIDER_LNG, "packages": [pkg]}


@router.put("/rider/package/{package_id}/accept")
def demo_accept(package_id: int):
    if package_id != PACKAGE_ID:
        raise HTTPException(status_code=404, detail="존재하지 않는 패키지입니다.")
    if state.package_stage != "OFFERED":
        raise HTTPException(status_code=409, detail="이미 다른 라이더가 수락했거나 존재하지 않는 패키지입니다.")
    state.package_stage = "MATCHING"
    _get_demo_explanations("MATCHED")
    return {"package_id": PACKAGE_ID, "rider_id": RIDER_ID, "status": "MATCHING"}


@router.get("/rider/next-stop")
def demo_next_stop():
    if state.package_stage not in ("MATCHING", "IN_PROGRESS"):
        return {"message": "아직 배정된 경로 없음"}
    stop = state.next_incomplete_stop()
    if not stop:
        return {"message": "모든 경로 완료"}
    return _stop_summary(stop)


@router.post("/rider/arrive")
def demo_arrive_stop():
    if state.package_stage not in ("MATCHING", "IN_PROGRESS"):
        raise HTTPException(status_code=400, detail="아직 배차가 확정되지 않았습니다.")

    stop = state.next_incomplete_stop()
    if not stop:
        raise HTTPException(status_code=400, detail="이미 모든 경로를 완료했습니다.")

    if stop["order_id"] == 90001 and stop["type"] == "pickup" and state.merchant_stage != "COOKED":
        raise HTTPException(status_code=409, detail="아직 조리가 완료되지 않았습니다.")

    state.package_stage = "IN_PROGRESS"
    if stop["type"] == "pickup":
        state.picked_up_order_ids.add(stop["order_id"])
    else:
        state.delivered_order_ids.add(stop["order_id"])

    next_stop = state.next_incomplete_stop()
    if not next_stop:
        state.package_stage = "COMPLETED"

    return {
        "completed": _stop_summary(stop),
        "next": _stop_summary(next_stop) if next_stop else None,
        "package_status": state.package_stage,
    }


@router.get("/stores")
def demo_stores():
    return {"count": 3, "stores": [STORE_A, STORE_B, STORE_C]}


@router.post("/reset")
def demo_reset_scenario():
    global STOP_SEQUENCE
    state.reset()
    STOP_SEQUENCE = [dict(s) for s in ORIGINAL_STOP_SEQUENCE]
    demo_explanations.clear()
    return {"step": 0}