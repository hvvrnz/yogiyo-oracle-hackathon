# ygy-backend

요기요 × Oracle Hackathon — 조리시간 인지 기반 배달 시퀀싱 백엔드

## 개요

사장님이 설정한(그리고 카테고리별 보정계수로 예측한) 조리시간과
매장/라이더 위치를 바탕으로, 여러 주문을 효율적으로 묶어 최적의
배달 순서를 계산하는 배차 엔진과, 그 결과를 라이더/소비자/사장님
화면에 노출하는 API를 제공한다.

## 폴더 구조 (2026-08-13 기준 실제 구현)

```
ygy-backend/
├── api/
│   ├── main.py                       # FastAPI 앱 진입점, 각 router 등록
│   └── routers/
│       ├── rider.py                   # 라이더 목록/프로필/배정패키지/픽업·완료 처리
│       ├── customer.py                 # 소비자 주문 조회/취소
│       ├── merchant.py                  # 사장님 매장 주문 조회/조리시간 수정
│       ├── store.py                      # 매장 전체 목록 (지도용)
│       └── explanation.py                 # LLM 설명 재료 제공/결과 저장·조회
│
├── sequencing_engine/
│   ├── handler/
│   │   ├── scoring.py                 # 경로 점수·수익 계산
│   │   ├── search.py                   # 완전탐색(pickup+dropoff 90가지 후보) 로직
│   │   ├── correction.py                # 조리시간 correction_factor 적용
│   │   ├── assignment.py                 # 라이더 배정 + DB 저장 판단 로직
│   │   └── display.py                     # 콘솔 출력 전용 함수
│   └── repository/
│       ├── package_repo.py             # packages 테이블 저장
│       └── order_repo.py                # orders 테이블 저장
│
├── stream_processor/
│   ├── orders/
│   │   ├── producer.py                # 더미 주문 생성 및 Kafka 전송
│   │   ├── consumer.py                 # Kafka 수신, 30초 윈도우 클러스터링 트리거
│   │   ├── timing.py                    # 짝 못찾은 주문의 대기/한집배달 판단
│   │   └── clustering/
│   │       ├── scoring.py             # 클러스터링 스코어(거리+조리시간+긴급도)
│   │       └── grouping.py             # 클러스터 확정 로직
│   └── riders/
│       ├── geo_client.py               # Redis Geo 등록/검색/위치조회/상태관리
│       └── location_simulator.py        # 라이더 위치 실시간 이동 시뮬레이션
│
├── stores/
│   └── repository/
│       └── store_repo.py               # DUMMY_STORES를 DB stores 테이블에 저장
│
├── riders/
│   └── repository/
│       └── rider_repo.py               # DUMMY_RIDERS를 DB riders 테이블에 저장,
│                                          Redis+DB 라이더 상태 동기화
│
├── common/
│   ├── config/
│   │   ├── __init__.py                # 하위 모듈 전체 재수출
│   │   ├── common.py                   # AVG_SPEED_KMH, SERVICE_REGIONS 등 공통값
│   │   ├── orders.py                    # 클러스터링/조리시간/수익 관련 설정값
│   │   ├── riders.py                     # 라이더 더미 생성 관련 설정값
│   │   └── menu_data.py                   # 카테고리별 메뉴/사이드/가격 데이터
│   ├── dummy/
│   │   ├── stores.py                   # 매장 더미 생성 (region/menu 포함, 캐시 파일 사용)
│   │   ├── riders.py                    # 라이더 더미 생성 (가중치 반영, 캐시 파일 사용)
│   │   ├── stores_generated.json         # 매장 더미 캐시 (1회 생성 후 고정)
│   │   └── riders_generated.json          # 라이더 더미 캐시 (1회 생성 후 고정)
│   ├── geo.py                         # haversine 거리 계산
│   └── rounding.py                     # 금액/시간 단위 반올림 헬퍼
│
├── db/
│   ├── connection.py                  # Oracle 커넥션, execute_and_commit/fetch_all/fetch_one
│   └── schema.sql                      # 전체 테이블 정의
│
├── explanation/                        # LLM 기반 설명 생성 (준영이 담당 영역)
├── vector_search/                      # Vector Search 관련 (조리시간 예측 고도화, 진행 예정)
├── venv/                               # 로컬 가상환경 (git 추적 안 함)
├── requirements.txt
└── .env                                 # DB 접속 정보 (git 추적 안 함)
```

## 아키텍처 원칙

- **역할 분리(handler / repository)**: `handler`는 판단·계산 로직만
  담당하고, DB 접근은 전부 `repository`를 거친다. API 라우터는
  `handler`나 `repository`를 호출만 하고 직접 SQL을 짜지 않는다
  (단, 지금은 조회가 단순해 라우터에서 `db/connection.py`의 헬퍼를
  직접 호출하는 경우도 있음).
  
- **실시간 값 vs 정적 값 분리**: 라이더 위치처럼 자주 바뀌는 값은
  Redis(`stream_processor/riders/geo_client.py`)가 전담하고, DB는
  라이더/매장 등 상대적으로 정적인 정보만 관리한다. 라이더의 배정
  가능 여부(BUSY/AVAILABLE)도 Redis가 실시간 판단의 기준이다.
  
- **더미 데이터 일관성**: 매장/라이더 더미는 스크립트 실행마다
  랜덤하게 재생성되면 DB와 Kafka 파이프라인이 서로 다른 데이터를
  참조하는 문제가 있어, 최초 1회 생성 후 JSON 파일로 캐싱해 이후
  실행에서는 항상 동일한 데이터를 쓰도록 했다.
- **주문 단위 vs 매장 단위 값 분리**: 조리시간은 매장의 고정 속성이
  아니라 "그 주문이 접수될 때 사장님이 매긴 값"이라는 걸 확인하고,
  `stores`에는 평균 배달 ETA만 남기고 조리시간은 `orders.owner_cook_min`
  (사장님 설정값)/`predicted_cook_min`(시스템 예측값)으로 옮겼다.
- 프론트엔드(`ygy-frontend`)는 아래 API를 호출해서 응답 데이터를
  화면에 표시하는 역할만 수행한다. LLM 호출, 프롬프트 설계는 프론트
  담당이지만, DB 저장/조회는 `api/routers/explanation.py`를 통해서만
  한다(DB/SQL 직접 접근 금지).

## 주요 엔드포인트 

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/rider` | 전체 라이더 목록 (Redis 실시간 위치 포함) |
| GET | `/api/rider/{rider_id}` | 특정 라이더의 배정 패키지 목록 |
| GET | `/api/rider/{rider_id}/profile` | 라이더 개인 정보 |
| PUT | `/api/rider/{rider_id}/package/{package_id}/pickup` | 픽업 완료 처리 |
| PUT | `/api/rider/{rider_id}/package/{package_id}/complete` | 배달 완료 처리 |
| GET | `/api/customer/{order_id}` | 주문 상태/ETA/좌표 조회 |
| DELETE | `/api/customer/{order_id}` | 주문 취소 |
| GET | `/api/package/{package_id}` | 
| GET | `/api/merchant/{store_id}` | 매장 주문 목록 조회 |
| PUT | `/api/merchant/orders/{order_id}/cook-time` | 조리시간 수정 |
| GET | `/api/stores` | 전체 매장 목록 | 패키지(묶음/한집배달) 단건 상세 조회 |
| GET | `/api/explanation/context/{package_id}` | LLM 프롬프트 재료 조회 |
| POST | `/api/explanation` | LLM 생성 설명 저장 |
| GET | `/api/explanation/{package_id}` | 저장된 설명 조회 |



## 인프라

- OCI Compute VM (`ygy-team07-vm`, VM.Standard.E4.Flex, 4 OCPU / 32GB)
- Kafka (KRaft mode, Docker)
- Redis (Docker)
- Oracle Autonomous DB 23ai (Vector Search 지원)
- Compartment: `HACK-TEAM-07`

## 환경 설정

각자 작업 디렉토리 안에 개별로 가상환경을 만든다 (venv는 git으로 공유하지 않음).

```bash
cd ygy-backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

`.env` 파일에 DB 접속 정보(DB_USER, DB_PASSWORD, DB_DSN,
WALLET_LOCATION, WALLET_PASSWORD)가 필요하며, 이 파일은 git에
커밋하지 않는다.

## 전체 파이프라인 실행 순서

```bash
# 1. 매장/라이더 더미 데이터를 DB에 저장 (최초 1회 또는 재초기화 시)
python stores/repository/store_repo.py
python riders/repository/rider_repo.py

# 2. 라이더 위치를 Redis Geo에 등록 (최초 1회 또는 재초기화 시)
python -m stream_processor.riders.geo_client

# 3. Consumer 실행 (라이더 위치 시뮬레이터가 백그라운드 스레드로 자동 포함,
#    따로 실행할 필요 없음)
python -m stream_processor.orders.consumer

# 4. (새 터미널) Producer 실행 — 더미 주문을 계속 생성해 Kafka로 전송
#    10~20초 정도 돌린 뒤 Ctrl+C로 멈춰도 무방 (그동안 쌓인 주문으로 충분)
python -m stream_processor.orders.producer

# 5. (새 터미널) 대기 중(NEW)인 주문에 조리시간을 입력해 COOKING으로 전환
#    이 단계가 있어야 consumer의 클러스터링 대상에 주문이 포함됨
python cook_demo_orders.py --limit 10

# 6. consumer 윈도우가 한 바퀴 돌 때까지 대기 (WINDOW_SECONDS 만큼),
#    "묶음 확정 시도" 로그가 뜨는지 3번 터미널에서 확인

# 7. (새 터미널) 배차 제안(OFFERED)된 패키지에 라이더 수락 처리
python accept_demo_packages.py --limit 5

# 8. (필요 시) API 서버 실행
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

**참고**
- 2번(Redis 라이더 등록)은 DB/Redis 데이터가 유지되는 한 매번 다시 할 필요 없음. Redis가 초기화됐거나 라이더 데이터를 바꿨을 때만 재실행.
- 3번(consumer)은 켜두면 `WINDOW_SECONDS`(현재 15초)마다 자동으로 `COOKING` 상태 주문을 모아 클러스터링·배차를 시도함. 4~7번은 이 3번이 켜진 상태에서 순서대로 실행.
- `cook_demo_orders.py`, `accept_demo_packages.py`는 데모/검증용 스크립트로, 실제 서비스라면 프론트(사장님 화면의 조리시작 버튼, 라이더 화면의 수락 버튼)가 대신 호출하는 API를 시뮬레이션하는 역할.


## AI(조리시간 예측) 구현

### 구현 완료

- Oracle Generative AI(Cohere Embed)로 실제 임베딩 생성

- vector_cases 테이블에 실제 벡터 데이터 시딩

- 신규매장 조리시간 예측 4단계 fallback 검색:
  1) 같은 지역+같은 브랜드
  2) 다른 지역+같은 브랜드
  3) 같은 지역+같은 카테고리(다른 브랜드 or 개인매장) - 시연 case
  4) 카테고리 전체(지역 무관)

- 사장님 화면(merchant_text)에 LLM 적용 — case/fallback 단계에  따라 매번 다른 설명이 필요해 LLM이 실제로 필요한 지점
- 지역보다 같은 브랜드를 fallback 우선순위로 잡은 이유:
  - 같은 지역, 다른 브랜드
    → 위치는 같지만, 조리법·메뉴 구성·주방 동선이 완전히 다름
    → "조리시간"이라는 값 자체를 예측하는 데는 참고가 약함

  - 다른 지역, 같은 브랜드(예: 신림의 요기요햄버거)
      → 위치는 다르지만, 조리법·메뉴·매뉴얼이 똑같음
      → "이 브랜드는 원래 이 메뉴에 시간이 이만큼 걸린다"는 본질적인 정보가 더 정확하게 반영됨

### 설계 원칙 — AI 사용 지점
- 배차(라이더 매칭): 물리적 거리 기준 → 완전탐색 알고리즘
- 조리시간 예측(사장님): 조리 프로세스 유사성 기준 → 
  벡터 검색(브랜드/카테고리)
- 라이더 안내(교통/날씨): 실시간 사실 전달 → API 호출 + 템플릿 
  (판단이 필요 없어 LLM 불필요)
- 소비자 안내: 사장님/라이더 대응 결과를 요약 전달 → 템플릿
  (마찬가지로 판단이 필요 없어 LLM 불필요)
- → LLM은 "여러 경우의 수를 종합해서 설명해야 하는 지점"에만 선택적으로 적용, 나머지는 실시간 API 또는 템플릿으로 처리

### TO DO
- cron 기반 자동 데이터 갱신 (현재는 1회 시딩)
- 라이더 교통정보 / 실제 기상청 API 연동 (현재는 상수)