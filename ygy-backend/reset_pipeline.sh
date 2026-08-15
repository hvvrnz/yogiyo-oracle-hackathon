#!/bin/bash
# Redis(라이더 상태) + Kafka(order-events 토픽) 초기화 스크립트
# 사용법: ./reset_pipeline.sh

echo "=== 1. Redis 라이더 상태 초기화 ==="
python3 << 'EOF'
import redis
from common.dummy.riders import DUMMY_RIDERS

r = redis.Redis(host='localhost', port=6379, decode_responses=True)

cleared = 0
for rider in DUMMY_RIDERS:
    key = f"rider:status:{rider['rider_id']}"
    if r.delete(key):
        cleared += 1

print(f"라이더 상태 초기화 완료 ({cleared}명이 BUSY -> 해제됨)")
EOF

echo ""
echo "=== 2. Kafka 토픽 초기화 ==="
docker exec -it ygy-kafka kafka-topics --bootstrap-server localhost:9092 \
    --delete --topic order-events 2>/dev/null

sleep 2

docker exec -it ygy-kafka kafka-topics --bootstrap-server localhost:9092 \
    --create --topic order-events --partitions 1 --replication-factor 1

echo ""
echo "=== 3. DB 초기화 (orders, packages만) ==="
echo "아래 SQL을 Database Actions에서 직접 실행해주세요:"
echo "DELETE FROM orders;"
echo "DELETE FROM packages;"
echo "COMMIT;"

echo ""
echo "=== 초기화 완료 ==="
echo "이제 Consumer, Producer를 재실행하세요."