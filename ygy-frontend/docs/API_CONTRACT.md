# 실제 FastAPI API 계약

이 문서는 `ygy-frontend`가 `ygy-backend`에 호출하는 **현재 구현 기준 계약**이다. 원본 mock 시나리오의 WebSocket, 주문 생성, 배차 제안 수락, 자동 시연 API는 실제 백엔드에 존재하지 않으며 이 문서의 범위가 아니다.

최종 확인 기준은 실행 중인 서버의 `/openapi.json`과 `ygy-backend/api/routers/` 소스다.

## 공통 규칙

- 개발 환경 Base URL은 Vite 프록시를 통한 상대 경로 `/api`다. 다른 Origin으로 배포한다면 `VITE_API_BASE_URL`을 사용한다.
- 요청·응답 본문은 JSON이며, 오류는 FastAPI의 `{"detail":"..."}` 형식이다.
- `order_id`, `store_id`, `package_id`는 숫자이고 `rider_id`는 `rider_102` 형태 문자열이다.
- `menu_items`, `order_ids`, `route_detail`, `score_detail`은 JSON 문자열 또는 JSON 값으로 올 수 있다. 프론트 `static/backend-client.js`가 배열·객체로 정규화한다.
- 서버는 WebSocket을 제공하지 않는다. 고객 화면은 담당 라이더 프로필을, 라이더 화면은 본인 프로필을 5초 간격으로 조회한다. 전체 목록 API는 역할별 화면에서 호출하지 않는다.

## 고객

### `GET /api/customer/{order_id}`

특정 주문의 고객용 정보와 픽업지·배달지 좌표를 조회한다.

```json
{
  "order_id": 118,
  "store_name": "매장명",
  "store_lat": 37.5,
  "store_lng": 127.0,
  "delivery_lat": 37.5,
  "delivery_lng": 127.0,
  "menu_items": [{"menu":"메뉴", "qty":1, "price":12000}],
  "amount": 12000,
  "delivery_fee": 3000,
  "status": "MATCHED",
  "package_id": 740,
  "rider_id": "rider_102",
  "route_detail": [{"order_id":118,"type":"pickup"},{"order_id":118,"type":"dropoff"}],
  "score_detail": {"timeline":[{"order_id":118,"type":"dropoff","arrival_time_min":18}]},
  "eta_min": 18
}
```

- `eta_min`은 `score_detail.timeline`에서 해당 주문의 `dropoff` 단계 `arrival_time_min`으로 계산된다. `route_detail`은 주문 ID와 방문 순서만 제공하므로 시간 정보에 사용하면 안 된다.
- 주문이 없으면 `404`다.
- 고객 화면은 응답의 `rider_id`를 직접 사용하고, 값이 있을 때만 `GET /api/rider/{rider_id}/profile`을 5초 간격으로 폴링한다.
- 주문 상태는 배차 전후 `NEW`·`MATCHED`, 픽업 후 `PICKED_UP`, 배달 완료 후 `DELIVERED`다. 프론트는 기존 목업 호환을 위해 `COMPLETED`도 배달 완료로 처리한다.

### `DELETE /api/customer/{order_id}`

주문을 취소한다. 성공 응답은 `{"order_id":118,"status":"CANCELLED"}`다.

- 주문이 `PICKED_UP` 또는 `DELIVERED`이면 `400`과 고객센터 안내 메시지를 반환한다.
- 그 외 상태는 취소할 수 있다. BUNDLE 주문 중 하나를 취소하면 백엔드가 나머지 주문을 SOLO로 재배정하므로 프론트는 고객 주문을 다시 조회하기만 하면 된다.
- 실제 호출은 DB 상태를 변경한다.

## 사장님

### `GET /api/merchant/{store_id}`

특정 매장의 최근 주문 최대 20건을 조회한다.

```json
{
  "store_id": 781,
  "orders": [{
    "order_id": 118,
    "menu_items": [{"menu":"메뉴", "qty":1, "price":12000}],
    "amount": 12000,
    "status": "MATCHED",
    "owner_cook_min": 20,
    "predicted_cook_min": 18,
    "package_id": 740,
    "route_detail": [],
    "rider_id": "rider_102",
    "rider_name": "라이더명",
    "eta_min": 12
  }]
}
```

- 주문 내역이 없으면 `404`다.
- `route_detail`에는 `pickup`·`dropoff` 단계의 방문 순서·좌표가 포함될 수 있다.
- 각 주문의 `rider_name`, `eta_min`은 배정 라이더 이름과 도착 예상 시간이다. ETA가 없으면 프론트는 “도착 시간 정보 없음”으로 표시한다.
- 주문 상태 `PICKED_UP`, `DELIVERED`는 각각 픽업 완료, 배달 완료로 표시한다.

### `PUT /api/merchant/orders/{order_id}/cook-time`

사장님 설정 조리시간을 수정한다.

```json
{"owner_cook_min": 25}
```

성공 응답은 `{"order_id":118,"updated_owner_cook_min":25}`다. 주문이 없으면 `404`다.

- 프론트는 5분 단위 입력을 제공한다.
- 현재 서버는 최소값·5분 단위 제약을 검증하지 않으므로 서버 측 보강이 권장된다.
- 실제 호출은 DB 상태를 변경한다.

## 라이더

### `GET /api/rider`

지도용 전체 라이더 목록을 Redis의 현재 위치와 함께 반환한다.

```json
{
  "count": 500,
  "riders": [{
    "rider_id": "rider_102",
    "name": "라이더명",
    "region": "강남",
    "status": "BUSY",
    "completed_order_count": 12,
    "lat": 37.5,
    "lng": 127.0
  }]
}
```

- 고객·라이더 역할 화면은 이 API를 호출하지 않는다. 전체 라이더 관제 화면을 추가할 때는 별도 성능 최적화와 권한 설계가 필요하다.
- 위치가 없으면 `lat`, `lng`는 `null`이다.

### `GET /api/rider/{rider_id}/profile`

라이더 프로필과 위치를 반환한다.

```json
{"rider_id":"rider_102","name":"라이더명","region":"강남","status":"BUSY","completed_order_count":12,"lat":37.5,"lng":127.0}
```

라이더가 없으면 `404`다.

### `GET /api/rider/{rider_id}`

특정 라이더에게 배정된 패키지와 위치를 반환한다.

```json
{
  "rider_id": "rider_102",
  "current_lat": 37.5,
  "current_lng": 127.0,
  "packages": [{
    "package_id": 740,
    "package_type": "BUNDLE",
    "status": "MATCHING",
    "bundle_size": 2,
    "score": 0.9,
    "package_revenue": 6000,
    "hourly_revenue": 18000,
    "order_ids": [118, 119],
    "route_detail": [],
    "score_detail": {},
    "created_at": "..."
  }]
}
```

배정 패키지가 없으면 `404`다. 프로필 존재 여부와는 별개다.

### `GET /api/rider/{rider_id}/earnings`

라이더의 오늘 배정·완료 수익을 반환한다.

```json
{"rider_id":"rider_102","total_package_count":5,"completed_count":2,"total_revenue":45000,"packages":[]}
```

### `GET /api/package/{package_id}`

특정 패키지의 상세 정보를 반환한다. 응답의 패키지 필드는 `GET /api/rider/{rider_id}`의 `packages[]` 항목과 같다. 존재하지 않는 패키지는 `404`다.

### `PUT /api/rider/{rider_id}/package/{package_id}/pickup`

패키지 상태를 `PICKED_UP`으로 변경한다. 성공 응답은 `{"package_id":740,"status":"PICKED_UP"}`다.

### `PUT /api/rider/{rider_id}/package/{package_id}/complete`

패키지 상태를 `COMPLETED`로 변경하고, 라이더 완료 건수를 증가시키며 Redis에서 라이더를 배정 가능 상태로 변경한다. 성공 응답은 `{"package_id":740,"status":"COMPLETED"}`다.

- 두 요청 모두 해당 라이더의 패키지가 없으면 `404`다.
- 실제 호출은 DB와 Redis 상태를 변경한다.
- 현재 서버는 선행 상태를 엄격히 검사하지 않으므로 운영 전 `MATCHING → PICKED_UP → COMPLETED` 상태 전이 검증이 필요하다.

## 매장

### `GET /api/stores`

지도용 전체 매장 목록을 반환한다.

```json
{"count":10,"stores":[{"store_id":781,"name":"매장명","category":"치킨","region":"강남","lat":37.5,"lng":127.0,"avg_delivery_eta_min":25}]}
```

## 설명

### `GET /api/explanation/context/{package_id}`

LLM 프롬프트용 패키지와 연결 주문 데이터를 반환한다.

```json
{"package":{"package_id":740},"orders":[{"order_id":118}]}
```

### `POST /api/explanation`

고객용·라이더용 설명을 저장한다.

```json
{"package_id":740,"consumer_text":"고객 안내 문구","rider_text":"라이더 안내 문구"}
```

### `GET /api/explanation/{package_id}`

가장 최근에 저장된 설명을 반환한다. 저장 데이터가 없으면 `404`다.

현재 API는 설명 **생성**을 수행하지 않는다. API 키를 브라우저에 노출하지 않도록 생성은 별도 서버 API로 구현해야 한다.

## 기본 시연 데이터

| 역할 | 기본 ID | 관련 패키지 |
| --- | ---: | ---: |
| 고객 | 주문 `118` | `740` |
| 사장님 | 매장 `781` | `740` |
| 라이더 | `rider_102` | `740` |

통합 시연은 고객 1개, 사장님 3개, 라이더 3개 패널을 사용한다. 전체 연결 데이터는 `docs/REAL_DEMO_DATA.md`와 현재 DB 상태를 함께 확인한다.

## 제공하지 않는 기능

다음은 기존 mock 전용 기능이며 실제 FastAPI로 대체되지 않는다.

- 고객 신규 주문 생성과 배송 방식 선택
- 배차 제안·수락·거절, 주문별 픽업·배달 처리
- WebSocket, 날씨·경로 전략·자동 진행·초기화 API
- 고객·사장님·라이더별 구조화된 LLM 추천 카드 생성
