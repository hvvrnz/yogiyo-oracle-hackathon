# 프론트엔드-백엔드 API 계약

이 문서는 `ygy-frontend-only`가 화면을 정상 렌더링하기 위해 `ygy-backend`에 요구하는 계약입니다. JSON 키는 프론트에서 직접 참조하므로 이름을 그대로 유지해야 합니다.

## 공통 규칙

- REST 응답 형식: `application/json`
- 성공한 명령 응답: 최소 `{"message": "..."}`
- 실패 응답: `{"detail": "..."}` 또는 `{"message": "..."}`
- WebSocket 경로: `/ws/{role}/{entity_id}`
- 클라이언트는 20초마다 문자열 `ping`을 전송하며 서버는 `{"type":"pong"}`으로 응답
- `pong` 이외의 메시지가 오면 해당 역할 화면이 REST 조회를 다시 수행

## 고객

### `GET /api/customer/{customer_id}`

- `order`: `order_id`, `eta_window`, `current_message`, `delivery_sequence`, `eta_updated_label`, `status`, `status_label`, `menu_summary`, `remaining_min`, `progress_index`, `bag_time_min`, `bag_time_limit_min`, `quality_margin_min`, `quality_guard_passed`, `amount`, `request_note`, `items[] {name, quantity}`
- `store`: `name`
- `package`: `ready_gap_min`, `route_overlap_pct`, `route_strategy_label`, `route_strategy_description`, `route_changed`, `route_change_note`, `offer_attempt`, `reassignment_note`
- `rider`: `assigned`, `current_step_label`, `lat`, `lng`
- `weather`: `condition`, `label`, `temperature_c`, `advisory`
- `route[]`: 지도 좌표 객체. 각 객체는 `lat`, `lng`, `type`, `label`, `is_own` 사용

## 사장님

### `GET /api/merchant/{store_id}`

- `store`: `name`, `category`, `prediction_accuracy_pct`, `congestion`, `base_cooking_min`
- `summary`: `new_count`, `cooking_count`, `ready_count`
- `orders[]`: `order_id`, `status`, `status_label`, `menu_summary`, `created_at`, `amount`, `start_recommendation`, `target_ready_label`, `prediction_confidence_pct`, `predicted_cooking_min`, `expected_rider_wait_min`, `request_note`
- `rider`: `assigned`, `arrival_label`, `remaining_min`, `distance_km`, `context`
- `package`: `status_label`, `bundle_size`, `route_strategy_label`, `ready_gap_min`, `total_wait_min`, `selected_route_reason`, `route_changed`, `route_change_note`, `offer_attempt`, `reassignment_note`
- `weather`: `condition`, `label`, `temperature_c`, `advisory`

### `POST /api/merchant/orders/{order_id}/action`

```json
{"action": "accept | start | ready | delay", "delay_min": 0}
```

`delay`인 경우 화면은 `delay_min`으로 5 또는 10을 전송합니다.

## 라이더

### `GET /api/rider/{rider_id}`

- `rider`: `display_name`, `vehicle`, `status_label`, `lat`, `lng`
- `package`: `status`, `status_label`, `bundle_size`, `hourly_revenue`, `efficiency_reason[]`, `package_revenue`, `estimated_duration_min`, `total_distance_km`, `total_wait_min`, `route_overlap_pct`, `extra_distance_km`, `route_strategy_label`, `route_strategy_description`, `offer_attempt`, `offered_rider_id`, `offered_rider_name`, `was_rejected`, `fallback_triggered`, `reassignment_note`, `route_changed`, `route_change_note`, `current_step`, `accepted`, `can_accept`
- `steps[]`: `sequence`, `status`, `is_current`, `destination`, `address`, `distance_km`, `duration_min`, `eta_label`, `label`, `lat`, `lng`, `type`
- `store_readiness[]`: `status`, `status_label`, `store_name`, `remaining_min`, `ready_at`
- `weather`: `condition`, `label`, `travel_delay_min`, `advisory`

### `POST /api/rider/{rider_id}/action`

```json
{"action": "accept | reject | complete_step"}
```

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

- `GET /api/demo/datasets`: `active_dataset_id`, `datasets[] {dataset_id, name}`
- `GET /api/state`: `version`, `packages.PKG-001`, `riders`, `events[] {type, message, occurred_at}`

### 명령

- `POST /api/demo/dataset`: `{"dataset_id":"..."}`
- `POST /api/demo/route-strategy`: `{"strategy":"optimized | pickup_first"}`
- `POST /api/demo/weather`: `{"condition":"RAIN | CLEAR"}`
- `POST /api/demo/simulation`: `{"running":true}`
- 빈 JSON 객체로 호출: `/api/demo/next`, `/api/demo/rider-accept`, `/api/demo/rider-reject`, `/api/demo/rider-timeout`, `/api/demo/store-delay`, `/api/demo/new-order`, `/api/demo/reset`

