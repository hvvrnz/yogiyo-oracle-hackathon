"""
시연용 매장 3개(강남889, 강남894, 홍대884)의 최신 주문을 조회해서,
각각 조리시간을 입력(조리시작 트리거)하는 스크립트.
"""
import argparse
import random
import requests
from db.connection import fetch_all

BASE_URL = "http://localhost:8000/api/merchant/orders"
DEMO_STORE_IDS = [889, 894, 884]


def get_pending_orders(store_ids):
    placeholders = ",".join(str(sid) for sid in store_ids)
    return fetch_all(f"""
        SELECT order_id, store_id, status
        FROM orders
        WHERE store_id IN ({placeholders})
        ORDER BY order_id DESC
    """)


def start_cooking(order_id, cook_min):
    resp = requests.put(
        f"{BASE_URL}/{order_id}/cook-time",
        json={"owner_cook_min": cook_min},
    )
    return resp.status_code, resp.json()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--cook-min", type=int, default=None,
                         help="고정 조리시간(분). 지정 안 하면 5~20분 사이 랜덤")
    args = parser.parse_args()

    orders = get_pending_orders(DEMO_STORE_IDS)

    if not orders:
        print("시연용 매장 주문이 없습니다.")
        exit()

    print(f"=== 대상 주문 {len(orders)}건 ===")
    for o in orders:
        if o["status"] != "NEW":
            continue  # 이미 조리시작된 건 건너뜀
        cook_min = args.cook_min if args.cook_min else random.choice([5, 10, 15, 20, 30, 40])
        status_code, body = start_cooking(o["order_id"], cook_min)
        print(f"order_id={o['order_id']} (store_id={o['store_id']}) -> {cook_min}분 [{status_code}]")

    print("=== 완료 ===")