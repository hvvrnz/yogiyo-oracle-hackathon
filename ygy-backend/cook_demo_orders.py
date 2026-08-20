"""
현재 NEW 상태인 주문에 조리시간을 채워 COOKING 상태로 전환하는 스크립트.
특정 매장으로 제한하지 않음 — producer가 1000개 매장 중 아무 곳에나
주문을 만들면 그 주문이 그대로 대상이 됨. 지금은 "클러스터링 → 배차가
실제로 한 번이라도 끝까지 도는지" 확인이 목적이라, 검증 안 된 API 레이어를
거치지 않고 DB를 직접 갱신한다.
"""
import argparse
import random
from db.connection import get_connection, fetch_all


def get_pending_orders(limit=None):
    query = """
        SELECT order_id, store_id, status
        FROM orders
        WHERE status = 'NEW'
        ORDER BY order_id DESC
    """
    if limit:
        query = f"SELECT * FROM ({query}) WHERE ROWNUM <= {limit}"
    return fetch_all(query)


def start_cooking(order_id, cook_min):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE orders
        SET owner_cook_min = :cook_min,
            status = 'COOKING'
        WHERE order_id = :order_id
    """, {"cook_min": cook_min, "order_id": order_id})
    conn.commit()
    cursor.close()
    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--cook-min", type=int, default=None,
                         help="고정 조리시간(분). 지정 안 하면 5~40분 사이 랜덤")
    parser.add_argument("--limit", type=int, default=None,
                         help="처리할 최대 주문 수. 지정 안 하면 NEW 상태 전부 처리")
    args = parser.parse_args()

    orders = get_pending_orders(limit=args.limit)

    if not orders:
        print("NEW 상태 주문이 없습니다. producer.py가 켜져 있는지 확인하세요.")
        exit()

    print(f"=== 대상 주문 {len(orders)}건 ===")
    for o in orders:
        cook_min = args.cook_min if args.cook_min else random.choice([5, 10, 15, 20, 30, 40])
        start_cooking(o["order_id"], cook_min)
        print(f"order_id={o['order_id']} (store_id={o['store_id']}) -> {cook_min}분")

    print("=== 완료 ===")