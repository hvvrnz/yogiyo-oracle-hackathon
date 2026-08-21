import time

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





# ─────────────────────────────────────
# 조리 시작 후 유입되는 신규 주문
# ─────────────────────────────────────

# 제공받은 패키지 데이터에는 order_id가 없으므로
# 데모에서 충돌하지 않는 ID를 사용한다.
PACKAGE_20826_ORDER_A_ID = 2082601
PACKAGE_20816_ORDER_A_ID = 2081601


# PACKAGE 20826 - 요기요햄버거 주문
PACKAGE_20826_ORDER_A_MENU = [
    {
        "menu": "새우버거세트",
        "qty": 1,
        "price": 11000,
    },
    {
        "menu": "너겟 4조각",
        "qty": 1,
        "price": 5000,
    },
]


# PACKAGE 20816 - 요기요햄버거 주문
PACKAGE_20816_ORDER_A_MENU = [
    {
        "menu": "치킨버거세트",
        "qty": 1,
        "price": 7000,
    },
]


PACKAGE_20826_MERCHANT_ORDER = {
    "order_id": PACKAGE_20826_ORDER_A_ID,
    "store_id": STORE_A["store_id"],
    "store_name": STORE_A["name"],
    "menu_items": PACKAGE_20826_ORDER_A_MENU,
    "amount": 16000,
    "delivery_fee": 3000,
    "status": "NEW",
    "owner_cook_min": 15,
    "package_id": None,
    "rider_id": None,
    "created_at": "2026-08-17 09:08:01.497473000",
}


PACKAGE_20816_MERCHANT_ORDER = {
    "order_id": PACKAGE_20816_ORDER_A_ID,
    "store_id": STORE_A["store_id"],
    "store_name": STORE_A["name"],
    "menu_items": PACKAGE_20816_ORDER_A_MENU,
    "amount": 7000,
    "delivery_fee": 3000,
    "status": "NEW",
    "owner_cook_min": 15,
    "package_id": None,
    "rider_id": None,
    "created_at": "2026-08-17 09:07:18.720477000",
}







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




# ─────────────────────────────────────
# PACKAGE 20826 데이터
# ─────────────────────────────────────

PACKAGE_20826_STORE_A = {
    "store_id": 889,
    "name": "요기요햄버거 강남점🍔",
    "category": "버거류",
    "region": "강남",
    "lat": 37.505486,
    "lng": 127.02069,
    "avg_delivery_eta_min": 28,
}

PACKAGE_20826_STORE_B = {
    "store_id": 844,
    "name": "장인우동 강남844점",
    "category": "면류",
    "region": "강남",
    "lat": 37.500064,
    "lng": 127.034504,
    "avg_delivery_eta_min": 43,
}

PACKAGE_20826_STORE_C = {
    "store_id": 815,
    "name": "프리미엄도시락 강남815점",
    "category": "완제품",
    "region": "강남",
    "lat": 37.493534,
    "lng": 127.020428,
    "avg_delivery_eta_min": 41,
}

PACKAGE_20826_DELIVERY_A = {
    "lat": 37.522702,
    "lng": 127.021673,
}

PACKAGE_20826_DELIVERY_B = {
    "lat": 37.524798,
    "lng": 127.027433,
}

PACKAGE_20826_DELIVERY_C = {
    "lat": 37.520615,
    "lng": 127.019962,
}


# ─────────────────────────────────────
# PACKAGE 20816 데이터
# ─────────────────────────────────────

PACKAGE_20816_STORE_A = {
    "store_id": 889,
    "name": "요기요햄버거 강남점🍔",
    "category": "버거류",
    "region": "강남",
    "lat": 37.505486,
    "lng": 127.02069,
    "avg_delivery_eta_min": 28,
}

PACKAGE_20816_STORE_B = {
    "store_id": 862,
    "name": "맛있는카페라떼 강남862점",
    "category": "음료_HOT",
    "region": "강남",
    "lat": 37.499871,
    "lng": 127.033495,
    "avg_delivery_eta_min": 20,
}

PACKAGE_20816_STORE_C = {
    "store_id": 839,
    "name": "쉐프의카푸치노 강남839점",
    "category": "음료_HOT",
    "region": "강남",
    "lat": 37.49683,
    "lng": 127.030656,
    "avg_delivery_eta_min": 41,
}

PACKAGE_20816_DELIVERY_A = {
    "lat": 37.49638,
    "lng": 127.013493,
}

PACKAGE_20816_DELIVERY_B = {
    "lat": 37.498053,
    "lng": 127.009474,
}

PACKAGE_20816_DELIVERY_C = {
    "lat": 37.496681,
    "lng": 127.003922,
}




PACKAGE_ID = 20865
PACKAGE_20826_REVENUE = 9000
PACKAGE_20816_REVENUE = 9000
PACKAGE_20826_ORDER_IDS = [
    2082601,
    2082602,
    2082603,
]

PACKAGE_20816_ORDER_IDS = [
    2081601,
    2081602,
    2081603,
]


# ─────────────────────────────────────
# PACKAGE 20826 방문 순서
# ─────────────────────────────────────

PACKAGE_20826_ROUTE = [
    {
        "sequence": 1,
        "order_id": 2082601,
        "type": "pickup",
        "label": PACKAGE_20826_STORE_A["name"],
        "lat": PACKAGE_20826_STORE_A["lat"],
        "lng": PACKAGE_20826_STORE_A["lng"],
    },
    {
        "sequence": 2,
        "order_id": 2082602,
        "type": "pickup",
        "label": PACKAGE_20826_STORE_B["name"],
        "lat": PACKAGE_20826_STORE_B["lat"],
        "lng": PACKAGE_20826_STORE_B["lng"],
    },
    {
        "sequence": 3,
        "order_id": 2082603,
        "type": "pickup",
        "label": PACKAGE_20826_STORE_C["name"],
        "lat": PACKAGE_20826_STORE_C["lat"],
        "lng": PACKAGE_20826_STORE_C["lng"],
    },
    {
        "sequence": 4,
        "order_id": 2082601,
        "type": "dropoff",
        "label": "고객 배송지 A",
        "lat": PACKAGE_20826_DELIVERY_A["lat"],
        "lng": PACKAGE_20826_DELIVERY_A["lng"],
    },
    {
        "sequence": 5,
        "order_id": 2082602,
        "type": "dropoff",
        "label": "고객 배송지 B",
        "lat": PACKAGE_20826_DELIVERY_B["lat"],
        "lng": PACKAGE_20826_DELIVERY_B["lng"],
    },
    {
        "sequence": 6,
        "order_id": 2082603,
        "type": "dropoff",
        "label": "고객 배송지 C",
        "lat": PACKAGE_20826_DELIVERY_C["lat"],
        "lng": PACKAGE_20826_DELIVERY_C["lng"],
    },
]


# ─────────────────────────────────────
# PACKAGE 20816 방문 순서
# ─────────────────────────────────────

PACKAGE_20816_ROUTE = [
    {
        "sequence": 1,
        "order_id": 2081601,
        "type": "pickup",
        "label": PACKAGE_20816_STORE_A["name"],
        "lat": PACKAGE_20816_STORE_A["lat"],
        "lng": PACKAGE_20816_STORE_A["lng"],
    },
    {
        "sequence": 2,
        "order_id": 2081602,
        "type": "pickup",
        "label": PACKAGE_20816_STORE_B["name"],
        "lat": PACKAGE_20816_STORE_B["lat"],
        "lng": PACKAGE_20816_STORE_B["lng"],
    },
    {
        "sequence": 3,
        "order_id": 2081603,
        "type": "pickup",
        "label": PACKAGE_20816_STORE_C["name"],
        "lat": PACKAGE_20816_STORE_C["lat"],
        "lng": PACKAGE_20816_STORE_C["lng"],
    },
    {
        "sequence": 4,
        "order_id": 2081601,
        "type": "dropoff",
        "label": "고객 배송지 A",
        "lat": PACKAGE_20816_DELIVERY_A["lat"],
        "lng": PACKAGE_20816_DELIVERY_A["lng"],
    },
    {
        "sequence": 5,
        "order_id": 2081602,
        "type": "dropoff",
        "label": "고객 배송지 B",
        "lat": PACKAGE_20816_DELIVERY_B["lat"],
        "lng": PACKAGE_20816_DELIVERY_B["lng"],
    },
    {
        "sequence": 6,
        "order_id": 2081603,
        "type": "dropoff",
        "label": "고객 배송지 C",
        "lat": PACKAGE_20816_DELIVERY_C["lat"],
        "lng": PACKAGE_20816_DELIVERY_C["lng"],
    },
]



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
        self.accepted_package_id = None
        self.owner_cook_min = 15
        self.cook_started_at = None
        self.extra_order_status = {
            PACKAGE_20826_ORDER_A_ID: "NEW",
            PACKAGE_20816_ORDER_A_ID: "NEW",
        }

        # 추가 주문 상태
        self.extra_order_cook_min = {
            PACKAGE_20826_ORDER_A_ID: 15,
            PACKAGE_20816_ORDER_A_ID: 15,
        }

        # 추가 패키지 상태
        self.extra_package_stage = {
            20826: "NONE",
            20816: "NONE",
        }

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
        package_id = self.accepted_package_id

        if package_id == PACKAGE_ID:
            route = STOP_SEQUENCE
        elif package_id == 20826:
            route = PACKAGE_20826_ROUTE
        elif package_id == 20816:
            route = PACKAGE_20816_ROUTE
        else:
            return None

        visited = self.visited_keys()

        for stop in route:
            key = f"{stop['order_id']}-{stop['type']}"

            if key not in visited:
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

def _current_package_stage():
    package_id = state.accepted_package_id

    if package_id == PACKAGE_ID:
        return state.package_stage

    if package_id in state.extra_package_stage:
        return state.extra_package_stage[
            package_id
        ]

    return None


def _set_current_package_stage(stage):
    package_id = state.accepted_package_id

    if package_id == PACKAGE_ID:
        state.package_stage = stage
        return

    if package_id in state.extra_package_stage:
        state.extra_package_stage[
            package_id
        ] = stage

def _seconds_since_cook_start():
    if state.cook_started_at is None:
        return 0.0

    return max(
        0.0,
        time.monotonic() - state.cook_started_at,
    )


def _seconds_since_cook_start():
    if state.cook_started_at is None:
        return 0.0

    return max(
        0.0,
        time.monotonic() - state.cook_started_at,
    )


def _merchant_extra_orders():
    if state.cook_started_at is None:
        return []

    elapsed = _seconds_since_cook_start()
    orders = []

    # 첫 주문 조리 시작 5초 후
    if elapsed >= 5:
        order = dict(
            PACKAGE_20826_MERCHANT_ORDER
        )

        order["status"] = (
            state.extra_order_status[
                PACKAGE_20826_ORDER_A_ID
            ]
        )

        order["owner_cook_min"] = (
            state.extra_order_cook_min[
                PACKAGE_20826_ORDER_A_ID
            ]
        )

        orders.append(order)

    # 다시 5초 뒤 = 최초 조리 시작 기준 10초
    if elapsed >= 10:
        order = dict(
            PACKAGE_20816_MERCHANT_ORDER
        )

        order["status"] = (
            state.extra_order_status[
                PACKAGE_20816_ORDER_A_ID
            ]
        )

        order["owner_cook_min"] = (
            state.extra_order_cook_min[
                PACKAGE_20816_ORDER_A_ID
            ]
        )

        orders.append(order)

    return orders



def _stop_summary(stop):
    return {"sequence": stop["sequence"], "order_id": stop["order_id"], "type": stop["type"], "label": stop["label"], "lat": stop["lat"], "lng": stop["lng"]}


def _route_with_visited(package_id=PACKAGE_ID):
    if package_id == PACKAGE_ID:
        route = STOP_SEQUENCE
    elif package_id == 20826:
        route = PACKAGE_20826_ROUTE
    elif package_id == 20816:
        route = PACKAGE_20816_ROUTE
    else:
        return []

    visited = state.visited_keys()
    result = []

    for stop in route:
        key = (
            f"{stop['order_id']}-"
            f"{stop['type']}"
        )

        item = dict(
            _stop_summary(stop)
        )

        item["visited"] = (
            key in visited
        )

        result.append(item)

    return result


def _package_summary():
    return {
        "package_id": PACKAGE_ID, "package_type": "BUNDLE",
        "score": PACKAGE_SCORE, "package_revenue": PACKAGE_REVENUE, "hourly_revenue": HOURLY_REVENUE,
        "bundle_size": 3, "order_ids": [43351, 44095, 44101],
        "route_detail": _route_with_visited(),
    }

def _extra_package_summary(package_id):
    if package_id == 20826:
        return {
            "package_id": 20826,
            "package_type": "BUNDLE",
            "score": None,
            "package_revenue":
                PACKAGE_20826_REVENUE,
            "hourly_revenue": 0,
            "bundle_size": 3,
            "order_ids":
                PACKAGE_20826_ORDER_IDS,
            "route_detail":
                _route_with_visited(20826),
            "rider_text": (
                "세 주문의 조리시간과 이동 동선을 "
                "함께 고려한 배차 제안입니다."
            ),
        }

    if package_id == 20816:
        return {
            "package_id": 20816,
            "package_type": "BUNDLE",
            "score": None,
            "package_revenue":
                PACKAGE_20816_REVENUE,
            "hourly_revenue": 0,
            "bundle_size": 3,
            "order_ids":
                PACKAGE_20816_ORDER_IDS,
            "route_detail":
                _route_with_visited(20816),
            "rider_text": (
                "세 주문의 조리시간과 이동 동선을 "
                "함께 고려한 배차 제안입니다."
            ),
        }

    raise ValueError(
        f"지원하지 않는 패키지: {package_id}"
    )


def _customer_order_config(package_id):
    if package_id == PACKAGE_ID:
        return {
            "order_id": 43351,
            "store": STORE_A,
            "delivery": DELIVERY_A,
            "delivery_address": DELIVERY_A["address"],
            "menu_items": ORDER_A_MENU,
            "amount": 20000,
            "owner_cook_min": state.owner_cook_min,
        }

    if package_id == 20826:
        return {
            "order_id": PACKAGE_20826_ORDER_A_ID,
            "store": PACKAGE_20826_STORE_A,
            "delivery": PACKAGE_20826_DELIVERY_A,
            "delivery_address": "고객 배송지 A",
            "menu_items": PACKAGE_20826_ORDER_A_MENU,
            "amount": 16000,
            "owner_cook_min":
                state.extra_order_cook_min[
                    PACKAGE_20826_ORDER_A_ID
                ],
        }

    if package_id == 20816:
        return {
            "order_id": PACKAGE_20816_ORDER_A_ID,
            "store": PACKAGE_20816_STORE_A,
            "delivery": PACKAGE_20816_DELIVERY_A,
            "delivery_address": "고객 배송지 A",
            "menu_items": PACKAGE_20816_ORDER_A_MENU,
            "amount": 7000,
            "owner_cook_min":
                state.extra_order_cook_min[
                    PACKAGE_20816_ORDER_A_ID
                ],
        }

    return None

def _customer_order_status(
    order_id,
    package_id,
):
    # 이미 배송 완료
    if order_id in state.delivered_order_ids:
        return "DELIVERED"

    # 현재 라이더가 수락한 패키지인지 확인
    is_accepted = (
        state.accepted_package_id
        == package_id
    )

    if is_accepted:
        stage = _current_package_stage()

        if stage in (
            "MATCHING",
            "IN_PROGRESS",
            "COMPLETED",
        ):
            if (
                order_id
                in state.picked_up_order_ids
            ):
                return "PICKED_UP"

            return "MATCHED"

    # 기존 대표 주문
    if order_id == 43351:
        if state.merchant_stage in (
            "COOKING",
            "COOKED",
        ):
            return "COOKING"

        return "NEW"

    # 신규 주문
    status = state.extra_order_status.get(
        order_id,
        "NEW",
    )

    if status == "COOKING":
        return "COOKING"

    return "NEW"


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

def _customer_config_for_package(package_id):
    if package_id == PACKAGE_ID:
        return {
            "package_id": PACKAGE_ID,
            "order_id": 43351,
            "store": STORE_A,
            "delivery": DELIVERY_A,
            "menu_items": ORDER_A_MENU,
            "amount": 20000,
        }

    if package_id == 20826:
        return {
            "package_id": 20826,
            "order_id": 2082601,
            "store": PACKAGE_20826_STORE_A,
            "delivery": PACKAGE_20826_DELIVERY_A,
            "menu_items": [
                {
                    "menu": "새우버거세트",
                    "qty": 1,
                    "price": 11000,
                },
                {
                    "menu": "너겟 4조각",
                    "qty": 1,
                    "price": 5000,
                },
            ],
            "amount": 16000,
        }

    if package_id == 20816:
        return {
            "package_id": 20816,
            "order_id": 2081601,
            "store": PACKAGE_20816_STORE_A,
            "delivery": PACKAGE_20816_DELIVERY_A,
            "menu_items": [
                {
                    "menu": "치킨버거세트",
                    "qty": 1,
                    "price": 7000,
                },
            ],
            "amount": 7000,
        }

    return None

def _customer_status_for_package(
    package_id,
    order_id,
):
    # 배달 완료
    if order_id in state.delivered_order_ids:
        return "DELIVERED"

    # 해당 주문 픽업 완료
    if order_id in state.picked_up_order_ids:
        return "PICKED_UP"

    # 라이더가 현재 이 패키지를 수락한 상태
    if (
        state.accepted_package_id == package_id
        and _current_package_stage()
        in (
            "MATCHING",
            "IN_PROGRESS",
            "COMPLETED",
        )
    ):
        return "MATCHED"

    # 기존 대표 주문
    if order_id == 43351:
        return state.order_status(order_id)

    # 추가 주문
    status = state.extra_order_status.get(
        order_id,
        "NEW",
    )

    if status == "COOKING":
        return "COOKING"

    return status

def _customer_response():
    # 라이더가 패키지를 수락한 경우
    # 해당 패키지 안의 요기요햄버거 주문 고객을 표시한다.
    package_id = (
        state.accepted_package_id
        if state.accepted_package_id is not None
        else PACKAGE_ID
    )

    config = _customer_config_for_package(
        package_id
    )

    if config is None:
        config = _customer_config_for_package(
            PACKAGE_ID
        )
        package_id = PACKAGE_ID

    order_id = config["order_id"]
    store = config["store"]
    delivery = config["delivery"]

    status = _customer_status_for_package(
        package_id,
        order_id,
    )

    assigned = (
        state.accepted_package_id
        == package_id
        and status
        in (
            "MATCHED",
            "PICKED_UP",
            "DELIVERED",
        )
    )

    consumer_text = None

    if status == "DELIVERED":
        consumer_text = (
            "배달이 완료됐어요. "
            "신선하게 받아보셨길 바라요!"
        )

    elif status in (
        "MATCHED",
        "PICKED_UP",
    ):
        consumer_text = (
            _get_demo_explanations(
                "MATCHED"
            )["consumer_text"]
        )

    # 기존 20865만 실제 SCORE_DETAIL이 있으므로
    # 신규 패키지 ETA는 임의 생성하지 않는다.
    eta_min = None

    if (
        package_id == PACKAGE_ID
        and status
        in (
            "MATCHED",
            "PICKED_UP",
        )
    ):
        eta_min = SCORE_DETAIL[
            "total_time"
        ]

    return {
        "order_id": order_id,

        "store_name": store["name"],
        "store_lat": store["lat"],
        "store_lng": store["lng"],

        "delivery_lat": delivery["lat"],
        "delivery_lng": delivery["lng"],

        # 신규 배송지는 좌표만 있으므로
        # address가 없을 경우 fallback
        "delivery_address": (
            delivery.get("address")
            or "고객 배송지"
        ),

        "menu_items":
            config["menu_items"],

        "amount":
            config["amount"],

        "delivery_fee": 3000,
        "payment": ORDER_A_PAYMENT,

        "status": status,

        "package_id": (
            package_id
            if assigned
            else None
        ),

        "rider_id": (
            RIDER_ID
            if assigned
            else None
        ),

        # 고객에게 현재 수락된 패키지 전체 동선 전달
        "route_detail": (
            _route_with_visited(
                package_id
            )
            if assigned
            else None
        ),

        "score_detail": (
            SCORE_DETAIL
            if (
                package_id == PACKAGE_ID
                and assigned
            )
            else None
        ),

        "eta_min": (
            None
            if status == "DELIVERED"
            else eta_min
        ),

        "consumer_text":
            consumer_text,
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




@router.get("/merchant/orders")
def demo_merchant_orders():
    orders = []

    # 기존 메인 주문
    primary_order = demo_merchant_next()

    if primary_order.get("order_id") is not None:
        orders.append(primary_order)

    # 조리 시작 5초 후부터 신규 주문 2건 추가
    orders.extend(
        _merchant_extra_orders()
    )

    return {
        "store_id": STORE_A["store_id"],
        "orders": orders,
        "merchant_text": primary_order.get(
            "merchant_text"
        ),
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
    order_id: int = 43351
    owner_cook_min: int = 20


@router.post("/merchant/cook-start")
def demo_cook_start(body: CookTimeInput):
    order_id = body.order_id
    owner_cook_min = body.owner_cook_min

    # ─────────────────────────────
    # 1. 최초 주문 #43351
    # ─────────────────────────────
    if order_id == 43351:
        state.owner_cook_min = owner_cook_min
        state.merchant_stage = "COOKING"

        # 기존 패키지 20865 배차 제안 생성
        state.package_stage = "OFFERED"

        # 최초 조리 시작 때 단 한 번만 타이머 시작
        if state.cook_started_at is None:
            state.cook_started_at = time.monotonic()

        _get_demo_explanations("COOKING")

        return {
            "order_id": 43351,
            "status": "COOKING",
            "package_id": 20865,
            "package_status": "OFFERED",
        }

    # ─────────────────────────────
    # 2. PACKAGE 20826의 햄버거 주문
    # ─────────────────────────────
    if order_id == PACKAGE_20826_ORDER_A_ID:
        if (
            state.cook_started_at is None
            or _seconds_since_cook_start() < 5
        ):
            raise HTTPException(
                status_code=404,
                detail="아직 유입되지 않은 주문입니다.",
            )

        state.extra_order_status[
            order_id
        ] = "COOKING"

        state.extra_order_cook_min[
            order_id
        ] = owner_cook_min

        # 조리 시작 순간 PACKAGE 20826 제안 생성
        state.extra_package_stage[
            20826
        ] = "OFFERED"

        return {
            "order_id": order_id,
            "status": "COOKING",
            "package_id": 20826,
            "package_status": "OFFERED",
        }

    # ─────────────────────────────
    # 3. PACKAGE 20816의 햄버거 주문
    # ─────────────────────────────
    if order_id == PACKAGE_20816_ORDER_A_ID:
        if (
            state.cook_started_at is None
            or _seconds_since_cook_start() < 10
        ):
            raise HTTPException(
                status_code=404,
                detail="아직 유입되지 않은 주문입니다.",
            )

        state.extra_order_status[
            order_id
        ] = "COOKING"

        state.extra_order_cook_min[
            order_id
        ] = owner_cook_min

        # 조리 시작 순간 PACKAGE 20816 제안 생성
        state.extra_package_stage[
            20816
        ] = "OFFERED"

        return {
            "order_id": order_id,
            "status": "COOKING",
            "package_id": 20816,
            "package_status": "OFFERED",
        }

    raise HTTPException(
        status_code=404,
        detail="존재하지 않는 주문입니다.",
    )

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
    offers = []

    # 기존 PACKAGE 20865
    if state.package_stage == "OFFERED":
        offer = _package_summary()

        offer["rider_text"] = (
            _get_demo_explanations(
                "COOKING"
            )["rider_text"]
        )

        offers.append(offer)

    # PACKAGE 20826
    if (
        state.extra_package_stage[
            20826
        ] == "OFFERED"
    ):
        offers.append(
            _extra_package_summary(20826)
        )

    # PACKAGE 20816
    if (
        state.extra_package_stage[
            20816
        ] == "OFFERED"
    ):
        offers.append(
            _extra_package_summary(20816)
        )

    return {
        "rider_id": RIDER_ID,
        "offers": offers,
    }


@router.get("/rider/profile")
def demo_rider_profile():
    busy = (    _current_package_stage()    in ("MATCHING", "IN_PROGRESS"))
    return {"rider_id": RIDER_ID, "name": RIDER_NAME, "region": "강남", "status": "BUSY" if busy else "AVAILABLE",
            "completed_order_count": 12, "lat": RIDER_LAT, "lng": RIDER_LNG}


@router.get("/rider/packages")
def demo_rider_packages():
    package_id = (
        state.accepted_package_id
    )

    if package_id is None:
        return {
            "rider_id": RIDER_ID,
            "current_lat": RIDER_LAT,
            "current_lng": RIDER_LNG,
            "packages": [],
        }

    stage = _current_package_stage()

    if stage not in (
        "MATCHING",
        "IN_PROGRESS",
        "COMPLETED",
    ):
        return {
            "rider_id": RIDER_ID,
            "current_lat": RIDER_LAT,
            "current_lng": RIDER_LNG,
            "packages": [],
        }

    if package_id == PACKAGE_ID:
        pkg = _package_summary()

        pkg["score_detail"] = (
            SCORE_DETAIL
        )

        pkg["rider_text"] = (
            _get_demo_explanations(
                "MATCHED"
            )["rider_text"]
        )

    else:
        pkg = _extra_package_summary(
            package_id
        )

    pkg["status"] = stage

    return {
        "rider_id": RIDER_ID,
        "current_lat": RIDER_LAT,
        "current_lng": RIDER_LNG,
        "packages": [pkg],
    }

    pkg["status"] = state.package_stage
    pkg["score_detail"] = SCORE_DETAIL
    pkg["rider_text"] = _get_demo_explanations("MATCHED")["rider_text"]
    return {"rider_id": RIDER_ID, "current_lat": RIDER_LAT, "current_lng": RIDER_LNG, "packages": [pkg]}


@router.put("/rider/package/{package_id}/accept")
def demo_accept(package_id: int):

    # 이미 운행 중인 패키지가 있는 경우
    if state.accepted_package_id is not None:
        raise HTTPException(
            status_code=409,
            detail="이미 운행 중인 패키지가 있습니다.",
        )

    # ─────────────────────────────
    # 기존 PACKAGE 20865
    # ─────────────────────────────
    if package_id == PACKAGE_ID:

        if state.package_stage != "OFFERED":
            raise HTTPException(
                status_code=409,
                detail=(
                    "이미 다른 라이더가 수락했거나 "
                    "존재하지 않는 패키지입니다."
                ),
            )

        state.package_stage = "MATCHING"

        _get_demo_explanations(
            "MATCHED"
        )

    # ─────────────────────────────
    # 추가 PACKAGE 20826 / 20816
    # ─────────────────────────────
    elif package_id in state.extra_package_stage:

        if (
            state.extra_package_stage[
                package_id
            ] != "OFFERED"
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "이미 다른 라이더가 수락했거나 "
                    "존재하지 않는 패키지입니다."
                ),
            )

        state.extra_package_stage[
            package_id
        ] = "MATCHING"

    else:
        raise HTTPException(
            status_code=404,
            detail="존재하지 않는 패키지입니다.",
        )

    state.accepted_package_id = package_id

    return {
        "package_id": package_id,
        "rider_id": RIDER_ID,
        "status": "MATCHING",
    }

@router.get("/rider/next-stop")
def demo_next_stop():
    if _current_package_stage() not in (
        "MATCHING",
        "IN_PROGRESS",
    ):
        return {
            "message": "아직 배정된 경로 없음"
        }

    stop = state.next_incomplete_stop()

    if not stop:
        return {
            "message": "모든 경로 완료"
        }

    return _stop_summary(stop)


@router.post("/rider/arrive")
def demo_arrive_stop():
    if _current_package_stage() not in ("MATCHING", "IN_PROGRESS",):
        raise HTTPException(status_code=400, detail="아직 배차가 확정되지 않았습니다.")

    stop = state.next_incomplete_stop()
    if not stop:
        raise HTTPException(status_code=400, detail="이미 모든 경로를 완료했습니다.")

    if stop["order_id"] == 43351 and stop["type"] == "pickup" and state.merchant_stage != "COOKED":
        raise HTTPException(status_code=409, detail="아직 조리가 완료되지 않았습니다.")

    _set_current_package_stage(
            "IN_PROGRESS"
        )
    if stop["type"] == "pickup":
        state.picked_up_order_ids.add(stop["order_id"])
    else:
        state.delivered_order_ids.add(stop["order_id"])

    next_stop = state.next_incomplete_stop()
    if not next_stop:
        _set_current_package_stage(  "COMPLETED"    )

    return {
        "completed": _stop_summary(stop),
        "next": _stop_summary(next_stop) if next_stop else None,
        "package_status":    _current_package_stage(),
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

