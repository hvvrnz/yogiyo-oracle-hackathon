from kafka import KafkaProducer
import json
import time
import random

producer = KafkaProducer(
    bootstrap_servers='localhost:9092',
    value_serializer=lambda v: json.dumps(v).encode('utf-8') #직렬화
)

# 매장 정보
stores = [
    {"store_id": 1, "name": "요기요 치킨 강남점", "category": "튀김류", "lat": 37.4980, "lng": 127.0280, "base_cooking_min": 20},
    {"store_id": 2, "name": "요기요 버거 역삼점", "category": "버거류", "lat": 37.5000, "lng": 127.0360, "base_cooking_min": 12},
    {"store_id": 3, "name": "요기요 한식 신림점", "category": "찌개류", "lat": 37.4840, "lng": 126.9300, "base_cooking_min": 15},
]

def generate_dummy_order(order_id):
    store = random.choice(stores) # 리스트(3개) 중에서 무작위로 하나를 골라서 store라는 변수에 저장
    return {
        "order_id": order_id,
        "store_id": store["store_id"],
        "store_name": store["name"],
        "store_lat": store["lat"], # 위도
        "store_lng": store["lng"], # 경도
        "base_cooking_min": store["base_cooking_min"], # 사장님이 설정한 기본 조리시간(분)
        "delivery_lat": store["lat"] + random.uniform(-0.01, 0.01),
        "delivery_lng": store["lng"] + random.uniform(-0.01, 0.01),
        "created_at": time.time() # 주문 접수 시각
    }
    # random.uniform(-0.01, 0.01) — -0.01에서 0.01 사이의 무작위 소수를 하나 뽑음 (위경도 단위로 약 1km 이내 정도의 작은 오차)
    # 매장의 좌표(store["lat"])에 그 무작위 값을 더해서, "매장에서 살짝 떨어진 어딘가"를 배달지로 설정 — 진짜 배달 지점 데이터가 없으니, 매장 근처의 그럴듯한 위치를 흉내

if __name__ == "__main__":
    for i in range(1, 11):
        order = generate_dummy_order(i) # 현재 i번째 더미 주문 하나를 만들어 order라는 변수에 저장.
        producer.send('order-events', order) # 해당 order를 order-events라는 토픽으로 Kafka에 전송.
        print(f"주문 전송: {order}")
        time.sleep(1) 
        # 1초 동안 프로그램을 멈춤. 이걸 넣은 이유는 실제로 주문이 한꺼번에 몰려오는 게 아니라 시간차를 두고 들어오는 걸 흉내내기 위해
        # 이게 없으면 10건이 거의 동시에(0.001초 사이에) 다 전송되어 버림.

    producer.flush()
    print("모든 더미 주문 전송 완료")