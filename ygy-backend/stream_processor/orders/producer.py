# 참고: 이 프로그램은 끝나지 않고 계속 새 주문을 생성해서 Kafka로 전송하는 프로그램으로 구현 되어있다. 무한 반복(while True)
# 따라서 멈추고 싶으면 Ctrl+C로 종료한다. 

import json
import time
import random
from kafka import KafkaProducer
from common.dummy.stores import DUMMY_STORES as stores
producer = KafkaProducer(
    bootstrap_servers='localhost:9092',
    value_serializer=lambda v: json.dumps(v).encode('utf-8') #직렬화
)

def generate_dummy_order(order_id):
    store = random.choice(stores) # 리스트(3개) 중에서 무작위로 하나를 골라서 store라는 변수에 저장
    return {
        "order_id": order_id,
        "store_id": store["store_id"],
        "store_name": store["name"],
        "store_lat": store["lat"], # 위도
        "store_lng": store["lng"], # 경도
        "category": store["category"], # 음식 카테고리
        "base_cooking_min": store["base_cooking_min"], # 사장님이 설정한 기본 조리시간(분)
        "delivery_lat": store["lat"] + random.uniform(-0.01, 0.01),
        "delivery_lng": store["lng"] + random.uniform(-0.01, 0.01),
        "created_at": time.time() # 주문 접수 시각
    }
    # random.uniform(-0.01, 0.01) — -0.01에서 0.01 사이의 무작위 소수를 하나 뽑음 (위경도 단위로 약 1km 이내 정도의 작은 오차)
    # 매장의 좌표(store["lat"])에 그 무작위 값을 더해서, "매장에서 살짝 떨어진 어딘가"를 배달지로 설정 — 진짜 배달 지점 데이터가 없으니, 매장 근처의 그럴듯한 위치를 흉내

if __name__ == "__main__":
    order_id = 1
    try:
        while True:
            order = generate_dummy_order(order_id)
            producer.send('order-events', order)
            print(f"주문 전송: {order}")
            order_id += 1
            time.sleep(0.5)  # 0.5초마다 새 주문 하나씩 (원하는 속도로 조정 가능)
    except KeyboardInterrupt:
        print("\nProducer 종료")
        producer.flush()