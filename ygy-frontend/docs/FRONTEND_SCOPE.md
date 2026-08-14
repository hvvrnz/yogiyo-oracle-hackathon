# 프론트엔드 구현 범위

## 현재 구조

`ygy-frontend`는 Vite 기반의 정적 화면 셸과 역할별 DOM 스크립트로 구성된다.

- `frontend/src/main.jsx`: URL에 맞는 정적 HTML 템플릿과 화면 스크립트를 로드한다.
- `static/common.js`: 공통 DOM 도구, 토스트, 상태 표시를 제공한다.
- `static/backend-client.js`: 실제 FastAPI 요청, 오류 처리, 응답 정규화, 폴링을 담당한다.
- `static/mock-client.js`: `VITE_USE_MOCK=true`일 때만 로드되는 개발용 mock 상태와 API 클라이언트다.
- `static/map-data.js`: 매장·배달지·라이더 좌표를 공통 마커 데이터로 만들고 SVG 지도를 렌더링한다.
- `static/customer`, `static/merchant`, `static/rider`, `static/demo`: 역할별 화면 렌더링과 액션 처리 코드다.

React는 역할별 화면을 새로 구현하는 계층이 아니라 Vite 진입점·정적 템플릿 로더 역할을 한다. 화면 갱신은 `static/`의 DOM 코드가 담당한다.

## 포함 기능

- 고객 주문 조회·취소
- 사장님 매장 주문 목록 조회·조리시간 수정
- 라이더 프로필·배정 패키지 조회·패키지 픽업/완료
- 매장·주문 출발/도착·전체 라이더 위치를 사용하는 SVG 지도
- 전체 라이더 위치 5초 폴링
- 404, 빈 데이터, 서버 오류, 재시도 안내
- 고객 1개·사장님 3개·라이더 3개 실제 데이터 통합 시연
- `VITE_USE_MOCK`으로 분리된 개발용 mock 모드

## 실제 API 모드와 mock 모드

기본 모드는 `VITE_USE_MOCK=false`인 실제 API 모드다.

```dotenv
VITE_USE_MOCK=false
VITE_BACKEND_PROXY_TARGET=http://127.0.0.1:8000
VITE_DEFAULT_ORDER_ID=118
VITE_DEFAULT_STORE_ID=781
VITE_DEFAULT_RIDER_ID=rider_102
```

- 실제 API 모드: `static/backend-client.js`를 사용해 FastAPI를 호출한다. 상태 변경 요청은 실제 DB·Redis 상태에 영향을 준다.
- mock 모드: `static/mock-client.js`를 사용한다. 상태는 브라우저 `localStorage`에만 저장된다.
- Vite 개발 서버는 `/api`, `/docs`, `/openapi.json` 요청을 `VITE_BACKEND_PROXY_TARGET`으로 프록시한다.

## 현재 제외하거나 미구현인 범위

- 카카오맵 SDK 렌더러와 마커 클러스터링
- 서버 측 LLM 설명 생성 API와 고객/라이더용 설명 표시 UI
- 주문 생성, 배송 방식 선택, 배차 제안·수락·거절
- 주문별 픽업·배달 상태 변경
- WebSocket 기반 상태 푸시
- 날씨, 경로 전략, 자동 진행, 전체 초기화 시연 제어

이 항목들은 실제 FastAPI가 제공하지 않거나 추가 구현이 필요한 기능이다. mock 전용 기능을 실제 API 기능처럼 표시하지 않는다.

## 지도 교체 경계

현재 지도는 SVG fallback이다. 카카오맵으로 교체할 때에도 역할 화면은 `Yogiyo.mapData`로 만든 공통 데이터를 사용하고, `Yogiyo.renderMap` 구현만 카카오맵 렌더러로 대체하는 구조를 유지한다.

## 백엔드와의 책임 분리

프론트는 API를 호출하고 사용자 상태를 표현한다. 다음은 백엔드 책임이다.

- Oracle DB·Redis 접근과 패키지/주문 상태 변경
- 패키지 상태 전이 검증 및 주문 상태 동기화
- 라이더 위치 조회 성능과 전체 목록 폴링 부하 관리
- LLM 키 관리, 프롬프트 생성, 설명 생성·저장
- 배포 시 CORS와 인증·권한 검증

실제 API 경로와 응답은 [API_CONTRACT.md](API_CONTRACT.md), 화면별 매핑은 [CONTROL_DATA_MAPPING.md](CONTROL_DATA_MAPPING.md)를 기준으로 한다.
