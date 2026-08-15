import json
from db.connection import get_connection

def insert_orders(cluster, package_id=None, status=None):
    """
    이미 orders 테이블에 존재하는 주문에
    package_id와 필요한 경우 status만 갱신.
    """
    conn = get_connection()
    cursor = conn.cursor()

    for order in cluster:
        if status is None:
            cursor.execute("""
                UPDATE orders
                SET package_id = :package_id
                WHERE order_id = :order_id
            """, {
                "package_id": package_id,
                "order_id": order["order_id"],
            })
        else:
            cursor.execute("""
                UPDATE orders
                SET package_id = :package_id,
                    status = :status
                WHERE order_id = :order_id
            """, {
                "package_id": package_id,
                "status": status,
                "order_id": order["order_id"],
            })

    conn.commit()
    cursor.close()
    conn.close()

def insert_pending_order(order):
    """
    조리시작 전 상태로 주문을 즉시 저장.
    order_id는 Oracle Identity가 자동 생성하고,
    생성된 order_id를 반환한다.
    """
    conn = get_connection()
    cursor = conn.cursor()

    order_id_var = cursor.var(int)

    cursor.execute("""
        INSERT INTO orders (
            store_id,
            menu_items,
            delivery_lat,
            delivery_lng,
            amount,
            delivery_fee,
            status,
            created_at
        ) VALUES (
            :store_id,
            :menu_items,
            :delivery_lat,
            :delivery_lng,
            :amount,
            :delivery_fee,
            'NEW',
            SYSTIMESTAMP
        )
        RETURNING order_id INTO :order_id
    """, {
        "store_id": order["store_id"],
        "menu_items": json.dumps(order.get("menu_items", [])),
        "delivery_lat": order["delivery_lat"],
        "delivery_lng": order["delivery_lng"],
        "amount": order.get("amount", 0),
        "delivery_fee": order.get("delivery_fee", 0),
        "order_id": order_id_var,
    })

    conn.commit()

    order_id = order_id_var.getvalue()[0]

    cursor.close()
    conn.close()

    return order_id