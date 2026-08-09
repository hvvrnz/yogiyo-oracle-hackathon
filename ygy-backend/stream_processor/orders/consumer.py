# 참고: 이 프로그램은 끝나지 않고 계속 "새 메시지를 기다리는" 상태로 남아있다.
# 메시지를 구독해서 읽는 Consumer이기에, 멈추고 싶으면 Ctrl+C로 종료
import json
import time
from kafka import KafkaConsumer
from common.geo import haversine
from common.config import (
    FOOD_CATEGORY_URGENCY, UrgencyLevel,
    AVG_SPEED_KMH, URGENCY_MISMATCH_PENALTY_KM, MAX_CLUSTER_SIZE
)

WINDOW_SECONDS = 30

consumer = KafkaConsumer(
    'order-events',
    bootstrap_servers='localhost:9092',
    value_deserializer=lambda v: json.loads(v.decode('utf-8')),
    auto_offset_reset='earliest',
    group_id='order-processing-group'
)


def get_urgency(category):
    return FOOD_CATEGORY_URGENCY.get(category, UrgencyLevel.MODERATE)


def cluster_score(order, other):
    """
    두 주문을 묶었을 때의 점수를 계산. 낮을수록 좋은 조합.
    모든 요소를 km 단위로 환산해서 더하므로, 임의 가중치 없이
    단순 합산이 가능함.
    """
    store_distance = haversine(order["store_lat"], order["store_lng"],
                                other["store_lat"], other["store_lng"])
    delivery_distance = haversine(order["delivery_lat"], order["delivery_lng"],
                                   other["delivery_lat"], other["delivery_lng"])

    cross_distance_1 = haversine(order["store_lat"], order["store_lng"],
                                  other["delivery_lat"], other["delivery_lng"])
    cross_distance_2 = haversine(other["store_lat"], other["store_lng"],
                                  order["delivery_lat"], order["delivery_lng"])
    cross_distance = (cross_distance_1 + cross_distance_2) / 2

    cook_time_diff_min = abs(order["base_cooking_min"] - other["base_cooking_min"])
    cook_time_diff_km_equiv = (cook_time_diff_min / 60) * AVG_SPEED_KMH

    order_urgency = get_urgency(order.get("category", ""))
    other_urgency = get_urgency(other.get("category", ""))
    urgency_penalty = 0 if order_urgency == other_urgency else URGENCY_MISMATCH_PENALTY_KM

    score = store_distance + delivery_distance + cross_distance + cook_time_diff_km_equiv + urgency_penalty
    return score


def form_clusters(orders, max_size=MAX_CLUSTER_SIZE):
    clusters = []
    used = set()

    for order in orders:
        if order["order_id"] in used:
            continue

        candidates = [
            (other, cluster_score(order, other))
            for other in orders
            if other["order_id"] != order["order_id"] and other["order_id"] not in used
        ]
        candidates.sort(key=lambda x: x[1])

        best_matches = [c[0] for c in candidates[:max_size - 1]]
        group = [order] + best_matches
        clusters.append(group)
        used.update(o["order_id"] for o in group)

    return clusters


if __name__ == "__main__":
    print("주문 수신 대기 중...")
    buffer = []
    window_start = time.time()

    while True:
        records = consumer.poll(timeout_ms=1000)  # 1초만 기다리고, 메시지 없어도 넘어감

        for topic_partition, messages in records.items():
            for message in messages:
                order = message.value
                buffer.append(order)
                print(f"버퍼에 주문 추가: order_id={order['order_id']} (현재 버퍼 크기: {len(buffer)})")

        if time.time() - window_start >= WINDOW_SECONDS:
            if buffer:
                print(f"\n=== {WINDOW_SECONDS}초 경과, 클러스터링 시작 (버퍼 {len(buffer)}건) ===")
                clusters = form_clusters(buffer)
                for i, cluster in enumerate(clusters, 1):
                    order_ids = [o["order_id"] for o in cluster]
                    print(f"클러스터 {i}: 주문 {order_ids}")
                buffer = []
            else:
                print(f"({WINDOW_SECONDS}초 경과, 버퍼 비어있음 — 클러스터링 생략)")
            window_start = time.time()