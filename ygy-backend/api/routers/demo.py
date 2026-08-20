from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/demo", tags=["demo"])

demo_explanations = {}

# ── 매장 3개 ──
STORE_A = {"store_id": 889, "name": "요기요햄버거🍔 강남점", "category": "버거류", "region": "강남", "lat": 37.505486, "lng": 127.02069, "avg_delivery_eta_min": 35}
STORE_B = {"store_id": 440, "name": "수제에그샌드위치🥪 강남점", "category": "샌드위치", "region": "강남", "lat": 37.501202, "lng": 127.018949, "avg_delivery_eta_min": 25}
STORE_C = {"store_id": 442, "name": "전통모듬초밥🍣 강남점", "category": "초밥_회류", "region": "강남", "lat": 37.494788, "lng": 127.018567, "avg_delivery_eta_min": 30}

DELIVERY_A = {"lat": 37.516573, "lng": 127.013466, "address": "서울 강남구 89 반포훼밀리 101동"}
DELIVERY_B = {"lat": 37.512848, "lng": 127.010281, "address": "서울 강남구 40 신사빌라 3층"}
DELIVERY_C = {"lat": 37.5196, "lng": 127.006504, "address": "반포한강공원 배달픽업지 A"}

ORDER_A_MENU = [
    {"menu": "치킨버거세트", "qty": 1, "price": 11000},
    {"menu": "너겟 4조각", "qty": 1, "price": 4000},
    {"menu": "콜라", "qty": 1, "price": 5000},
]
ORDER_B_MENU = [{"menu": "클럽샌드위치", "qty": 1, "price": 6000}]
ORDER_C_MENU = [
    {"menu": "연어초밥세트", "qty": 1, "price": 20000},
    {"menu": "미소국", "qty": 2, "price": 4000},
    {"menu": "단무지 추가", "qty": 2, "price": 5000},
    {"menu": "락교", "qty": 1, "price": 4000},
]

ORDER_A_PAYMENT = {
    "product_amount": 20000,
    "delivery_fee": 3000,
    "total_amount": 23000,
    "payment_method": "카카오페이",
    "safety_number": "050-1234-5678",
    "cash_receipt": "신청 안 함",
}

ORDER_A_CUSTOMER_REQUEST = "(수저/포크O) 케찹은 꼭 넣어주세요."
ORDER_A_RIDER_REQUEST = "벨 x"


PACKAGE_ID = 20865
RIDER_ID = "rider_249"
RIDER_NAME = "안전주행라이더"  # 실제 이름 확인되면 교체
RIDER_LAT = 37.504000
RIDER_LNG = 127.019000

PACKAGE_SCORE = 51
PACKAGE_REVENUE = 10500
HOURLY_REVENUE = 24000

ORIGINAL_STOP_SEQUENCE = [
    {"sequence": 1, "order_id": 44095, "type": "pickup", "label": STORE_B["name"], "lat": STORE_B["lat"], "lng": STORE_B["lng"]},
    {"sequence": 2, "order_id": 44095, "type": "dropoff", "label": DELIVERY_B["address"], "lat": DELIVERY_B["lat"], "lng": DELIVERY_B["lng"]},
    {"sequence": 3, "order_id": 44101, "type": "pickup", "label": STORE_C["name"], "lat": STORE_C["lat"], "lng": STORE_C["lng"]},
    {"sequence": 4, "order_id": 43351, "type": "pickup", "label": STORE_A["name"], "lat": STORE_A["lat"], "lng": STORE_A["lng"]},
    {"sequence": 5, "order_id": 43351, "type": "dropoff", "label": DELIVERY_A["address"], "lat": DELIVERY_A["lat"], "lng": DELIVERY_A["lng"]},
    {"sequence": 6, "order_id": 44101, "type": "dropoff", "label": DELIVERY_C["address"], "lat": DELIVERY_C["lat"], "lng": DELIVERY_C["lng"]},
]
STOP_SEQUENCE = [dict(s) for s in ORIGINAL_STOP_SEQUENCE]

SCORE_DETAIL = {
    "food_sitting_time": 0.9, "courier_wait_time": 4.6, "bag_time": 19.0, "total_time": 26.3,
    "timeline": [
        {"order_id": 44095, "type": "pickup", "move_time_min": 0.9, "arrival_time_min": 0.9,
         "owner_cook_min": 5, "predicted_cook_min": 5.0, "wait_min": 4.1, "food_sitting_min": 0, "bag_min": 0},
        {"order_id": 44095, "type": "dropoff", "move_time_min": 4.5, "arrival_time_min": 9.5,
         "owner_cook_min": None, "predicted_cook_min": None, "wait_min": 0, "food_sitting_min": 0, "bag_min": 4.5},
        {"order_id": 44101, "type": "pickup", "move_time_min": 6.4, "arrival_time_min": 15.9,
         "owner_cook_min": 15, "predicted_cook_min": 15.0, "wait_min": 0, "food_sitting_min": 0.9, "bag_min": 0},
        {"order_id": 43351, "type": "pickup", "move_time_min": 3.6, "arrival_time_min": 19.5,
         "owner_cook_min": 20, "predicted_cook_min": 20.0, "wait_min": 0.5, "food_sitting_min": 0, "bag_min": 0},
        {"order_id": 43351, "type": "dropoff", "move_time_min": 4.2, "arrival_time_min": 24.2,
         "owner_cook_min": None, "predicted_cook_min": None, "wait_min": 0, "food_sitting_min": 0, "bag_min": 4.2},
        {"order_id": 44101, "type": "dropoff", "move_time_min": 2.1, "arrival_time_min": 26.3,
         "owner_cook_min": None, "predicted_cook_min": None, "wait_min": 0, "food_sitting_min": 0, "bag_min": 10.3},
    ],
}

COLD_START_REFERENCE = {
    "reference_type": "cold_start",
    "fallback_level": 1,
    "matched_store_id": 306,
    "matched_store_name": "버거퀸 강남점🍔",
    "recent_case_count": 10,
    "avg_cook_min": 14.1,
    "weekday": "금",
    "time_slot": "저녁",
    "concurrent_order_count": 3,
    "similar_cases": [
        {"store_name": "버거퀸 강남점🍔", "actual_cook_min": 13.3, "distance": 0.1765, "weekday": "금", "time_slot": "저녁"},
        {"store_name": "버거퀸 강남점🍔", "actual_cook_min": 13.4, "distance": 0.1841, "weekday": "금", "time_slot": "저녁"},
        {"store_name": "버거퀸 강남점🍔", "actual_cook_min": 15.7, "distance": 0.1933, "weekday": "금", "time_slot": "저녁"},
    ],
    "description": (
        "강남 지역의 같은 버거류 매장 중 "
        "유사한 조리 사례를 참고했습니다."
    ),
}
# NOTE: COLD_START_REFERENCE는 아직 실제 재검증 전 값입니다.
# 889번 매장 기준 fallback 스크립트를 다시 돌려서 나온 실측값으로 교체 예정.

DEMO_DISPATCH_CANDIDATES = {
    "title": "배차 엔진 분석 결과",
    "subtitle": "실제 배차 엔진(package_id 20865)이 산출한 결과입니다.",
    "formula": (
    "각 경로의 음식방치시간(food_sitting) · 라이더대기시간(courier_wait) · "
    "가방체류시간(bag_time) · 총수행시간(total_time)을 모두 '분' 단위로 환산해 더합니다. "
    "가중치는 현재 구현에서 모두 동일하게 1.0으로 두었습니다. "
    "이 계산에 들어가는 조리시간 예측값은 클러스터링 단계에서 쓰는 remaining_cook_time과 "
    "같은 계열의 예측 로직(사장님 입력 + correction_factor)을 그대로 참조합니다."
    ),
    "worked_example": {
        "title": "이 패키지의 실제 점수 계산",
        "rows": [
            ["food_sitting_time", "0.9분", "× 1.0", "0.9"],
            ["courier_wait_time", "4.6분", "× 1.0", "4.6"],
            ["bag_time", "19.0분", "× 1.0", "19.0"],
            ["total_time", "26.3분", "× 1.0", "26.3"],
        ],
        "total": "score = 0.9 + 4.6 + 19.0 + 26.3 = 50.8 → 실제 저장값 51점(반올림)",
    },
    "candidates": [
        {
            "label": "선택된 경로", "selected": True,
            "items": ["🥪 수제에그샌드위치 5분", "🍔 요기요햄버거 20분", "🍣 전통모듬초밥 15분"],
            "route_text": "샌드위치 P → 샌드위치 D → 초밥 P → 버거 P → 버거 D → 초밥 D",
            "wait_min": 4.6, "sitting_min": 0.9, "total_min": 26.3,
        },
    ],
    "insight": "샌드위치+초밥 픽업까지 걸린 19.5분이 버거의 20분 조리시간과 거의 일치 — 픽업 대기 0.5분",
}

WARM_STORE_REFERENCE = {
    "reference_type": "own_history",
    "recent_case_count": 42,
    "avg_cook_min": 12.8,
    "correction_factor": 1.05,
}


@router.get("/dispatch/candidates")
def demo_dispatch_candidates():
    return DEMO_DISPATCH_CANDIDATES


class DemoState:
    def __init__(self):
        self.reset()

    def reset(self):
        self.merchant_stage = "NEW"
        self.package_stage = "NONE"
        self.owner_cook_min = 15
        self.cook_started_at = None
        
        self.cook_feedback = None
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
        "bundle_size": 3, "order_ids": [43351, 44095, 44101],
        "route_detail": _route_with_visited(),
    }


def _demo_orders():
    return [
        {"order_id": 43351, "store_name": STORE_A["name"], "status": "COOKING", "owner_cook_min": state.owner_cook_min, "predicted_cook_min": 20},
        {"order_id": 44095, "store_name": STORE_B["name"], "status": "COOKING", "owner_cook_min": 5, "predicted_cook_min": 5},
        {"order_id": 44101, "store_name": STORE_C["name"], "status": "COOKING", "owner_cook_min": 15, "predicted_cook_min": 15},
    ]


def _demo_explanation_context(explanation_stage):
    customer_order = {
        "order_id": 43351, "store_name": STORE_A["name"],
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


def _customer_response(order_id=43351, store=STORE_A, menu=ORDER_A_MENU, amount=20000, delivery=DELIVERY_A):
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
        "payment": ORDER_A_PAYMENT,
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
        return {
            "order_id": 43351,
            "menu_items": ORDER_A_MENU,
            "amount": 20000,
            "status": "NEW",
            "customer_request": ORDER_A_CUSTOMER_REQUEST,
            "rider_request": ORDER_A_RIDER_REQUEST,
            "payment": ORDER_A_PAYMENT,
            "cook_reference": COLD_START_REFERENCE,
        }

    if state.merchant_stage == "COOKING":
        return {
            "order_id": 43351,
            "menu_items": ORDER_A_MENU,
            "amount": 20000,
            "status": "COOKING",
            "owner_cook_min": state.owner_cook_min,
            "customer_request": ORDER_A_CUSTOMER_REQUEST,
            "rider_request": ORDER_A_RIDER_REQUEST,
            "payment": ORDER_A_PAYMENT,
            "merchant_text": _get_demo_explanations("COOKING")["merchant_text"],
        }

    # merchant_stage == "COOKED" — 조리완료는 눌렀고, 그 이후 상태(라이더 배정/픽업/배달)만 직접 판정
    if 43351 in state.delivered_order_ids:
        display_status = "DELIVERED"
    elif 43351 in state.picked_up_order_ids:
        display_status = "PICKED_UP"
    elif state.package_stage in ("MATCHING", "IN_PROGRESS"):
        display_status = "MATCHED"
    else:
        display_status = "COOKED"

    return {
        "order_id": 43351,
        "menu_items": ORDER_A_MENU,
        "amount": 20000,
        "status": display_status,
        "owner_cook_min": state.owner_cook_min,
        "payment": ORDER_A_PAYMENT,
        "cook_feedback": state.cook_feedback,
    }


@router.get("/merchant/completed")
def demo_merchant_completed():
    if state.merchant_stage == "COOKED" and 43351 in state.delivered_order_ids:
        return {"orders": [{
            "order_id": 43351,
            "menu_items": ORDER_A_MENU,
            "amount": 20000,
            "status": "DELIVERED",
            "cook_feedback": state.cook_feedback,   # ← 이거 추가
            "payment": ORDER_A_PAYMENT,               # ← 결제정보도 같이
        }]}
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
            {"order_id": 43351, "store_id": STORE_A["store_id"], "owner_cook_min": body.owner_cook_min, "triggered_by": "user"},
            {"order_id": 44095, "store_id": STORE_B["store_id"], "owner_cook_min": 5, "triggered_by": "auto"},
            {"order_id": 44101, "store_id": STORE_C["store_id"], "owner_cook_min": 15, "triggered_by": "auto"},
        ]
    }


@router.post("/merchant/cook-complete")
def demo_cook_complete():

    if state.merchant_stage != "COOKING":
        raise HTTPException(
            status_code=400,
            detail="조리 중인 주문이 없습니다."
        )

    state.merchant_stage = "COOKED"

    actual_min = 14
    owner_min = state.owner_cook_min

    diff_min = actual_min - owner_min

    if diff_min < 0:
        result_title = (
            f"예상보다 {abs(diff_min)}분 "
            "빨리 끝났어요."
        )

    elif diff_min > 0:
        result_title = (
            f"예상보다 {diff_min}분 "
            "더 걸렸어요."
        )

    else:
        result_title = (
            "입력한 시간과 실제 조리시간이 "
            "정확히 맞았어요."
        )

    feedback = {
        "owner_cook_min": owner_min,
        "actual_cook_min": actual_min,
        "difference_min": diff_min,

        "title": result_title,

        "message": (
            f"오늘 요기요햄버거는 "
            f"{owner_min}분으로 입력하셨고, "
            f"실제로는 {actual_min}분 만에 "
            "조리가 끝났어요."
        ),

        "learning_message": (
            "이번 차이는 다음 조리시간을 "
            "더 정확하게 판단하는 데 활용할 수 있는 "
            "실측 데이터예요."
        ),
    }

    state.cook_feedback = feedback

    return {
        "order_id": 43351,
        "status": "COOKED",

        "owner_cook_min": owner_min,
        "actual_cook_min": actual_min,
        "difference_min": diff_min,

        "feedback_message":
            feedback["message"],

        "cook_feedback":
            feedback,
        "payment": ORDER_A_PAYMENT
    }


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

    if stop["order_id"] == 43351 and stop["type"] == "pickup" and state.merchant_stage != "COOKED":
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