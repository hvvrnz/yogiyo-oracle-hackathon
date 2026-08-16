from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.connection import execute_and_commit, fetch_all,  fetch_one
import random

router = APIRouter(prefix="/api/merchant", tags=["merchant"])

# 시연용 매장 3개
DEMO_STORE_IDS = [889, 894, 884]
class DemoTriggerRequest(BaseModel):
    primary_store_id: int
    primary_order_id: int
    owner_cook_min: int


@router.get("/{store_id}")
def get_store_orders(store_id: int):
    """특정 매장의 최근 주문 목록과, 배차된 라이더 정보 조회."""
    orders = fetch_all("""
        SELECT o.order_id, o.menu_items, o.amount, o.status,
               o.owner_cook_min, o.predicted_cook_min, o.package_id,
               p.route_detail, p.rider_id
        FROM orders o
        LEFT JOIN packages p ON o.package_id = p.package_id
        WHERE o.store_id = :store_id
        ORDER BY o.created_at DESC
        FETCH FIRST 20 ROWS ONLY
    """, {"store_id": store_id})

    if not orders:
        raise HTTPException(status_code=404, detail="해당 매장의 주문 내역이 없습니다.")

    return {"store_id": store_id, "orders": orders}


class CookTimeUpdate(BaseModel):
    owner_cook_min: int


@router.put("/orders/{order_id}/cook-time")
def start_cooking(order_id: int, body: CookTimeUpdate):
    """
    사장님이 '조리시작' 버튼을 누르면서 조리시간을 입력.
    이 순간부터 이 주문이 배차 대상(COOKING)이 됨.
    """
    row_count = execute_and_commit(
        "UPDATE orders SET owner_cook_min = :cook_min, status = 'COOKING' WHERE order_id = :order_id",
        {"cook_min": body.owner_cook_min, "order_id": order_id}
    )
    if row_count == 0:
        raise HTTPException(status_code=404, detail="해당 주문을 찾을 수 없습니다.")

    return {"order_id": order_id, "status": "COOKING", "owner_cook_min": body.owner_cook_min}

@router.post("/demo-trigger")
def demo_trigger(body: DemoTriggerRequest):
    """
    시연용: 화면에 보이는 매장(primary)의 조리시작을 누르면,
    나머지 시연용 매장들도 백그라운드에서 자동으로 조리시작되어
    묶음배달이 자연스럽게 생성되도록 함.
    """
    results = []

    # 1. 화면에서 실제로 누른 매장 처리
    execute_and_commit(
        "UPDATE orders SET owner_cook_min = :cook_min, status = 'COOKING' WHERE order_id = :order_id",
        {"cook_min": body.owner_cook_min, "order_id": body.primary_order_id}
    )
    results.append({"order_id": body.primary_order_id, "store_id": body.primary_store_id,
                     "owner_cook_min": body.owner_cook_min, "triggered_by": "user"})

    # 2. 나머지 시연용 매장들 백그라운드 자동 트리거
    other_store_ids = [sid for sid in DEMO_STORE_IDS if sid != body.primary_store_id]

    for store_id in other_store_ids:
        order = fetch_one("""
            SELECT order_id FROM orders
            WHERE store_id = :store_id AND status = 'NEW'
            ORDER BY order_id DESC
            FETCH FIRST 1 ROW ONLY
        """, {"store_id": store_id})

        if order:
            cook_min = random.choice([5, 10, 15, 20, 25, 30, 35, 40, 45])
            execute_and_commit(
                "UPDATE orders SET owner_cook_min = :cook_min, status = 'COOKING' WHERE order_id = :order_id",
                {"cook_min": cook_min, "order_id": order["order_id"]}
            )
            results.append({"order_id": order["order_id"], "store_id": store_id,
                             "owner_cook_min": cook_min, "triggered_by": "auto"})

    return {"triggered": results}