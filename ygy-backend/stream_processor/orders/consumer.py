# 참고: 이 프로그램은 끝나지 않고 계속 "새 메시지를 기다리는" 상태로 남아있다.
# 메시지를 구독해서 읽는 Consumer이기에, 멈추고 싶으면 Ctrl+C로 종료
import json
import time
from itertools import combinations
from kafka import KafkaConsumer
from stream_processor.orders.clustering.scoring import cluster_score
from stream_processor.orders.clustering.grouping import form_clusters
from stream_processor.orders.timing import still_has_time

WINDOW_SECONDS = 30

consumer = KafkaConsumer(
    'order-events',
    bootstrap_servers='localhost:9092',
    value_deserializer=lambda v: json.loads(v.decode('utf-8')),
    auto_offset_reset='earliest',
    group_id='order-processing-group'
)


def print_cluster_detail(i, cluster):
    print(f"\n--- 클러스터 {i} ---")
    for o in cluster:
        print(f"  주문{o['order_id']}: {o['store_name']} "
              f"(매장 {o['store_lat']:.4f},{o['store_lng']:.4f}) "
              f"카테고리={o.get('category','?')} "
              f"조리시간={o['base_cooking_min']}분 "
              f"배달지({o['delivery_lat']:.4f},{o['delivery_lng']:.4f})")
    if len(cluster) > 1:
        for a, b in combinations(cluster, 2):
            sc = cluster_score(a, b)
            print(f"  score(주문{a['order_id']}, 주문{b['order_id']}) = {sc:.2f}")


if __name__ == "__main__":
    print("=" * 60)
    print("  실속배달 — 조리시간 인지 배차 시퀀싱 데모")
    print("=" * 60)
    print("\n주문 수신 대기 중...\n")
    buffer = []
    window_start = time.time()

    while True:
        records = consumer.poll(timeout_ms=1000)

        for topic_partition, messages in records.items():
            for message in messages:
                order = message.value
                print(f"🍚 주문 접수: [{order['order_id']}] {order['store_name']} "
                      f"({order.get('category','?')}, 조리 {order['base_cooking_min']}분)")
                buffer.append(order)

        if time.time() - window_start >= WINDOW_SECONDS:
            if buffer:
                print(f"\n{'─'*60}")
                print(f"⏱  30초 경과 — 배차 후보 매칭 시작 (대기 중 주문 {len(buffer)}건)")
                print(f"{'─'*60}")

                clusters, unmatched = form_clusters(buffer)

                for i, cluster in enumerate(clusters, 1):
                    names = ', '.join(o['store_name'] for o in cluster)
                    print(f"\n✅ 묶음 #{i} 확정: {names}")
                    print(f"   주문번호: {[o['order_id'] for o in cluster]}")

                still_waiting = [o for o in unmatched if still_has_time(o)]
                expired = [o for o in unmatched if not still_has_time(o)]

                for o in expired:
                    print(f"\n🏠 한집배달: [{o['order_id']}] {o['store_name']} "
                          f"— 조리시간 임박, 더 기다릴 수 없어 단건 배차")

                if still_waiting:
                    names = ', '.join(f"[{o['order_id']}]{o['store_name']}" for o in still_waiting)
                    print(f"\n⏳ 매칭 대기 중: {names}")
                    print(f"   → 아직 조리시간 여유 있음, 다음 30초에 새 주문과 재매칭 시도")

                buffer = still_waiting
                print(f"\n{'='*60}\n")
            window_start = time.time()