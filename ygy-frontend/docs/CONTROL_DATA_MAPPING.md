# 실제 화면 제어와 API 데이터 매핑

이 문서는 `VITE_USE_MOCK=false`일 때 현재 화면에서 실제로 호출하는 API와 렌더링 데이터를 기록한다. mock 전용 제어는 범위에서 제외한다.

## 공통 데이터 처리

- 구현 위치: `static/backend-client.js`
- 기본 ID: 주문 `118`, 매장 `781`, 라이더 `rider_102`
- `menu_items`, `order_ids`, `route_detail`, `score_detail`은 문자열 JSON 또는 객체 모두를 정규화한다.
- API 오류의 `detail`을 오류 카드·토스트로 표시하며, 조회 실패 화면에는 재시도 동작이 있다.
- 고객 화면은 담당 라이더 프로필만, 라이더 화면은 본인 프로필·패키지만 5초 폴링한다. 역할별 화면은 전체 라이더 목록을 호출하지 않는다.

## 고객 화면 (`/customer?orderId={order_id}`)

| 제어 또는 표시 | API | 응답 데이터 | 동작 |
| --- | --- | --- | --- |
| 주문 조회 | `GET /api/customer/{order_id}` | 매장명·좌표, 배달 좌표, 메뉴, 금액, 상태, ETA, `package_id`, `rider_id` | 주문 카드·배차 번호와 픽업지·배달지 카카오맵 마커 렌더링(키 미설정 시 SVG fallback) |
| 담당 라이더 식별 | `GET /api/customer/{order_id}` | 현재 주문의 `rider_id` | 고객 주문 응답을 단일 진실 원천으로 사용. 라이더가 없으면 주문 지도만 표시 |
| 담당 라이더 위치 | `GET /api/rider/{rider_id}/profile` | 이름, `lat`, `lng` | 담당 라이더 1명만 5초 폴링해 카카오맵 마커 갱신(키 미설정 시 SVG fallback) |
| 주문 취소 | `DELETE /api/customer/{order_id}` | `order_id`, `status` | 성공 후 주문 정보를 재조회 |
| 취소 불가 안내 | `DELETE`의 `400` | `detail` | 고객센터 안내 오류 표시 |

고객 API의 `package_id`, `rider_id`를 직접 사용한다. `DELIVERED`와 기존 목업 호환용 `COMPLETED`는 모두 배달 완료로 표시하고 취소를 막는다. ETA의 상세 시간 근거가 필요하면 좌표·시간이 없는 `route_detail`이 아니라 `score_detail.timeline`에서 해당 주문의 `dropoff.arrival_time_min`을 확인한다.

## 사장님 화면 (`/merchant?storeId={store_id}`)

| 제어 또는 표시 | API | 응답 데이터 | 동작 |
| --- | --- | --- | --- |
| 매장 주문 목록 | `GET /api/merchant/{store_id}` | `orders[]`의 주문·조리시간·패키지·라이더 ID·라이더 이름·도착 ETA·경로 | 주문 목록에 `라이더명 (rider_id)`, ETA, 한글 주문 상태와 배차/방문 순서를 렌더링 |
| 조리시간 수정 | `PUT /api/merchant/orders/{order_id}/cook-time` | `updated_owner_cook_min` | 성공 후 주문 목록 재조회 |
| 매장 지도 | `GET /api/stores` | 매장 ID, 이름, 좌표 | 매장 정보 보강·마커 렌더링 |

`eta_min`이 있으면 실제 API 값으로 “도착 예상: 약 N분”을 표시하고, 없으면 “도착 시간 정보 없음”으로 표시한다. `PICKED_UP`, `DELIVERED`는 각각 “픽업 완료”, “배달 완료”로 표시한다.

## 라이더 화면 (`/rider?riderId={rider_id}`)

| 제어 또는 표시 | API | 응답 데이터 | 동작 |
| --- | --- | --- | --- |
| 라이더 프로필 | `GET /api/rider/{rider_id}/profile` | 이름, 권역, 상태, 완료 건수, 좌표 | 선택 라이더 정보와 카카오맵 좌표→주소 변환 결과 렌더링 |
| 배정 패키지 | `GET /api/rider/{rider_id}` | `packages[]`의 유형·상태·수익·주문 ID·경로·점수 | 패키지 목록과 경로 렌더링 |
| 내 운행 지도 | `GET /api/rider/{rider_id}/profile`, `GET /api/rider/{rider_id}` | 본인 좌표, 패키지 경로 | 본인 위치와 배정 패키지 경로만 5초 갱신하며 카카오맵에 표시(키 미설정 시 SVG fallback) |
| 픽업 완료 | `PUT /api/rider/{rider_id}/package/{package_id}/pickup` | `package_id`, `status` | 성공 후 프로필·패키지 재조회 |
| 배달 완료 | `PUT /api/rider/{rider_id}/package/{package_id}/complete` | `package_id`, `status` | 성공 후 프로필·패키지 재조회 |

API 상태 변경은 패키지 단위다. 주문별 픽업·배달 진행이나 배차 제안 수락/거절 UI는 실제 모드에서 제공하지 않는다.

## 통합 시연 (`/demo`)

통합 시연은 실제 DB를 변경하지 않는 조회 중심 화면이다.

| 패널 | 기본 연결 |
| --- | --- |
| 고객 1개 | 주문 `118` |
| 사장님 3개 | 매장 `781`, `467`, `273` |
| 라이더 3개 | `rider_102`, `rider_103`, `rider_105` |

각 역할 화면은 독립적으로 API를 조회한다. 취소·조리시간 수정·패키지 픽업/완료는 실제 API 모드에서 DB 상태를 바꾸므로 별도 테스트 데이터에서만 실행한다.

## 설명 API 연동 범위

| 기능 | API | 현재 화면 적용 |
| --- | --- | --- |
| LLM 프롬프트 재료 조회 | `GET /api/explanation/context/{package_id}` | API 클라이언트 제공, 생성 UI 미구현 |
| 설명 저장 | `POST /api/explanation` | API 클라이언트 제공, 생성 UI 미구현 |
| 최근 설명 조회 | `GET /api/explanation/{package_id}` | API 클라이언트 제공, 표시 UI 미구현 |

LLM 생성은 서버에서 수행해야 하며, API 키를 프론트 환경변수나 브라우저 코드에 두면 안 된다.
