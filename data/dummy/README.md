# 가상 테스트 데이터

이 디렉터리의 모든 데이터는 `scripts/generate_dummy_data.py`가 생성한 테스트용 데이터입니다.
실제 고객, 음식점, 라이더, 주소, 매출 또는 주문 기록을 포함하지 않습니다.

## 디렉터리 구조

```text
data/dummy/
├─ manifest.json
├─ catalog/
│  ├─ stores.json / stores.csv
│  ├─ customers.json / customers.csv
│  ├─ riders.json / riders.csv
│  ├─ menu_catalog.json
│  ├─ historical_orders.json / historical_orders.csv
│  ├─ cooking_history.json / cooking_history.csv
│  └─ weather_samples.json / weather_samples.csv
└─ scenarios/
   ├─ balanced.json
   ├─ rainy_rush.json
   ├─ store_delay.json
   └─ pickup_first.json
```

## 데이터 재생성

프로젝트 루트에서 다음 명령을 실행합니다.

```bash
python scripts/generate_dummy_data.py --seed 20260804
```

동일한 시드를 사용하면 동일한 데이터가 생성됩니다. 다른 조합이 필요하면 시드만 바꿉니다.

```bash
python scripts/generate_dummy_data.py --seed 20260805
```

## 앱에 적용되는 데이터

실행 중인 화면은 `scenarios/*.json` 중 하나를 사용합니다. 기본값은 `balanced`입니다.

```env
DUMMY_DATASET=balanced
```

지원 시나리오:

- `balanced`: 평시 균형형 기본 발표 시나리오
- `rainy_rush`: 강한 비와 피크타임 혼잡
- `store_delay`: 버거 매장 조리 지연
- `pickup_first`: 모든 음식을 먼저 픽업한 뒤 배달

자세한 적용 방법은 `docs/DUMMY_DATA_GUIDE.md`를 참고하십시오.
