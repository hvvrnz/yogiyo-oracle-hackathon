# ygy-backend

요기요 × Oracle Hackathon — 조리시간 인지 기반 배달 시퀀싱 백엔드

## 개요

주문의 예상 조리시간과 매장/라이더 위치를 바탕으로, 여러 주문을 효율적으로 묶어
배달 순서를 결정하는 배차 엔진과, 그 결과를 자연어로 설명하는 API를 제공한다.

## 폴더 구조

```
ygy-backend/
├── api/
│   ├── main.py                       # FastAPI 앱 진입점, 각 router 등록
│   ├── sequencing_router.py          # /sequencing/... 엔드포인트
│   └── vector_search_router.py       # /vector-search/... 엔드포인트
│
├── handler/
│   ├── sequencing_handler.py         # 배차 알고리즘 실행 (permutation 기반 시퀀싱)
│   ├── vector_search_handler.py      # 조리시간 예측/보정 로직
│   ├── explanation_handler.py        # 배차 결과 → LLM 호출 → 설명 텍스트 생성
│   └── batch_handler.py              # correction_factor 일일 갱신 로직
│
├── repository/
│   ├── sequencing_repo.py            # 배차 관련 DB 접근
│   └── vector_search_repo.py         # Oracle AI Vector Search (조리시간 예측/보정) 접근
│
├── schema/
│   ├── sequencing_schema.py          # 배차 요청/응답 pydantic 모델
│   └── vector_search_schema.py       # 조리시간 예측 요청/응답 모델
│
├── common/
│   ├── config.py                     # 환경설정, 상수
│   ├── db.py                         # Oracle DB 23ai 커넥션
│   └── llm_client.py                 # LLM(OpenAI/Cohere 등) 호출 공통 wrapper
│
├── batch/
│   └── correction_factor_job.py      # correction_factor 일일 갱신 스크립트 (cron + python)
│
├── stream_processor/
│   └── ...                           # Kafka consumer/producer (KRaft mode)
│
├── venv/                             # 로컬 가상환경 (git 추적 안 함, 각자 개별 생성)
├── docker-compose.yml
├── requirements.txt
└── .gitignore
```

## 아키텍처 원칙

- 프론트엔드(`ygy-frontend`)는 아래 API를 호출해서 응답 데이터를 화면에 표시하는
  역할만 수행한다.
- LLM 호출, 프롬프트 설계, 배차 결과 설명 생성 로직은 백엔드
  (`handler/explanation_handler.py`)에서 처리한다. 프론트에서 별도로 LLM API 키를
  갖거나 직접 호출하지 않는다.
- 레이어 구성: `api`(엔드포인트) → `handler`(비즈니스 로직) → `repository`(DB/외부
  접근) 순으로 호출한다. `schema`는 각 레이어에서 공통으로 참조하는 요청/응답 모델.

## 주요 엔드포인트 (예정)

| Method | Path                              | 설명                              |
|--------|------------------------------------|-----------------------------------|
| POST   | `/sequencing/create`               | 주문 목록 받아서 배차 시퀀스 생성 |
| GET    | `/sequencing/{id}/explanation`     | 해당 배차 결과에 대한 자연어 설명 반환 |
| GET    | `/vector-search/predict`           | 조리시간 예측/보정                |

## 인프라

- OCI Compute VM (`ygy-team07-vm`, VM.Standard.E4.Flex, 4 OCPU / 32GB)
- Kafka (KRaft mode, Docker)
- Oracle AI Vector Search (DB 23ai)
- Compartment: `HACK-TEAM-07`

## 환경 설정

각자 작업 디렉토리 안에 개별로 가상환경을 만든다 (venv는 git으로 공유하지 않음).

```
cd ygy-backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```