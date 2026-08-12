import json
from db.connection import get_connection


def insert_orders(cluster, package_id=None):
    conn = get_connection()
    cursor = conn.cursor()
    for order in cluster:
        cursor.execute("""
            INSERT INTO orders (
                order_id, store_id, package_id,
                owner_cook_min, predicted_cook_min, menu_items,
                delivery_lat, delivery_lng, amount, delivery_fee,
                status, created_at
            ) VALUES (
                :order_id, :store_id, :package_id,
                :owner_cook_min, :predicted_cook_min, :menu_items,
                :delivery_lat, :delivery_lng, :amount, :delivery_fee,
                'MATCHED', SYSTIMESTAMP
            )
        """, {
            "order_id": order["order_id"],
            "store_id": order["store_id"],
            "package_id": package_id,
            "owner_cook_min": order["base_cooking_min"],
            "predicted_cook_min": order.get("predicted_cook_min"),
            "menu_items": json.dumps(order.get("menu_items", [])),
            "delivery_lat": order["delivery_lat"],
            "delivery_lng": order["delivery_lng"],
            "amount": order.get("amount", 0),
            "delivery_fee": order.get("delivery_fee", 0),
        })
    conn.commit()
    cursor.close()
    conn.close()