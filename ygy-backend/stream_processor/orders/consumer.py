# 참고: 이 프로그램은 끝나지 않고 계속 "새 메시지를 기다리는" 상태로 남아있다.
# 멈추고 싶으면 Ctrl+C로 종료
import json
import time
import threading
from kafka import KafkaConsumer
from stream_processor.orders.clustering.grouping import form_clusters
from sequencing_engine.handler.assignment import process_clusters, process_unmatched
from stream_processor.riders.location_simulator import simulate_rider_movement # 실시간 라이더 위치 동기화

WINDOW_SECONDS = 30

consumer = KafkaConsumer(
    'order-events',
    bootstrap_servers='localhost:9092',
    value_deserializer=lambda v: json.loads(v.decode('utf-8')),
    auto_offset_reset='earliest',
    group_id='order-processing-group'
)


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
                print(f"🍚 주문 접수: [{order['order_id']}] {order['store_name']}")
                buffer.append(order)

        if time.time() - window_start >= WINDOW_SECONDS:
            if buffer:
                print(f"\n{'─'*60}")
                print(f"⏱  30초 경과 — 배차 시작 (주문 {len(buffer)}건)")
                print(f"{'─'*60}")

                clusters, unmatched = form_clusters(buffer)
                assigned_rider_ids, rejected_orders = process_clusters(clusters)
                buffer = process_unmatched(unmatched + rejected_orders, assigned_rider_ids)

                print(f"\n{'='*60}\n")
            window_start = time.time()