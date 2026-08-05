# 실속배달 — 조리시간 기반 배달 순서 최적화

**요기요 × Oracle Hackathon 2026**  
팀: 황윤정, 박준영

## 프로젝트 소개

동시에 접수된 여러 주문의 조리시간을 예측하고, 이를 반영해 라이더의 픽업·배달 순서를 최적화하는 시스템입니다.

단순히 가까운 주문을 묶는 것이 아니라 다음 항목을 함께 고려합니다.

- 매장별 조리 완료 예상시각
- 라이더의 매장 도착 예상시각
- 라이더 대기시간
- 음식 조리 후 방치시간
- 픽업 후 가방 체류시간
- 고객 예상 도착시간
- 전체 이동거리와 시간당 환산 수익

고객에게는 도착시간·묶음 사유·품질 보호 근거를, 사장님에게는 조리 완료 목표시각과 라이더 도착시각을, 라이더에게는 배차 효율과 추천 방문 순서를 제공합니다.

## 핵심 아이디어

- Kafka로 실시간 주문 이벤트를 처리하고 최대 3건 단위로 클러스터링
- Redis Geo로 첫 픽업 매장 주변의 배차 가능 라이더 검색
- Python 완전탐색으로 유효한 픽업·배달 순서를 스코어링
- Oracle AI Vector Search와 Cohere Embed 4로 과거 유사 주문을 찾아 조리시간 예측 보정
- FastAPI REST API와 WebSocket으로 고객·사장님·라이더 화면 동기화
- 라이더가 배차를 거절하거나 응답하지 않으면 다음 후보에게 자동 재배차
- cron + Python으로 매장별 조리시간 보정계수 갱신

> 현재 웹 데모는 외부 인프라 없이 실행되도록 메모리 상태와 가상 데이터를 사용합니다. Kafka, Redis, Oracle AI Database, 공공데이터 및 지도 API는 동일한 인터페이스의 실제 구현체로 교체할 수 있습니다.

## 기술 스택

| 영역 | 기술 |
|---|---|
| 스트림 처리 | Kafka, KRaft 모드 |
| 주문 클러스터링 | Python, 30초 윈도우, 최대 3건 |
| 라이더 검색 | Redis Geo 연동 예정, 현재 가상 라이더 후보 사용 |
| 순서 최적화 | Python 완전탐색 기반 스코어링 |
| 조리시간 예측 보정 | Oracle AI Vector Search + Cohere Embed 4 |
| API 및 실시간 통신 | FastAPI, WebSocket |
| 배치 처리 | cron + Python |
| 인프라 | OCI Compute VM, Oracle Linux 8 |
| 컨테이너 | Kafka·Redis만 Docker Compose 사용 예정 |
| 화면 | HTML, CSS, JavaScript 모바일 POC |

## 아키텍처 흐름

```text
주문 발생
  ↓
Kafka 주문 이벤트 처리
  ↓
주문 클러스터링
  ↓
Redis Geo 근처 라이더 후보 검색
  ↓
Sequencing Engine
- 픽업·배달 유효 순서 생성
- 조리시간·품질·ETA·거리 스코어링
  ↓
Oracle Vector Search 조리시간 2차 보정
  ↓
FastAPI
  ├─ 고객 화면
  ├─ 사장님 화면
  ├─ 라이더 화면
  └─ 통합 시연 화면
```

## 디렉토리 구조

```text
yogiyo-ai-batch-demo-v1.2.0/
├─ stream_processor/
│  ├─ consumer.py                 # Kafka Consumer 경계
│  └─ clustering.py               # 30초 주문 윈도우·최대 3건 클러스터링
├─ sequencing_engine/
│  ├─ optimizer.py                # 픽업·배달 순서 및 전략 지표 생성
│  └─ dispatch.py                 # 라이더 후보 점수화·자동 재배차
├─ api/
│  ├─ main.py                     # FastAPI 애플리케이션 생성
│  ├─ runtime.py                  # 공통 상태·WebSocket 연결 관리자
│  └─ routers/
│     ├─ pages.py                 # 화면 라우트
│     ├─ system.py                # 상태·지도 설정·설명 API
│     ├─ customer.py              # 고객 API
│     ├─ merchant.py              # 사장님 API
│     ├─ rider.py                 # 라이더 API
│     ├─ demo.py                  # 발표 시나리오 제어 API
│     └─ websocket.py             # 실시간 연결
├─ batch/
│  └─ update_correction_factors.py # cron용 조리시간 보정계수 계산
├─ vector_search/
│  ├─ embeddings.py               # Cohere Embed 4 교체 경계
│  └─ client.py                   # Oracle Vector Search 교체 경계
├─ common/
│  ├─ config.py                   # .env 및 공통 설정
│  ├─ models.py                   # Pydantic 요청·응답 모델
│  ├─ state.py                    # 통합 데모 상태와 상태 전이
│  ├─ dummy_data.py               # 가상 데이터 로딩·현재 시각 변환
│  ├─ explanations.py             # 역할별 GenAI 설명과 fallback
│  └─ providers.py                # 공공데이터·길찾기·날씨 Provider 경계
├─ static/
│  ├─ customer/                   # 고객 화면
│  ├─ merchant/                   # 사장님 화면
│  ├─ rider/                      # 라이더 화면
│  └─ demo/                       # 통합 시연 화면
├─ data/dummy/                    # 가상 매장·고객·라이더·주문·시나리오
├─ scripts/generate_dummy_data.py # 가상 데이터 재생성
├─ tests/test_app.py              # API·상태 전이·개인정보·재배차 테스트
├─ app.py                         # 기존 Uvicorn 명령 호환 진입점
└─ requirements.txt
```

루트 `app.py`는 기존 실행 명령과의 호환을 위한 래퍼이며, 실제 FastAPI 애플리케이션은 `api/main.py`에 있습니다.

## 구현된 화면

- `/customer?customerId=C-001`: ETA, 진행 상태, 묶음 이유, 품질 가드레일
- `/merchant?storeId=S-001`: 조리 완료 목표, 라이더 도착 ETA, 지연 입력
- `/rider?riderId=R-001`: 배차 효율, 추천 순서, 수락·거절·단계 완료
- `/demo`: 세 역할 화면, 데이터 세트 및 발표 시나리오 제어
- `/docs`: FastAPI 자동 API 문서

## 라이더 자동 재배차

초기 패키지는 가장 적합한 후보 라이더에게 제안됩니다. 라이더가 거절하면 해당 라이더를 패키지의 제외 목록에 넣고, 남은 후보를 다시 점수화해 가장 적합한 다음 라이더에게 즉시 제안합니다.

```text
R-001 제안
  ↓ 거절
R-001 제외
  ↓
R-002 자동 제안
  ↓ 거절
R-002 제외
  ↓
R-003 자동 제안
```

후보 점수에는 다음 값이 반영됩니다.

- 라이더에서 첫 픽업 매장까지의 거리
- 예상 매장 도착시간
- 라이더 평균 이동속도
- 날씨 이동 지연
- 최근 거절 페널티
- 현재 다른 패키지 수행 여부

모든 후보가 거절하거나 응답하지 않으면 `NO_RIDER_AVAILABLE` 상태가 되며, 실제 시스템에서는 Redis Geo 탐색 반경 확대 또는 단건 배차 fallback으로 연결합니다.

주요 설정:

```env
AUTO_REASSIGN_ENABLED=true
RIDER_OFFER_TIMEOUT_SEC=30
```

자세한 상태·API·수정 파일은 `docs/AUTO_REASSIGNMENT.md`를 참고하십시오.

## 경로 전략

- `optimized`: 조리시간과 가방 체류시간을 고려해 픽업과 배달을 혼합
- `pickup_first`: 모든 음식을 먼저 픽업한 뒤 고객에게 배달

두 전략 모두 주문별 픽업이 해당 주문 배달보다 먼저 수행되며 품질·ETA 기준을 검사합니다.

## Windows 실행

Conda 환경을 사용하는 경우:

```powershell
conda create -n yogiyo-ai python=3.11 -y
conda activate yogiyo-ai
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

실제 FastAPI 모듈을 직접 지정해도 됩니다.

```powershell
python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```

접속:

```text
http://127.0.0.1:8000
http://127.0.0.1:8000/demo
http://127.0.0.1:8000/docs
```

## 가상 테스트 데이터

```text
data/dummy/catalog/    매장·고객·라이더·과거 주문·조리 이력
data/dummy/scenarios/  평시·우천·매장 지연·전체 픽업 시나리오
```

가상 데이터를 다시 생성하려면:

```powershell
python scripts/generate_dummy_data.py --seed 20260804
```

## 테스트

```powershell
python -m pytest -q
```

현재 테스트 범위:

- 고객·사장님·라이더 화면 및 API
- 역할별 개인정보 제한
- 조리 지연 및 ETA 재계산
- 혼합 최적화·전체 픽업 전략
- 라이더 수락·거절
- 거절 후 다음 후보 자동 재배차
- 제안 응답 시간 초과 후 자동 재배차
- 모든 후보 소진 fallback
- README 기준 디렉토리 구조

## 문서

- `docs/ARCHITECTURE.md`: 화면·서버·실서비스 교체 구조
- `docs/AUTO_REASSIGNMENT.md`: 라이더 자동 재배차 상세
- `docs/DATA_CONTRACT.md`: 원천·더미·계산 데이터 계약
- `docs/DUMMY_DATA_GUIDE.md`: 가상 데이터 생성과 적용
- `docs/MAP_AND_ROUTE_STRATEGY.md`: 지도와 경로 전략
- `docs/SCREEN_SPEC.md`: 역할별 화면 구성
- `CHANGELOG.md`: 버전별 변경사항
