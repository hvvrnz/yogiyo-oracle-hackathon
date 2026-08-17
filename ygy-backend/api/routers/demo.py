from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/demo", tags=["demo"])

demo_state = {"step": 0}

STORE_A = {"store_id": 889, "name": "요기요햄버거 강남점🍔", "category": "버거", "region": "강남", "lat": 37.505486, "lng": 127.02069, "avg_delivery_eta_min": 35}
STORE_B = {"store_id": 894, "name": "정통도시락 강남점🍱", "category": "도시락", "region": "강남", "lat": 37.507781, "lng": 127.02166, "avg_delivery_eta_min": 45}
STORE_C = {"store_id": 815, "name": "프리미엄디저트 강남점🍮", "category": "디저트", "region": "강남", "lat": 37.506200, "lng": 127.02300, "avg_delivery_eta_min": 30}

DELIVERY_A = {"lat": 37.510200, "lng": 127.02550}
DELIVERY_B = {"lat": 37.512400, "lng": 127.02100}
DELIVERY_C = {"lat": 37.509800, "lng": 127.01900}

ORDER_A_MENU = [{"menu": "치즈버거세트", "qty": 1, "price": 12000}]
ORDER_B_MENU = [{"menu": "제육도시락", "qty": 1, "price": 9000}]
ORDER_C_MENU = [{"menu": "두바이쫀득쿠키 세트", "qty": 1, "price": 15000}]

PACKAGE_ID = 80001
RIDER_ID = "rider_12"
RIDER_NAME = "역주행금지마스터"
RIDER_LAT = 37.504000
RIDER_LNG = 127.019000

ROUTE_DETAIL = [
    {"order_id": 90002, "type": "pickup", "lat": STORE_B["lat"], "lng": STORE_B["lng"]},
    {"order_id": 90003, "type": "pickup", "lat": STORE_C["lat"], "lng": STORE_C["lng"]},
    {"order_id": 90001, "type": "pickup", "lat": STORE_A["lat"], "lng": STORE_A["lng"]},
    {"order_id": 90002, "type": "dropoff", "lat": DELIVERY_B["lat"], "lng": DELIVERY_B["lng"]},
    {"order_id": 90003, "type": "dropoff", "lat": DELIVERY_C["lat"], "lng": DELIVERY_C["lng"]},
    {"order_id": 90001, "type": "dropoff", "lat": DELIVERY_A["lat"], "lng": DELIVERY_A["lng"]},
]

SCORE_DETAIL = {
    "food_sitting_time": 2.3,
    "courier_wait_time": 4.1,
    "bag_time": 9.4,
    "total_time": 27.6,
    "timeline": [
        {"order_id": 90002, "type": "pickup", "move_time_min": 0.0, "arrival_time_min": 1.8,
         "owner_cook_min": 15, "predicted_cook_min": 15.2, "wait_min": 0, "food_sitting_min": 0, "bag_min": 0},
        {"order_id": 90003, "type": "pickup", "move_time_min": 1.2, "arrival_time_min": 3.0,
         "owner_cook_min": 18, "predicted_cook_min": 17.8, "wait_min": 0, "food_sitting_min": 0, "bag_min": 1.2},
        {"order_id": 90001, "type": "pickup", "move_time_min": 1.5, "arrival_time_min": 4.5,
         "owner_cook_min": 20, "predicted_cook_min": 20.5, "wait_min": 4.1, "food_sitting_min": 0, "bag_min": 2.7},
        {"order_id": 90002, "type": "dropoff", "move_time_min": 9.3, "arrival_time_min": 13.8,
         "owner_cook_min": None, "predicted_cook_min": None, "wait_min": 0, "food_sitting_min": 0, "bag_min": 10.8},
        {"order_id": 90003, "type": "dropoff", "move_time_min": 6.7, "arrival_time_min": 20.5,
         "owner_cook_min": None, "predicted_cook_min": None, "wait_min": 0, "food_sitting_min": 2.3, "bag_min": 17.5},
        {"order_id": 90001, "type": "dropoff", "move_time_min": 7.1, "arrival_time_min": 27.6,
         "owner_cook_min": None, "predicted_cook_min": None, "wait_min": 0, "food_sitting_min": 0, "bag_min": 23.1},
    ],
}

PACKAGE_SCORE = 41
PACKAGE_REVENUE = 11200
HOURLY_REVENUE = 24300

# step: 0=조리전, 1=조리중+제안뜸(한번에), 2=수락(MATCHED), 3=픽업완료, 4=배달완료


def _package_summary():
    return {
        "package_id": PACKAGE_ID, "package_type": "BUNDLE",
        "score": PACKAGE_SCORE, "package_revenue": PACKAGE_REVENUE, "hourly_revenue": HOURLY_REVENUE,
        "bundle_size": 3, "order_ids": [90001, 90002, 90003], "route_detail": ROUTE_DETAIL,
    }


def _customer_response():
    step = demo_state["step"]
    status_map = {0: "NEW", 1: "COOKING", 2: "MATCHED", 3: "PICKED_UP", 4: "DELIVERED"}
    return {
        "order_id": 90001, "store_name": STORE_A["name"],
        "store_lat": STORE_A["lat"], "store_lng": STORE_A["lng"],
        "delivery_lat": DELIVERY_A["lat"], "delivery_lng": DELIVERY_A["lng"],
        "menu_items": ORDER_A_MENU, "amount": 12000, "delivery_fee": 3000,
        "status": status_map[step],
        "package_id": PACKAGE_ID if step >= 1 else None,
        "rider_id": RIDER_ID if step >= 2 else None,
        "route_detail": ROUTE_DETAIL if step >= 2 else None,
        "score_detail": SCORE_DETAIL if step >= 2 else None,
        "eta_min": SCORE_DETAIL["total_time"] if step >= 2 else None,
    }


@router.get("/customer/order")
def demo_customer_order():
    return _customer_response()


@router.get("/merchant/next-to-cook")
def demo_merchant_next():
    if demo_state["step"] != 0:
        return {"message": "조리 대기 주문 없음"}
    return {"order_id": 90001, "menu_items": ORDER_A_MENU, "amount": 12000, "status": "NEW"}


@router.post("/merchant/cook-start")
def demo_cook_start():
    """
    조리시작 누르면, 889 + 강남 매장 894/815도 함께 자동 조리시작되고
    (실제 demo-trigger와 동일한 컨셉), 동시에 배차 제안까지 확정.
    """
    demo_state["step"] = 1
    return {
        "triggered": [
            {"order_id": 90001, "store_id": STORE_A["store_id"], "owner_cook_min": 30, "triggered_by": "user"},
            {"order_id": 90002, "store_id": STORE_B["store_id"], "owner_cook_min": 35, "triggered_by": "auto"},
            {"order_id": 90003, "store_id": STORE_C["store_id"], "owner_cook_min": 25, "triggered_by": "auto"},
        ]
    }


@router.get("/rider/offers")
def demo_rider_offers():
    """조리시작 전에는 항상 빈 목록. 조리시작 후에만 제안이 보임 (GET이라 상태를 안 바꿈)."""
    if demo_state["step"] < 1:
        return {"rider_id": RIDER_ID, "offers": []}
    if demo_state["step"] >= 2:
        return {"rider_id": RIDER_ID, "offers": []}  # 이미 수락됨, 더 이상 제안 아님
    return {"rider_id": RIDER_ID, "offers": [_package_summary()]}


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
    return {"rider_id": RIDER_ID, "current_lat": RIDER_LAT, "current_lng": RIDER_LNG, "packages": [pkg]}


@router.put("/rider/package/{package_id}/accept")
def demo_accept(package_id: int):
    if package_id != PACKAGE_ID:
        raise HTTPException(status_code=404, detail="존재하지 않는 패키지입니다.")
    if demo_state["step"] != 1:
        raise HTTPException(status_code=409, detail="이미 다른 라이더가 수락했거나 존재하지 않는 패키지입니다.")
    demo_state["step"] = 2
    return {"package_id": PACKAGE_ID, "rider_id": RIDER_ID, "status": "MATCHING"}


@router.put("/rider/package/{package_id}/pickup")
def demo_pickup(package_id: int):
    demo_state["step"] = 3
    return {"package_id": PACKAGE_ID, "status": "PICKED_UP"}


@router.put("/rider/package/{package_id}/complete")
def demo_complete(package_id: int):
    demo_state["step"] = 4
    return {"package_id": PACKAGE_ID, "status": "COMPLETED"}


@router.get("/stores")
def demo_stores():
    return {"count": 3, "stores": [STORE_A, STORE_B, STORE_C]}


@router.post("/reset")
def demo_reset_scenario():
    demo_state["step"] = 0
    return {"step": 0}