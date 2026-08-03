# 실속배달 — 조리시간 기반 배달 순서 최적화
> 요기요 x Oracle Hackathon (2026)

## 프로젝트 소개
동시에 접수된 여러 주문의 조리시간을 예측하고, 이를 반영해 라이더의 배달 순서를 최적화하는 시스템.
"조리 완료 시점"까지 고려한 순서 최적화로 음식이 식지 않게, 라이더 동선은 효율적으로 만드는 것이 목표.

## 핵심 아이디어
1. 실시간으로 들어오는 주문을 Kafka로 스트림 처리하며 클러스터링
2. Redis Geo로 클러스터 근처 라이더 검색
3. Python 완전탐색으로 클러스터 내 배달 순서 스코어링 및 최적 순서 도출
4. Oracle AI Vector Search(23ai)로 과거 유사 주문 임베딩을 조회해 조리시간 예측 보정

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| 스트림 처리 | Kafka (KRaft 모드, Zookeeper 미사용) |
| 라이더 검색 | Redis (Geo 인덱스) |
| 순서 최적화 | Python (완전탐색 기반 스코어링) |
| 조리시간 예측 보정 | Oracle AI Vector Search (23ai) + Cohere Embed 4 |
| API 서버 | FastAPI |
| 배치 처리 | cron + Python (Airflow 미사용 — 해커톤 규모 고려) |
| 인프라 | OCI Compute VM (Oracle Linux 8), VCN/Subnet/IGW 구성 |
| 컨테이너 | Docker (Kafka, Redis만 컨테이너화, 나머지는 VM에 직접 설치) |

## 아키텍처 흐름

주문 발생 → Kafka 스트림 처리 (클러스터링)
↓
Redis Geo로 근처 라이더 검색
↓
Sequencing Engine (완전탐색 순서 최적화)
↓
Oracle Vector Search로 조리시간 예측 보정
↓
FastAPI로 최종 배달 순서 반환


## 디렉토리 구조
- `stream_processor/`: Kafka Consumer, 주문 클러스터링 로직
- `sequencing_engine/`: 완전탐색 기반 배달 순서 최적화 엔진
- `api/`: FastAPI 서버, 라우터
- `batch/`: cron으로 실행되는 조리시간 보정계수 갱신 스크립트
- `vector_search/`: Oracle Vector Search 연동, Cohere Embed 호출
- `common/`: DB 커넥션, 환경설정 등 공통 유틸

## 개발 환경
- OCI Compute VM (VM.Standard.E4.Flex, 4 OCPU/32GB, Oracle Linux 8) 위에서 VS Code Remote-SSH로 작업
- Kafka, Redis는 Docker Compose로 실행
- Python 서비스(stream_processor, sequencing_engine, api, batch)는 VM에 직접 설치해서 실행

## 팀
- 황윤정, 박준영