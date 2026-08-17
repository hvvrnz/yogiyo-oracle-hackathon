import json
from fastapi import APIRouter, HTTPException
from db.connection import fetch_one, execute_and_commit
from stream_processor.riders.geo_client import set_rider_available

router = APIRouter(prefix="/api/customer", tags=["customer"])


@router.get("/{order_id}")
def get_order_status(order_id: int):
    record = fetch_one("""
        SELECT o.order_id, o.store_id, s.name AS store_name,
               s.lat AS store_lat, s.lng AS store_lng,
               o.delivery_lat, o.delivery_lng,
               o.menu_items, o.amount, o.delivery_fee,
               o.status, o.package_id,
               p.rider_id, p.route_detail, p.score_detail
        FROM orders o
        JOIN stores s ON o.store_id = s.store_id
        LEFT JOIN packages p ON o.package_id = p.package_id
        WHERE o.order_id = :order_id
    """, {"order_id": order_id})

    if not record:
        raise HTTPException(status_code=404, detail="해당 주문을 찾을 수 없습니다.")

    eta_min = None
    if record.get("score_detail"):
        score_detail = record["score_detail"]
        score_detail = json.loads(score_detail) if isinstance(score_detail, str) else score_detail
        timeline = score_detail.get("timeline", [])
        for step in timeline:
            if step["order_id"] == order_id and step["type"] == "dropoff":
                eta_min = step.get("arrival_time_min")

    return {
        "order_id": record["order_id"],
        "store_name": record["store_name"],
        "store_lat": record["store_lat"],
        "store_lng": record["store_lng"],
        "delivery_lat": record["delivery_lat"],
        "delivery_lng": record["delivery_lng"],
        "menu_items": record["menu_items"],
        "amount": record["amount"],
        "delivery_fee": record["delivery_fee"],
        "status": record["status"],
        "package_id": record["package_id"],
        "rider_id": record["rider_id"],
        "route_detail": record["route_detail"],
        "score_detail": record["score_detail"],
        "eta_min": eta_min,
    }


@router.delete("/{order_id}")
def cancel_order(order_id: int):
    order = fetch_one("""
        SELECT o.order_id, o.package_id, p.status AS package_status,
               p.package_type, p.order_ids, p.rider_id
        FROM orders o
        LEFT JOIN packages p ON o.package_id = p.package_id
        WHERE o.order_id = :order_id
    """, {"order_id": order_id})

    if not order:
        raise HTTPException(status_code=404, detail="해당 주문을 찾을 수 없습니다.")

    if order["package_status"] in ("PICKED_UP", "COMPLETED"):
        raise HTTPException(
            status_code=400,
            detail="이미 픽업 완료된 주문은 취소할 수 없습니다. 고객센터로 문의해주세요."
        )

    execute_and_commit(
        "UPDATE orders SET status = 'CANCELLED' WHERE order_id = :order_id",
        {"order_id": order_id}
    )

    if not order["package_id"] or order["package_status"] != "MATCHING":
        return {"order_id": order_id, "status": "CANCELLED"}

    execute_and_commit(
        "UPDATE packages SET status = 'CANCELLED' WHERE package_id = :package_id",
        {"package_id": order["package_id"]}
    )

    if order["rider_id"]:
        set_rider_available(order["rider_id"])

    if order["package_type"] == "BUNDLE":
        order_ids = order["order_ids"]
        order_ids = json.loads(order_ids) if isinstance(order_ids, str) else order_ids
        remaining_order_ids = [oid for oid in order_ids if oid != order_id]

        for remaining_id in remaining_order_ids:
            _reassign_as_solo(remaining_id)

    return {"order_id": order_id, "status": "CANCELLED"}


def _reassign_as_solo(order_id):
    from sequencing_engine.handler.assignment import assign_solo

    order_data = fetch_one("""
        SELECT order_id, store_id, delivery_lat, delivery_lng, owner_cook_min
        FROM orders WHERE order_id = :order_id
    """, {"order_id": order_id})

    if not order_data:
        return

    store = fetch_one(
        "SELECT store_id, lat, lng, name FROM stores WHERE store_id = :store_id",
        {"store_id": order_data["store_id"]}
    )
    if not store:
        return

    order_for_engine = {
        "order_id": order_data["order_id"],
        "store_id": store["store_id"],
        "store_name": store["name"],
        "store_lat": store["lat"],
        "store_lng": store["lng"],
        "base_cooking_min": order_data["owner_cook_min"],
        "delivery_lat": order_data["delivery_lat"],
        "delivery_lng": order_data["delivery_lng"],
    }

    assign_solo(order_for_engine, set())

@router.get("/demo/active")
def get_active_demo_order():
    """
    시연용: 889 매장에서 가장 먼저 접수된 주문 하나를 고정으로 반환.
    이 주문의 status가 NEW -> COOKING -> MATCHED로 바뀌는 과정을
    소비자 화면이 그대로 따라갈 수 있도록, 항상 같은(가장 오래된) 
    주문을 가리킴. 배차 전에도 화면이 비어있지 않고 NEW 상태로 보임.
    """
    order = fetch_one("""
        SELECT order_id, status FROM orders
        WHERE store_id = 889
        ORDER BY order_id ASC
        FETCH FIRST 1 ROW ONLY
    """)

    if not order:
        raise HTTPException(status_code=404, detail="889 매장 주문이 없습니다.")

    return {"order_id": order["order_id"], "status": order["status"]}