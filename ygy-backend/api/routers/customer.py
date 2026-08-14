import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.connection import fetch_one, execute_and_commit
from stream_processor.riders.geo_client import set_rider_available

router = APIRouter(prefix="/api/customer", tags=["customer"])


@router.get("/{order_id}")
def get_order_status(order_id: int):
    """
    특정 주문의 상태와 예상 ETA 조회.
    stores와 JOIN해서 매장(픽업지) 좌표도 함께 제공.
    """
    record = fetch_one("""
        SELECT o.order_id, o.store_id, s.name AS store_name,
               s.lat AS store_lat, s.lng AS store_lng,
               o.delivery_lat, o.delivery_lng,
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
        "store_lat": record["store_lat"],
        "store_lng": record["store_lng"],
        "delivery_lat": record["delivery_lat"],
        "delivery_lng": record["delivery_lng"],
        "menu_items": record["menu_items"],
        "amount": record["amount"],
        "delivery_fee": record["delivery_fee"],
        "status": record["status"],
        "eta_min": eta_min,
    }


def _reassign_as_solo(order_id):
    """
    묶음(BUNDLE)이 깨졌을 때, 남은 주문 하나를 한집배달로 재배정.
    """
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


@router.delete("/{order_id}")
def cancel_order(order_id: int):
    """
    주문 취소.

    처리 규칙:
    - package_id가 없음(아직 배차 전) → 주문만 CANCELLED 처리
    - package.status == 'MATCHING'(배차됐지만 픽업 전) → 취소 가능
        - package_type이 SOLO였다면: package도 함께 CANCELLED, 라이더 재배정 가능 상태로
        - package_type이 BUNDLE이었다면: package 전체를 CANCELLED 처리하고,
          남은 주문들은 각각 한집배달(SOLO)로 재배정 (기획서 정책)
    - package.status가 PICKED_UP 또는 COMPLETED → 취소 불가 (400)
    """
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

    # 1. 이 주문 자체를 취소 처리
    execute_and_commit(
        "UPDATE orders SET status = 'CANCELLED' WHERE order_id = :order_id",
        {"order_id": order_id}
    )

    # 2. 아직 배차 전(package 없음)이었다면 여기서 끝
    if not order["package_id"] or order["package_status"] != "MATCHING":
        return {"order_id": order_id, "status": "CANCELLED"}

    # 3. 배차된 상태였다면, 그 package를 취소 처리
    execute_and_commit(
        "UPDATE packages SET status = 'CANCELLED' WHERE package_id = :package_id",
        {"package_id": order["package_id"]}
    )

    if order["rider_id"]:
        set_rider_available(order["rider_id"])

    # 4. 묶음이었다면, 취소 안 된 나머지 주문들을 한집배달로 재배정
    if order["package_type"] == "BUNDLE":
        order_ids = order["order_ids"]
        order_ids = json.loads(order_ids) if isinstance(order_ids, str) else order_ids
        remaining_order_ids = [oid for oid in order_ids if oid != order_id]

        for remaining_id in remaining_order_ids:
            _reassign_as_solo(remaining_id)

    return {"order_id": order_id, "status": "CANCELLED"}