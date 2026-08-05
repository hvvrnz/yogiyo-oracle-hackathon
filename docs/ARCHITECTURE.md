# 통합 데모 아키텍처

## 실행 구조

해커톤 POC에서는 역할별 서버를 따로 실행하지 않습니다. FastAPI 서버 하나가 고객·사장님·라이더·시연 화면과 REST/WebSocket API를 모두 제공합니다.

```text
브라우저
├─ /customer?customerId=C-001
├─ /merchant?storeId=S-001
├─ /rider?riderId=R-001
└─ /demo
       │
       ├─ REST: 상태 조회와 사용자 행동
       └─ WebSocket: 상태 변경 알림
              │
          api/main.py
              │
       api/runtime.py 공통 상태
              │
         common/state.py
          ├─ sequencing_engine/optimizer.py
          ├─ sequencing_engine/dispatch.py
          ├─ common/dummy_data.py
          └─ common/explanations.py
```

루트 `app.py`는 `api.main:app`을 다시 내보내므로 기존 실행 명령도 유지됩니다.

```powershell
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

프론트엔드는 WebSocket 알림을 받으면 역할별 REST API를 다시 조회합니다. 따라서 이벤트 메시지에 다른 역할의 개인정보를 넣지 않습니다.

## 전체 서비스 목표 구조

```text
Kafka 주문 이벤트
  ↓
stream_processor/
- 30초 윈도우
- 최대 3건 주문 클러스터링
  ↓
Redis Geo 근처 라이더 검색
  ↓
sequencing_engine/
- 유효 픽업·배달 순서 생성
- 조리시간·대기·품질·ETA 스코어링
- 라이더 후보 점수화·자동 재배차
  ↓
vector_search/
- Cohere Embed 4
- Oracle AI Vector Search 유사 주문 검색
  ↓
api/
- 역할별 REST API
- WebSocket 상태 변경 알림
```

## 실서비스 교체

| 데모 구성 | 실서비스 교체 |
|---|---|
| `common.state.DemoState` | Redis 현재 상태 + Oracle AI Database 영구 저장 |
| 내부 이벤트 목록 | Kafka 이벤트 스트림 |
| 가상 음식점 | 공공데이터포털 음식점 데이터 |
| 메모리 라이더 후보 | Redis Geo 반경 검색 결과 |
| Haversine 후보 거리 | 카카오모빌리티 도로 거리·시간 |
| 시연용 경로 | 카카오모빌리티 길찾기 API |
| 시연용 추상 지도 | 네이버 또는 구글 지도 JavaScript API |
| 시연용 날씨 | 기상청 실황·예보 API |
| 규칙 기반 설명 | OCI Generative AI API |
| 미리 정한 수치 | 예측 엔진 + 3건 완전탐색 + 가드레일 |

## 자동 재배차

```text
package.offered
  ↓
라이더 거절 또는 응답시간 만료
  ↓
sequencing_engine.dispatch.DispatchEngine
- 거절/만료 라이더 제외
- 배차 가능 상태 검사
- 첫 픽업 매장 도착시간 점수화
  ↓
package.reoffered
  ↓
후보 없음: NO_RIDER_AVAILABLE
```

## 이벤트 예시

- `order.created`
- `merchant.order.accepted`
- `merchant.cooking.started`
- `merchant.order.delayed`
- `merchant.order.ready`
- `package.offered`
- `rider.package.rejected`
- `rider.offer.timed_out`
- `package.reoffered`
- `rider.package.accepted`
- `rider.order.picked_up`
- `order.delivered`
- `package.completed`

## 개인정보 경계

- 고객: 자기 주문과 비식별화된 다른 경유지만 조회합니다.
- 사장님: 자기 매장의 주문만 조회합니다.
- 라이더: 배차 수락 전 고객 상세 주소를 받지 않습니다.
- GenAI: 서버가 구성한 확정 수치만 입력하며 다른 고객 개인정보와 자유 텍스트를 제외합니다.

## 경로 전략

```text
optimized    : PICKUP → PICKUP → DELIVERY → PICKUP → DELIVERY → DELIVERY
pickup_first : PICKUP → PICKUP → PICKUP → DELIVERY → DELIVERY → DELIVERY
```

## 지도 계층

`static/maps.js`는 네이버·구글·시연 지도 사이의 어댑터입니다. 실제 도로 polyline은 `common/providers.py`의 `RoutingProvider` 구현을 카카오모빌리티 API로 교체하여 적용합니다.
