from fastapi import APIRouter

router = APIRouter(prefix="/api/demo", tags=["demo"])

# 시연 진행 상태를 서버 메모리에 저장 (DB 필요 없음)
demo_state = {"step": 0}

SCENARIO = [
    # step 0: 아직 조리시작 전
    {
        "customer": {
            "order_id": 99001,
            "store_name": "요기요햄버거 강남점🍔",
            "status": "NEW",
            "menu_items": [{"menu": "치즈버거세트", "qty": 1, "price": 12000}],
        },
        "merchant_next": {"order_id": 99001, "menu_items": [{"menu": "치즈버거세트", "qty": 1, "price": 12000}]},
        "rider_offers": [],
    },
    # step 1: 조리시작 누른 직후
    {
        "customer": {
            "order_id": 99001,
            "store_name": "요기요햄버거 강남점🍔",
            "status": "COOKING",
            "menu_items": [{"menu": "치즈버거세트", "qty": 1, "price": 12000}],
        },
        "merchant_next": None,
        "rider_offers": [],
    },
    # step 2: 30초 후 배차 제안 뜬 것처럼
    {
        "customer": {
            "order_id": 99001,
            "store_name": "요기요햄버거 강남점🍔",
            "status": "COOKING",
            "menu_items": [{"menu": "치즈버거세트", "qty": 1, "price": 12000}],
        },
        "merchant_next": None,
        "rider_offers": [
            {
                "package_id": 88801,
                "package_type": "BUNDLE",
                "bundle_size": 3,
                "score": 52,
                "hourly_revenue": 22100,
                "order_ids": [99001, 99002, 99003],
            }
        ],
    },
    # step 3: 라이더 수락 후
    {
        "customer": {
            "order_id": 99001,
            "store_name": "요기요햄버거 강남점🍔",
            "status": "MATCHED",
            "menu_items": [{"menu": "치즈버거세트", "qty": 1, "price": 12000}],
            "rider_id": "rider_12",
        },
        "merchant_next": {"order_id": 99004, "menu_items": [{"menu": "정통도시락", "qty": 1, "price": 9000}]},
        "rider_offers": [],
    },
]


@router.get("/customer/order")
def demo_customer_order():
    """소비자 화면 - 5초마다 이거 호출하면 됨"""
    return SCENARIO[demo_state["step"]]["customer"]


@router.get("/merchant/next-to-cook")
def demo_merchant_next():
    """사장님 화면 - 5초마다 이거 호출하면 됨"""
    result = SCENARIO[demo_state["step"]]["merchant_next"]
    if result is None:
        return {"message": "지금은 조리 대기 주문 없음"}
    return result


@router.post("/merchant/cook-start")
def demo_cook_start():
    """사장님이 조리시작 버튼 누르면 호출 - 다음 단계로 진행"""
    demo_state["step"] = min(demo_state["step"] + 1, len(SCENARIO) - 1)
    return {"step": demo_state["step"]}


@router.get("/rider/offers")
def demo_rider_offers():
    """라이더 화면 - 5초마다 이거 호출하면 됨"""
    return {"offers": SCENARIO[demo_state["step"]]["rider_offers"]}


@router.post("/rider/accept")
def demo_rider_accept():
    """라이더가 수락 버튼 누르면 호출 - 다음 단계로 진행"""
    demo_state["step"] = min(demo_state["step"] + 1, len(SCENARIO) - 1)
    return {"step": demo_state["step"]}


@router.post("/reset")
def demo_reset_scenario():
    """시연 처음부터 다시 시작"""
    demo_state["step"] = 0
    return {"step": 0}