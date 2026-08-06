# 프론트엔드 분리 범위

## 원본 구조 분석

`ygy-frontend`는 하나의 디렉터리에 다음 두 영역을 함께 가지고 있었습니다.

- 프론트엔드: React/Vite 진입점, 역할별 HTML·JavaScript, 공통 CSS, 지도 렌더러, 정적 아이콘
- 백엔드: FastAPI 라우터, WebSocket, 인메모리 상태, 배차·경로 최적화, 더미 데이터, 배치와 외부 서비스 연동

React 진입점은 역할별 화면을 새로 그리지 않고 기존 HTML을 템플릿으로 읽어 본문과 인라인 스타일을 삽입합니다. 그 후 공통 브라우저 코드와 역할별 코드를 실행해 REST·WebSocket 기반 상호작용을 연결합니다.

## 포함한 프론트엔드 기능

- 시작 화면과 고객·사장님·라이더·통합 시연 화면
- 반응형 모바일 셸과 데스크톱 통합 콘솔
- 주문/조리/배차 상태 표시 및 역할별 액션
- REST 오류 처리, 토스트, 추천 설명 bottom sheet
- WebSocket 연결 상태, 재연결, ping/pong, 상태 갱신
- 네이버/구글 지도 SDK 선택과 외부 지도 실패 시 SVG fallback
- 쿼리 매개변수 `customerId`, `storeId`, `riderId`
- 개발 프록시와 분리 배포용 API/WebSocket Origin 설정

## 제외한 백엔드 기능

다음 원본 영역은 `ygy-frontend-only`에 복사하지 않았습니다.

- `api/`, `app.py`: FastAPI REST·WebSocket·페이지 서빙
- `common/`, `state.py`, `models.py`: 설정·모델·공통 상태·설명 생성
- `sequencing_engine/`: 배차 및 경로 최적화
- `stream_processor/`: 주문 클러스터링과 이벤트 처리
- `vector_search/`, `services/`: 임베딩 및 외부 서비스 경계
- `batch/`, `scripts/`, `data/`: 배치, 데이터 생성기, 시연 데이터
- `requirements.txt`, Python 테스트와 실행 스크립트

이 기능들은 새 `ygy-backend`에서 구현하며, 프론트와의 접점은 [API_CONTRACT.md](API_CONTRACT.md)의 REST/WebSocket 계약뿐입니다.

## 브라우저 실행 흐름

1. `frontend/src/main.jsx`가 URL 경로에 해당하는 HTML 템플릿을 선택합니다.
2. 공통 CSS와 템플릿의 인라인 스타일로 원본 화면을 재현합니다.
3. `static/common.js`가 API 주소, 공통 UI와 WebSocket을 구성합니다.
4. 지도 화면은 `static/maps.js`를 초기화합니다.
5. 역할별 `app.js`가 백엔드 상태를 조회하고 DOM을 갱신합니다.
6. WebSocket 이벤트가 오면 해당 REST 조회를 다시 실행해 최신 상태를 반영합니다.

