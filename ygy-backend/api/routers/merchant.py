import random
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.connection import execute_and_commit, fetch_all, fetch_one
from common.config import DEMO_GANGNAM_POOL

router = APIRouter(prefix="/api/merchant", tags=["merchant"])


@router.get("/next-to-cook")
def get_next_order_to_cook():
    """
    사장님 화면 최초 진입 시 보여줄 단건.
    889의 가장 오래된 NEW 상태 주문. 소비자 화면(demo/active)이
    추적하는 것과 항상 같은 주문이 되도록 동일한 정렬 기준 사용.
    """
    order = fetch_one("""
        SELECT order_id, menu_items, amount, status FROM orders
        WHERE store_id = 889 AND status = 'NEW'
        ORDER BY order_id ASC
        FETCH FIRST 1 ROW ONLY
    """)
    if not order:
        raise HTTPException(status_code=404, detail="조리 대기 중인 주문이 없습니다.")
    return order


@router.get("/pending-list")
def get_pending_orders_list():
    """
    라이더가 accept를 완료한 직후, 사장님 화면에 '다음 대기 주문들'을
    와르르 보여주기 위한 목록. 889에 남은 NEW 상태 주문 전체.
    """
    orders = fetch_all("""
        SELECT order_id, menu_items, amount, status FROM orders
        WHERE store_id = 889 AND status = 'NEW'
        ORDER BY order_id ASC
    """)
    return {"count": len(orders), "orders": orders}

@router.get("/current-order")
def get_current_order():
    """
    시연용 889 매장의 현재 진행 중인 주문.
    COOKING 상태부터 라이더 배차 완료(MATCHED)까지 계속 조회.
    """

    order = fetch_one("""
        SELECT
            o.order_id,
            o.menu_items,
            o.amount,
            o.status,
            o.owner_cook_min,
            o.predicted_cook_min,
            o.package_id,

            p.status AS package_status,
            p.rider_id,
            p.route_detail,
            p.package_revenue,
            p.hourly_revenue

        FROM orders o
        LEFT JOIN packages p
            ON o.package_id = p.package_id

        WHERE o.store_id = 889
          AND o.status IN ('COOKING', 'MATCHED')

        ORDER BY o.order_id DESC
        FETCH FIRST 1 ROW ONLY
    """)

    if not order:
        raise HTTPException(
            status_code=404,
            detail="현재 진행 중인 주문이 없습니다."
        )

    return order


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
        FETCH FIRST 5 ROWS ONLY
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


class DemoTriggerRequest(BaseModel):
    primary_store_id: int
    primary_order_id: int
    owner_cook_min: int


@router.post("/demo-trigger")
def demo_trigger(body: DemoTriggerRequest):
    from db.connection import get_connection

    conn = get_connection()
    cursor = conn.cursor()
    results = []

    cursor.execute(
        "UPDATE orders SET owner_cook_min = :cook_min, status = 'COOKING' WHERE order_id = :order_id",
        {"cook_min": body.owner_cook_min, "order_id": body.primary_order_id}
    )
    results.append({"order_id": body.primary_order_id, "store_id": body.primary_store_id,
                     "owner_cook_min": body.owner_cook_min, "triggered_by": "user"})

    # 강남 풀 전체(889 제외)에서 각 매장당 최대 2건씩 자동 트리거
    other_store_ids = [sid for sid in DEMO_GANGNAM_POOL if sid != body.primary_store_id]

    for store_id in other_store_ids:
        cursor.execute("""
            SELECT order_id FROM orders
            WHERE store_id = :store_id AND status = 'NEW'
            ORDER BY order_id DESC
            FETCH FIRST 2 ROWS ONLY
        """, {"store_id": store_id})
        rows = cursor.fetchall()

        for row in rows:
            order_id = row[0]
            cook_min = max(5, body.owner_cook_min + random.choice([-5, 0, 5]))
            cursor.execute(
                "UPDATE orders SET owner_cook_min = :cook_min, status = 'COOKING' WHERE order_id = :order_id",
                {"cook_min": cook_min, "order_id": order_id}
            )
            results.append({"order_id": order_id, "store_id": store_id,
                             "owner_cook_min": cook_min, "triggered_by": "auto"})

    conn.commit()
    cursor.close()
    conn.close()

    return {"triggered": results}


@router.post("/demo-reset")
def demo_reset():
    """
    시연 재시작용: orders/packages 비우고, 시연용 라이더 8명의
    Redis 상태도 AVAILABLE로 초기화.
    """
    execute_and_commit("DELETE FROM orders")
    execute_and_commit("DELETE FROM packages")

    import redis
    from common.dummy.riders import DUMMY_RIDERS
    r = redis.Redis(host='localhost', port=6379, decode_responses=True)
    cleared = 0
    for rider in DUMMY_RIDERS:
        if r.delete(f"rider:status:{rider['rider_id']}"):
            cleared += 1

    return {"status": "reset_complete", "riders_cleared": cleared}