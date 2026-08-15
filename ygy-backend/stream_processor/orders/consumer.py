# 참고: 이 프로그램은 끝나지 않고 계속 "새 메시지를 기다리는" 상태로 남아있다.
# 멈추고 싶으면 Ctrl+C로 종료
import json
import time
import threading
from kafka import KafkaConsumer
from stream_processor.orders.clustering.grouping import form_clusters
from sequencing_engine.handler.assignment import process_clusters, process_unmatched
from stream_processor.riders.location_simulator import simulate_rider_movement # 실시간 라이더 위치 동기화
from sequencing_engine.repository.order_repo import insert_pending_order
from db.connection import fetch_all

WINDOW_SECONDS = 5

consumer = KafkaConsumer(
    'order-events',
    bootstrap_servers='localhost:9092',
    value_deserializer=lambda v: json.loads(v.decode('utf-8')),
    auto_offset_reset='earliest',
    group_id='order-processing-group'
)


# 접수되면 바로 저장하고, 30초마다 DB에서 COOKING 상태인 것만 다시 조회해서 클러스터링하는 구조로 변경

if __name__ == "__main__":
    
    simulator_thread = threading.Thread(target=simulate_rider_movement, daemon=True)
    simulator_thread.start()
    print("=" * 60)
    print("  실속배달 — 조리시간 인지 배차 시퀀싱 데모 (실시간 라이더 위치 동기화)")
    print("=" * 60)
    print("\n주문 수신 대기 중...\n")
    buffer = []
    window_start = time.time()

    while True:
        records = consumer.poll(timeout_ms=1000)
        for topic_partition, messages in records.items():
            for message in messages:
                order = message.value
                order_id = insert_pending_order(order)
                print(f"🍚 주문 접수: [{order}] {order['store_name']}")
            
        if time.time() - window_start >= WINDOW_SECONDS:
            # 조리시작된(owner_cook_min이 채워진) 주문만 클러스터링 대상으로 조회
            ready_orders = fetch_all("""
                SELECT o.order_id, o.store_id, s.name AS store_name, s.category, s.region,
                    s.lat AS store_lat, s.lng AS store_lng,
                    o.owner_cook_min AS base_cooking_min,
                    o.delivery_lat, o.delivery_lng, o.menu_items,
                    o.created_at
                FROM orders o
                JOIN stores s ON o.store_id = s.store_id
                WHERE o.status = 'COOKING'
            """)
            if ready_orders:
                clusters, unmatched = form_clusters(ready_orders)
                assigned_rider_ids, rejected_orders = process_clusters(clusters)
                process_unmatched(unmatched + rejected_orders, assigned_rider_ids)
            window_start = time.time()