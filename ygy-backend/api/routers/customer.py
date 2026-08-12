import json
from fastapi import APIRouter, HTTPException
from db.connection import fetch_one

router = APIRouter(prefix="/api/customer", tags=["customer"])


@router.get("/{order_id}")
def get_order_status(order_id: int):
    """
    특정 주문의 상태와 예상 ETA 조회. 소비자에게 필요한 정보만 가공해서 응답.
    """
    record = fetch_one("""
        SELECT o.order_id, o.store_id, s.name AS store_name,
               o.menu_items, o.amount, o.delivery_fee,
               o.status, o.package_id,
               p.route_detail
        FROM orders o
        JOIN stores s ON o.store_id = s.store_id
        LEFT JOIN packages p ON o.package_id = p.package_id
        WHERE o.order_id = :order_id
    """, {"order_id": order_id})

    if not record:
        raise HTTPException(status_code=404, detail="해당 주문을 찾을 수 없습니다.")

    eta_min = None
    if record.get("route_detail"):
        route = record["route_detail"]
        route = json.loads(route) if isinstance(route, str) else route
        for step in route:
            if step["order_id"] == order_id and step["type"] == "dropoff":
                eta_min = step.get("arrival_time_min")

    return {
        "order_id": record["order_id"],
        "store_name": record["store_name"],
        "menu_items": record["menu_items"],
        "amount": record["amount"],
        "delivery_fee": record["delivery_fee"],
        "status": record["status"],
        "eta_min": eta_min,
    }