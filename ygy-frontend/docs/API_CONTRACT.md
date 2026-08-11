# 프론트엔드-백엔드 API 계약

이 문서는 `ygy-frontend-only`가 화면을 정상 렌더링하기 위해 `ygy-backend`에 요구하는 계약입니다. JSON 키는 프론트에서 직접 참조하므로 이름을 그대로 유지해야 합니다.

## 공통 규칙

- REST 응답 형식: `application/json`
- 성공한 명령 응답: 최소 `{"message": "..."}`
- 실패 응답: `{"detail": "..."}` 또는 `{"message": "..."}`
- WebSocket 경로: 기본 `/ws/{role}/{entity_id}`. 배포 환경에서 경로가 다르면 프론트의 `VITE_API_PATHS.websocket`에 `:role`, `:entityId` 자리표시자를 사용해 변경한다.
- 클라이언트는 20초마다 문자열 `ping`을 전송하며 서버는 `{"type":"pong"}`으로 응답
- `pong` 이외의 메시지가 오면 해당 역할 화면이 REST 조회를 다시 수행
- 통합 시연은 동시에 `C-001`, `S-001~S-003`, `R-001~R-003`을 조회한다. 각 ID는 독립 엔터티이며, 다른 ID의 데이터를 대신 반환하면 안 된다.
- 하나의 묶음 배차 상태가 변경되면 관련 고객·매장·라이더의 WebSocket 채널 모두에 갱신 이벤트를 발행한다.

## 고객

### `POST /api/orders`

- 요청: `customer_id`, `store_id`, `items[]`, `delivery_preference`
- `delivery_preference`: `SINGLE | AI_RECOMMENDED`이며, 고객이 주문 시 반드시 선택한다.
- 주문을 `NEW`로 생성하고 해당 고객·매장 채널에 갱신 이벤트를 발행한다.

### 배송 선택과 배차 결과

- 주문에는 `delivery_preference`, `delivery_preference_label`, `resolved_delivery_type`, `resolved_delivery_label`, `package_id`, `rider_id`를 포함한다.
- `resolved_delivery_type`은 배차 계산 전 `null`이고, 이후 `SINGLE_DELIVERY | AI_BUNDLE_2 | AI_BUNDLE_3`이다.
- `SINGLE` 주문은 언제나 `SINGLE_DELIVERY`로 처리한다.
- `AI_RECOMMENDED` 주문은 클러스터 점수가 허용 범위 안일 때 2건 `AI_BUNDLE_2` 또는 3건 `AI_BUNDLE_3`으로 처리한다. 1건만 남거나 적합한 클러스터가 없으면 `SINGLE_DELIVERY`로 처리한다. 최대 묶음 크기는 3건이다.
- 주문 수락 후 배차 계산 전 상태는 `MATCHING`이며 UI에는 “AI 추천 배달 분석 중”, 현재 AI 추천 주문 수, 2~3건 조건 안내를 표시한다.

### `GET /api/customer/{customer_id}`

- `order`: `order_id`, `eta_window`, `current_message`, `delivery_sequence`, `eta_updated_label`, `status`, `status_label`, `menu_summary`, `remaining_min`, `progress_index`, `bag_time_min`, `bag_time_limit_min`, `quality_margin_min`, `quality_guard_passed`, `amount`, `request_note`, `items[] {name, quantity}`
- `store`: `name`
- `package`: `package_id`, `delivery_type`, `delivery_type_label`, `order_ids[]`, `status`, `bundle_reasons[]`, `route_strategy_label`, `route_strategy_description`
- `rider`: `assigned`, `current_step_label`, `lat`, `lng`
- `weather`: `condition`, `label`, `temperature_c`, `advisory`
- `route[]`: 지도 좌표 객체. 각 객체는 `lat`, `lng`, `type`, `label`, `is_own` 사용

## 사장님

### `GET /api/merchant/{store_id}`

- `store`: `name`, `category`, `prediction_accuracy_pct`, `congestion`, `base_cooking_min`
- `summary`: `new_count`, `cooking_count`, `ready_count`
- `orders[]`: 주문 공통 필드, 특히 `delivery_preference`, `delivery_preference_label`, `resolved_delivery_type`, `resolved_delivery_label`, `package_id`, `rider_id`, 시간 필드
- `rider`: `assigned`, `arrival_label`, `remaining_min`, `distance_km`, `context`
- `package`: `package_id`, `delivery_type`, `delivery_type_label`, `order_ids[]`, `status`, `assigned_rider_id`, `offers`, `bundle_reasons[]`, `route_steps[]`, `route_strategy_label`
- `weather`: `condition`, `label`, `temperature_c`, `advisory`

`store_id`는 사장님이 운영하는 단일 매장을 뜻한다. 통합 시연의 기본 매핑은 `S-001=치킨`, `S-002=버거`, `S-003=한식`이며, 응답의 `orders[]`에는 해당 매장 주문만 포함한다.

### `POST /api/merchant/orders/{order_id}/action`

```json
{"action": "accept | start | ready | delay", "delay_min": 0}
```

`delay`인 경우 화면은 `delay_min`으로 5 또는 10을 전송합니다.

### `POST /api/demo/dispatch-calculate`

수락된 주문을 대상으로 배송 선택과 위의 정확히-3건 규칙을 적용해 패키지를 생성한다. 조리 완료는 배차 생성 조건이 아니며, `READY`는 픽업 활성화 조건일 뿐이다.

## 라이더

### `GET /api/rider/{rider_id}`

- `rider`: `display_name`, `vehicle`, `status_label`, `lat`, `lng`
- `packages[]`: 각 항목은 `package_id`, `delivery_type`, `delivery_type_label`, `order_ids[]`, `status`, `offers`, `bundle_reasons[]`, `estimated_duration_min`, `total_distance_km`, `package_revenue`, `hourly_revenue`, `route_steps[]`, `current_step`, `accepted`, `can_accept`
- `steps[]`: `sequence`, `status`, `is_current`, `destination`, `address`, `distance_km`, `duration_min`, `eta_label`, `label`, `lat`, `lng`, `type`
- `store_readiness[]`: `status`, `status_label`, `store_name`, `remaining_min`, `ready_at`
- `weather`: `condition`, `label`, `travel_delay_min`, `advisory`

라이더가 현재 제안 또는 배정 대상이 아니어도 해당 라이더의 실제 상태를 반환한다. `can_accept`은 현재 제안을 받은 라이더에게만 `true`여야 하며, `status_label`로 가용·재배차 후보·다른 주문 수행 중 상태를 구분한다.

### `POST /api/rider/{rider_id}/packages/{package_id}/offer-response`

```json
{"action":"accept | decline"}
```

새 패키지는 모든 가용 라이더에게 동시에 `offers.{rider_id}.status="OFFERED"`를 생성한다. 한 라이더는 복수 제안을 동시에 조회할 수 있다. 첫 번째 `accept`만 성공시키고 해당 package의 수락 라이더는 `ACCEPTED`, 나머지는 `CANCELLED`로 원자적으로 전환한다. 이후 중복 수락은 실패 응답이어야 한다.

### 주문별 운행 처리

- `POST /api/rider/{rider_id}/orders/{order_id}/pickup`: 현재 순서이며 주문이 `READY`일 때만 `PICKED_UP`으로 변경
- `POST /api/rider/{rider_id}/orders/{order_id}/deliver`: 현재 순서이며 주문이 `PICKED_UP`일 때만 `DELIVERED`로 변경
- 주문 응답에는 `created_at`, `accepted_at`, `cooking_started_at`, `ready_at`, `picked_up_at`, `delivered_at`, `eta_at`을 포함한다. 상태 변경 뒤 고객별 ETA를 재계산한다.
- 각 패키지는 `route_steps[]`로 주문별 픽업·배송 순서를 제공한다. 현재 순서의 `READY` 주문만 pickup 가능하며, `PICKED_UP` 주문만 deliver 가능하다.

## 추천 설명

### `GET /api/explanations/{role}/{entity_id}`

`role`은 `customer`, `merchant`, `rider` 중 하나입니다.

- `headline`, `summary`, `note`, `source`
- `reasons[]`: `title`, `description`, `metric`

## 지도

### `GET /api/config/maps`

- `provider`: `demo | naver | google`
- `client_key`
- `has_credentials`
- `fallback_provider`

키가 없거나 요청이 실패하면 프론트 자체 시연용 지도로 자동 전환합니다.

## 통합 시연

### 조회

- `GET /api/state`: `version`, `simulation_clock`, `orders`, `packages`, `riders`, `events[] {type, message, occurred_at}`

`packages`는 복수 package ID 키를 사용하고, `riders`는 적어도 `R-001`, `R-002`, `R-003`의 상태를 ID 키로 반환한다.

`GET /api/state`에는 복수 `packages`와 각 package의 `offers` 객체, `simulation_clock`, 주문별 `eta_at`도 포함한다. 실제 서버 구현은 REST 상태 변경마다 관계된 고객·사장님·라이더·시연 WebSocket 채널로 갱신 이벤트를 브로드캐스트해야 한다.

### 명령

- `POST /api/demo/weather`: `{"condition":"RAIN | CLEAR"}`
- 빈 JSON 객체로 호출: `/api/demo/dispatch-calculate`, `/api/demo/reset`
