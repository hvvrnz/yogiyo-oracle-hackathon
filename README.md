# 실속배달 — 조리시간 기반 배달 순서 최적화
> 요기요 x Oracle Hackathon (2026)

## 프로젝트 소개

동시에 접수된 여러 주문의 조리시간을 예측하고, 이를 반영해 라이더의 배달 순서를
최적화하는 시스템. "조리 완료 시점"까지 고려한 순서 최적화로 음식이 식지 않게,
라이더 동선은 효율적으로 만드는 것이 목표.

## 핵심 아이디어

1. 실시간으로 들어오는 주문을 Kafka로 스트림 처리하며 클러스터링
2. Redis Geo로 클러스터 근처 라이더 검색
3. Python 완전탐색으로 클러스터 내 배달 순서 스코어링 및 최적 순서 도출
4. Oracle AI Vector Search(23ai)로 과거 유사 주문 임베딩을 조회해 조리시간 예측 보정
5. Oracle Autonomous Database(ADB)에 주문/배차/보정계수 데이터를 저장하고,
   배차 결과에 대한 설명을 LLM으로 생성해 프론트엔드에 제공

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| 스트림 처리 | Kafka (KRaft 모드, Zookeeper 미사용) |
| 라이더 검색 | Redis (Geo 인덱스) |
| 순서 최적화 | Python (완전탐색 기반 스코어링) |
| 조리시간 예측 보정 | Oracle AI Vector Search (23ai) + Cohere Embed 4 |
| 데이터베이스 | Oracle Autonomous Database (ADB, Developer 옵션) |
| 배차 결과 설명 생성 | LLM (배차 결과 → 자연어 설명, 백엔드에서 처리) |
| API 서버 | FastAPI |
| 프론트엔드 | React |
| 배치 처리 | cron + Python (Airflow 미사용 — 해커톤 규모 고려) |
| 인프라 | OCI Compute VM (Oracle Linux 8), VCN/Subnet/IGW 구성 |
| 컨테이너 | Docker (Kafka, Redis만 컨테이너화, 나머지는 VM에 직접 설치) |

## 아키텍처 흐름

```
주문 발생 → Kafka 스트림 처리 (클러스터링)
    ↓
Redis Geo로 근처 라이더 검색
    ↓
Sequencing Engine (완전탐색 순서 최적화)
    ↓
Oracle Vector Search로 조리시간 예측 보정
    ↓
Oracle Autonomous Database에 결과 저장
    ↓
LLM으로 배차 결과 설명 생성
    ↓
FastAPI로 최종 배달 순서 + 설명 반환
    ↓
React 프론트엔드에서 역할별(고객/사장님/라이더) 화면 표시
```

## 디렉토리 구조

프로젝트 루트는 역할별로 `ygy-backend/`, `ygy-frontend/`로 나뉜다.


## 개발 환경

- OCI Compute VM (`ygy-team07-vm`, VM.Standard.E4.Flex, 4 OCPU/32GB, Oracle Linux 8)
  위에서 VS Code Remote-SSH로 작업
- Kafka, Redis는 Docker Compose로 실행
- Python 서비스(stream_processor, sequencing_engine, api, batch)는 VM에 직접
  설치해서 실행
- Oracle Autonomous Database는 Developer 옵션으로 생성해 사용
- Compartment: `HACK-TEAM-07`

## 팀

| 이름 | 역할 |
| --- | --- |
| 황윤정 | 백엔드 · 인프라 · 배차 알고리즘 · 실시간 스트림 처리 · 조리시간 예측 보정 (FastAPI, OCI, Kafka, Redis, ADB, Vector Search, Sequencing Engine) |
| 박준영 | 프론트엔드 설계 및 구현 · 고객/사장님/라이더 역할별 화면 UI/UX · 실시간 데이터 연동 (React, 웹소켓) · LLM 기반 배차 설명 설계 및 구현 (OCI Generative AI, 프롬프트, 응답 API) |