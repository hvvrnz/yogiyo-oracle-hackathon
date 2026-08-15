from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.connection import execute_and_commit, fetch_all

router = APIRouter(prefix="/api/merchant", tags=["merchant"])


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