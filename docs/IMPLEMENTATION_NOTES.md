# v1.2.0 구현 변경 파일

## 자동 재배차 핵심

- `sequencing_engine/dispatch.py`
  - 첫 픽업 매장까지의 거리·도착시간 계산
  - 거절·시간초과 라이더 제외
  - 배차 가능 후보 점수화 및 정렬
- `common/state.py`
  - `offered_rider_id`, `offer_attempt`, `offer_history` 상태 관리
  - 라이더 수락·거절 권한 검증
  - 거절 후 다음 후보 자동 제안
  - 제안 시간 만료 후 다음 후보 자동 제안
  - 모든 후보 소진 시 `NO_RIDER_AVAILABLE`
- `api/routers/rider.py`
  - 라이더별 수락·거절 API
- `api/routers/demo.py`
  - 현재 라이더 수락·거절·시간초과 시연 API
- `api/main.py`
  - 제안 응답시간 만료 주기 검사
  - WebSocket 상태 변경 전파
- `static/rider/app.js`, `static/rider/index.html`
  - 현재 제안 대상 라이더에게만 수락·거절 버튼 표시
  - 자동 재배차 상태 안내
- `static/demo/app.js`, `static/demo/index.html`
  - 현재 제안 대상 라이더로 시연 iframe 자동 전환
  - 거절 및 응답시간 만료 시나리오 버튼
- `data/dummy/scenarios/*.json`
  - 자동 재배차 테스트용 라이더 후보 4명
- `scripts/generate_dummy_data.py`
  - 시나리오 재생성 시 다중 라이더 후보 포함
- `tests/test_app.py`
  - 거절 재배차, 잘못된 라이더 수락 차단, 후보 소진, 시간초과 테스트

## README 디렉토리 구조 반영

- `stream_processor/`: Kafka Consumer 및 주문 클러스터링 경계
- `sequencing_engine/`: 경로 최적화 및 자동 재배차
- `api/`: FastAPI 애플리케이션과 역할별 Router
- `batch/`: cron용 조리시간 보정계수 계산
- `vector_search/`: Cohere 임베딩 및 Oracle Vector Search 경계
- `common/`: 설정, 모델, 상태, 더미 데이터, Provider

루트 `app.py`, `models.py`, `state.py`, `services/`는 기존 실행·import 호환을 위해 얇은 래퍼로 유지했습니다.
