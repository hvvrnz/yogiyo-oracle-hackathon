#!/bin/bash
echo "=== DB + Redis 초기화 ==="

curl -X POST http://localhost:8000/api/merchant/demo-reset

echo ""
echo "=== 초기화 완료, Kafka는 그대로 둠 ==="
echo "Consumer/Producer는 계속 켜둔 채로 두시면 됩니다. 이상이 있다면 껐다가 다시켜기"