# 화면 제어와 필요 데이터 목록

현재 화면은 `static/common.js`의 mock API를 기본으로 사용한다. 실제 FastAPI 연동 시 `VITE_USE_MOCK=false`와 `VITE_API_BASE_URL`을 설정하면 같은 화면 코드가 REST 응답을 사용한다. 아래 키는 화면 구현을 위한 **임시 제안 키**이며, 백엔드 계약 확정 후 공통 API 경계에서 매핑한다.

## 고객 화면 (`/customer`)

| 제어 | 변경되는 화면 | 필요한 데이터 |
| --- | --- | --- |
| AI 추천 사유 자세히 보기 | bottom sheet 제목, 요약, 근거 3개, 안내문 | `headline`, `summary`, `reasons[] {title, description, metric}`, `note`, `source` |
| 주문 상태 갱신(WebSocket/API) | ETA, 상태 배지, 진행 단계, 묶음 정보, 지도, 날씨 | `order`, `package`, `rider`, `weather`, `route[]` |

고객은 직접 상태를 변경하는 버튼이 없으며, 주문·배차 변화는 조회 데이터 갱신으로 반영한다.

## 사장님 화면 (`/merchant`)

| 버튼 | 변경되는 값 | 요청 데이터 | 갱신에 필요한 응답 데이터 |
| --- | --- | --- | --- |
| 주문 수락 | 주문 상태/라벨, 신규·조리 건수 | `orderId`, `action: "accept"` | `orders[]`, `summary` |
| 조리 시작 | 주문 상태/라벨, 조리 건수 | `orderId`, `action: "start"` | `orders[]`, `summary` |
| +5분 / +10분 | 상태, 예상 조리 시간, 추천 문구 | `orderId`, `action: "delay"`, `delayMin` | `orders[].status`, `predictedCookingMin`, `targetReadyLabel` |
| 조리 완료 | 상태/라벨, 준비 완료 건수, 라이더 대기 정보 | `orderId`, `action: "ready"` | `orders[]`, `summary`, `rider`, `package` |
| 매장 선택 | 매장명, 주문 목록, 혼잡도, 배차 정보 | `storeId` | `store`, `summary`, `orders`, `rider`, `package`, `weather` |
| 추천 근거 | bottom sheet 내용 | `role: "merchant"`, `entityId: storeId` | `headline`, `summary`, `reasons[]`, `note` |

## 라이더 화면 (`/rider`)

| 버튼 | 변경되는 값 | 요청 데이터 | 갱신에 필요한 응답 데이터 |
| --- | --- | --- | --- |
| 3건 묶음 수락 | 배차 상태, 현재 단계, 액션 버튼, 지도 | `riderId`, `action: "accept"` | `rider`, `package`, `steps[]` |
| 거절 | 재배차 상태, 제안 차수, 후보 라이더 안내 | `riderId`, `action: "reject"` | `package.offerAttempt`, `wasRejected`, `offeredRider*`, `reassignmentNote` |
| 현재 단계 완료 | 타임라인 완료 표시, 다음 단계, 배달 완료 상태 | `riderId`, `action: "completeStep"` | `package.currentStep`, `package.status`, `steps[]` |
| 추천 근거 | bottom sheet 내용 | `role: "rider"`, `entityId: riderId` | `headline`, `summary`, `reasons[]`, `note` |

## 통합시연 화면 (`/demo`)

모든 제어 뒤에는 `version`, `packages["PKG-001"]`, `riders`, `events[]`를 다시 조회해 상단 요약, 내장 라이더 화면, 이벤트 로그를 갱신한다.

| 제어 | 변경되는 값 | 요청 데이터 |
| --- | --- | --- |
| 데이터 적용 | 전체 시연 상태, 선택 데이터 세트 | `datasetId` |
| 다음 단계 진행 | `version`, 이벤트 로그, 패키지 상태 | 없음 |
| 현재 라이더 수락 | 라이더/패키지 배차 상태, 이벤트 | 없음 |
| 현재 라이더 거절 / 응답 시간 만료 | 재배차 상태, 제안 차수, 이벤트 | 없음 |
| 버거 매장 +7분 지연 | 주문 조리 상태·예상 시간, 이벤트 | 없음 |
| 신규 주문 만들기 | 주문 수·패키지 요약·이벤트 | 없음 |
| 혼합 최적화 / 전체 픽업 후 배달 | `routeStrategyLabel`, 설명, 이벤트 | `strategy` |
| 비 / 맑음 시나리오 | 고객·사장님·라이더 날씨 정보, 이동 보정, 이벤트 | `condition` |
| 위치 자동 이동 / 일시정지 | `simulationRunning`, 이벤트 | `running` |
| 전체 초기화 | 모든 mock 상태와 이벤트 | 없음 |

## FastAPI 전환 지점

- mock 데이터와 mock 명령 처리: `static/common.js`의 `mock`, `mockApi()`
- 실제 요청 경계: 같은 파일의 `api()`, `apiClient`
- 화면 렌더링: `static/customer/app.js`, `static/merchant/app.js`, `static/rider/app.js`, `static/demo/app.js`

따라서 API 키가 바뀌더라도 가능하면 `apiClient` 또는 그 직전의 응답 매핑만 수정하고, 화면 렌더링 파일은 유지한다.
