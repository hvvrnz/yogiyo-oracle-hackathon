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

전체 API 명세는 아래 Notion 문서 참고

[ℹ️ API 명세](https://app.notion.com/p/API-3bcc9e9064bf80e8a1bdf2d967666287?pvs=12) 

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

# 2. 라이더 위치를 Redis Geo에 등록
python stream_processor/riders/geo_client.py

# 3. Kafka 토픽 초기화 (기존 데이터 정리시)
docker exec -it ygy-kafka kafka-topics --bootstrap-server localhost:9092 \
    --delete --topic order-events
docker exec -it ygy-kafka kafka-topics --bootstrap-server localhost:9092 \
    --create --topic order-events --partitions 1 --replication-factor 1

# 4. Consumer 실행 (라이더 위치 시뮬레이터가 백그라운드 스레드로 자동 포함)
python stream_processor/orders/consumer.py

# 5. (새 터미널) Producer 실행 — 더미 주문을 계속 생성해 Kafka로 전송
python stream_processor/orders/producer.py

# 6. (새 터미널) API 서버 실행
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

다음 작업 (별도 브랜치)
 조리시간 예측 고도화: correction_factor를 지금의 카테고리별 고정값 (common/config menu_data.py)에서, Oracle AI Vector Search(vector_cases 테이블) 기반 유사 사례 검색으로 전환