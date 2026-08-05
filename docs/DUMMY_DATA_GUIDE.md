# 가상 데이터 생성 및 프로젝트 적용 가이드

## 1. 목적

`yogiyo-ai-batch-demo-v1.1.0`은 외부 API와 실제 운영 데이터가 없어도 고객·사장님·라이더 화면과 실시간 상호작용을 테스트할 수 있도록 가상 데이터 모드를 제공합니다.

가상 데이터는 다음 용도로 사용합니다.

- 역할별 화면 렌더링 테스트
- 실시간 WebSocket 갱신 테스트
- 경로 전략 비교
- 조리 지연 및 ETA 재계산 테스트
- 음식 품질 가드레일 테스트
- 조리시간 예측용 과거 데이터 테스트
- 향후 Oracle AI Database 적재 전 데이터 구조 검증
- 발표 시나리오 반복 실행

모든 인물, 매장, 주소, 좌표, 주문, 금액과 이력은 테스트를 위해 생성된 정보이며 실제 데이터가 아닙니다.

---

## 2. 생성된 데이터 종류

### 2.1 매장 데이터

파일:

```text
data/dummy/catalog/stores.json
data/dummy/catalog/stores.csv
```

주요 필드:

- `store_id`
- `name`
- `category`
- `address`
- `lat`, `lng`
- `base_cooking_min`
- `bag_time_limit_min`
- `correction_factor`
- `prediction_accuracy_pct`
- `open`

총 12개의 가상 매장을 생성합니다.

### 2.2 고객 데이터

파일:

```text
data/dummy/catalog/customers.json
data/dummy/catalog/customers.csv
```

주요 필드:

- `customer_id`
- `display_name`
- `delivery_area`
- `delivery_address`
- `lat`, `lng`
- `request_note`

총 36명의 가상 고객을 생성합니다.

### 2.3 라이더 데이터

파일:

```text
data/dummy/catalog/riders.json
data/dummy/catalog/riders.csv
```

주요 필드:

- `rider_id`
- `display_name`
- `vehicle`
- `status`
- `lat`, `lng`
- `average_speed_kmh`

총 8명의 가상 라이더를 생성합니다.

### 2.4 과거 주문 데이터

파일:

```text
data/dummy/catalog/historical_orders.json
data/dummy/catalog/historical_orders.csv
```

주요 필드:

- 주문·매장·고객 ID
- 주문 일자와 시간대
- 메뉴와 수량
- 주문 금액
- 날씨
- 매장 동시 주문량
- 예측 조리시간
- 실제 조리시간
- 예측 오차

총 80건을 생성합니다. 이 데이터는 조리시간 예측, 임베딩, 유사 주문 검색, 통계 화면 테스트에 사용할 수 있습니다.

### 2.5 조리 이력 데이터

파일:

```text
data/dummy/catalog/cooking_history.json
data/dummy/catalog/cooking_history.csv
```

주요 필드:

- 요일과 시간대
- 메뉴 개수
- 매장 혼잡도
- 날씨
- 기본 조리시간
- 매장 보정계수
- 예측 조리시간
- 실제 조리시간

총 80건을 생성합니다.

### 2.6 날씨 샘플

파일:

```text
data/dummy/catalog/weather_samples.json
data/dummy/catalog/weather_samples.csv
```

다음 세 상태를 제공합니다.

- 맑음
- 비
- 강한 비

`travel_delay_min`은 기상청이 제공하는 값이 아니라 데모에서 날씨가 이동시간에 미치는 영향을 표현하기 위해 생성한 보정값입니다.

---

## 3. 화면 실행용 시나리오

화면에서 직접 사용하는 데이터는 다음 파일입니다.

```text
data/dummy/scenarios/balanced.json
data/dummy/scenarios/rainy_rush.json
data/dummy/scenarios/store_delay.json
data/dummy/scenarios/pickup_first.json
```

### `balanced`

- 평시 기본 시나리오
- 세 주문의 조리 완료시각이 비교적 가까움
- 혼합 최적화 경로 사용
- 날씨 지연 없음
- 발표 시작 상태로 권장

### `rainy_rush`

- 강한 비
- 매장 혼잡도 증가
- 이동시간 보정 6분
- ETA 신뢰도와 시간당 수익이 낮아지는 상황 확인

### `store_delay`

- 두 번째 버거 매장의 조리가 크게 지연됨
- 혼합 경로 재계산 필요
- 고객 ETA와 라이더 대기시간 변화 확인

### `pickup_first`

- 세 음식이 거의 동시에 준비됨
- 모든 매장을 먼저 방문한 뒤 배달
- `pickup_first` 경로 전략이 기본값

---

## 4. 가상 데이터 생성 방법

### 기본 데이터 재생성

프로젝트 루트에서 실행합니다.

```powershell
python scripts/generate_dummy_data.py --seed 20260804
```

### 다른 무작위 조합 생성

```powershell
python scripts/generate_dummy_data.py --seed 20260805
```

동일한 시드는 동일한 데이터를 만듭니다. 테스트 재현이 필요하면 팀원 모두 같은 시드를 사용하십시오.

### 별도 폴더에 생성

```powershell
python scripts/generate_dummy_data.py `
  --seed 20260804 `
  --output data\dummy-temp
```

앱이 자동으로 읽는 기본 위치는 `data/dummy/scenarios`입니다. 별도 위치로 생성한 경우 필요한 시나리오 JSON을 기본 위치로 복사해야 합니다.

---

## 5. 프로젝트 적용 방법

### 방법 A: `.env`에서 기본 데이터 세트 지정

`.env`에 다음 값을 추가합니다.

```env
DUMMY_DATASET=balanced
```

사용 가능한 값:

```text
balanced
rainy_rush
store_delay
pickup_first
```

서버를 재시작하면 해당 시나리오가 최초 상태로 로드됩니다.

```powershell
python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

### 방법 B: `/demo` 화면에서 변경

브라우저에서 다음 주소를 엽니다.

```text
http://127.0.0.1:8000/demo
```

상단 `가상 데이터 세트` 선택 상자에서 시나리오를 고르고 `데이터 적용`을 누릅니다.

이 방식은 서버를 재시작하지 않고 다음 상태를 모두 교체합니다.

- 매장
- 고객 주문
- 라이더
- 날씨
- 패키지 지표
- 경로 전략
- ETA
- 가방 체류시간
- 이벤트 로그

### 방법 C: REST API로 변경

조회:

```http
GET /api/demo/datasets
```

적용:

```http
POST /api/demo/dataset
Content-Type: application/json

{
  "dataset_id": "rainy_rush"
}
```

PowerShell 예시:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/demo/dataset `
  -ContentType "application/json" `
  -Body '{"dataset_id":"rainy_rush"}'
```

적용 여부 확인:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/demo/datasets
```

---

## 6. 데이터 적용 흐름

```text
scenario JSON
  ↓ services/dummy_data.py 검증
  ↓ 상대 시간 값을 현재 실행 시각 기준으로 변환
  ↓ DemoState에 매장·주문·라이더·날씨 주입
  ↓ 경로 단계 및 고객별 ETA 계산
  ↓ REST API 응답 생성
  ↓ WebSocket으로 세 역할 화면 갱신
```

시나리오 파일의 시간은 절대 날짜가 아니라 `ready_offset_min`과 같은 상대값으로 저장합니다. 따라서 파일을 며칠 뒤 실행해도 현재 시각 기준의 자연스러운 ETA가 생성됩니다.

---

## 7. 주요 시나리오 파일 구조

```json
{
  "dataset_id": "balanced",
  "weather": {},
  "stores": [],
  "customers": [],
  "riders": [],
  "orders": [],
  "package": {
    "default_strategy": "optimized",
    "strategy_profiles": {},
    "route_blueprints": {}
  }
}
```

### 주문 상대 시간 필드

- `created_offset_min`: 현재 시각 기준 주문 발생 시점
- `ready_offset_min`: 현재 시각 기준 조리 완료 예상 시점
- `recommended_start_offset_min`: 현재 시각 기준 조리 시작 권장 시점

예를 들어 `ready_offset_min: 9`는 서버가 데이터 세트를 불러온 시점으로부터 9분 뒤를 의미합니다.

### 경로 전략 프로필

각 시나리오는 다음 두 전략을 모두 포함합니다.

- `optimized`: 픽업과 배달을 혼합한 최적화 경로
- `pickup_first`: 모든 음식을 픽업한 후 배달하는 경로

전략별로 다음 값이 달라집니다.

- 예상 소요시간
- 총 이동거리
- 추가 이동거리
- 매장 대기시간
- 경로 중복률
- 시간당 환산 수익
- 주문별 가방 체류시간

---

## 8. 새로운 시나리오 추가 방법

1. 기존 `balanced.json`을 복사합니다.
2. 파일명을 영문 소문자와 밑줄로 작성합니다.
3. `dataset_id`를 파일명과 동일하게 변경합니다.
4. 매장·주문·날씨·패키지 값을 수정합니다.
5. 서버 실행 중 `/api/demo/datasets`를 다시 조회합니다.

예시:

```text
data/dummy/scenarios/snow_peak.json
```

```json
{
  "dataset_id": "snow_peak",
  "name": "폭설 피크타임",
  "description": "폭설로 이동시간이 크게 증가하는 테스트"
}
```

서버는 시나리오 디렉터리의 JSON 파일을 자동으로 목록에 포함합니다.

주의사항:

- 현재 화면과 액션은 `S-001~S-003`, `C-001~C-003`, `O-001~O-003`, `R-001`, `PKG-001`을 기준으로 동작합니다.
- 각 주문의 `store_id`와 `customer_id`는 실제 시나리오 내부에 존재해야 합니다.
- 패키지 `order_ids`는 주문 목록과 일치해야 합니다.
- 두 경로 전략에 모두 경로 단계와 지표를 제공해야 합니다.

---

## 9. 실제 API 데이터로 전환할 때

가상 데이터는 화면과 상태 전이를 검증하는 용도입니다. 실제 연동 단계에서는 다음처럼 교체합니다.

```text
가상 음식점      → 공공데이터포털 음식점 데이터
가상 이동거리    → 카카오모빌리티 길찾기 API
가상 날씨        → 기상청 실황·예보 API
가상 현재 상태   → Redis
가상 이벤트      → Kafka
가상 영구 이력   → Oracle AI Database 26ai
```

화면 API 계약은 유지하고 `common/providers.py`와 저장소 계층만 교체하는 방향이 적합합니다.

---

## 10. 테스트

전체 자동 테스트:

```powershell
python -m pytest -q
```

가상 데이터 관련 확인 항목:

- 네 시나리오 목록 조회
- 시나리오 전환
- 전환 후 고객·사장님·라이더 화면 데이터 변경
- 현재 시나리오 초기화
- 잘못된 데이터 세트 거부
- 역할별 개인정보 경계 유지
