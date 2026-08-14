# ygy-frontend

실속배달 해커톤 프로젝트의 Vite 프론트엔드입니다. 기본 모드는 제공된 FastAPI와 Oracle DB를 조회하는 **실제 API 모드**이며, 고객·사장님·라이더 화면은 같은 API 응답을 역할별로 표시합니다.

> 실제 API 모드의 변경 요청은 DB 상태를 바꿉니다. 취소·조리시간 수정·패키지 픽업/완료 시연은 별도 테스트 DB가 없으면 `VITE_USE_MOCK=true`에서 진행하세요.

## 제공 화면

| 화면 | 주소 | 실제 API 기능 |
|---|---|---|
| 고객 | `/customer?orderId=118` | 주문 조회, 상태·ETA·메뉴·금액 확인, 취소 |
| 사장님 | `/merchant?storeId=781` | 매장 주문 조회, 조리시간 수정, 라이더 이름·도착 ETA·패키지·방문 순서 확인 |
| 라이더 | `/rider?riderId=rider_102` | 프로필·패키지 조회, 패키지 픽업/완료 |
| 통합 시연 | `/demo` | 고객 1개·사장님 3개·라이더 3개 패널의 실제 데이터 조회 |

지도는 `VITE_KAKAO_MAP_JS_KEY`가 설정되고 SDK 로드에 성공하면 카카오맵으로 표시합니다. 고객 지도는 매장·배달지·담당 라이더를, 라이더 지도는 본인 위치와 배정 패키지 경로를 표시합니다. 키가 없거나 SDK 로드에 실패하면 SVG fallback을 유지합니다.

## 요구 환경

- Node.js 20.19 이상 또는 22.12 이상
- npm
- 실제 API 모드: FastAPI 서버 (기본 `http://127.0.0.1:8000`)

## 설치와 실행

```bash
cd ygy-frontend
npm ci
cp .env.example .env
npm run dev -- --host 0.0.0.0
```

같은 VM에 VS Code Remote-SSH로 접속했다면 포트 포워딩을 통해 로컬 브라우저에서 Vite가 안내한 주소로 접속할 수 있습니다. FastAPI 문서는 일반적으로 `http://localhost:8000/docs`에서 확인합니다.

프로덕션 빌드:

```bash
npm run build
```

## 환경변수

`.env.example`을 복사해 사용합니다.

```dotenv
VITE_USE_MOCK=false
VITE_BACKEND_PROXY_TARGET=http://127.0.0.1:8000
VITE_DEFAULT_ORDER_ID=118
VITE_DEFAULT_STORE_ID=781
VITE_DEFAULT_RIDER_ID=rider_102
VITE_KAKAO_MAP_JS_KEY=카카오맵_JavaScript_키
```

| 변수 | 설명 |
|---|---|
| `VITE_USE_MOCK` | `false`: 실제 FastAPI, `true`: 브라우저 개발용 목업 |
| `VITE_BACKEND_PROXY_TARGET` | 개발 서버가 `/api`를 전달할 FastAPI Origin |
| `VITE_API_BASE_URL` | 프론트와 API가 다른 Origin으로 배포될 때의 API Origin. `/api`는 제외 |
| `VITE_DEFAULT_ORDER_ID` | 고객 화면 기본 주문 ID |
| `VITE_DEFAULT_STORE_ID` | 사장님 화면 기본 매장 ID |
| `VITE_DEFAULT_RIDER_ID` | 라이더 화면 기본 라이더 ID |
| `VITE_KAKAO_MAP_JS_KEY` | 카카오맵 Web(JavaScript) SDK 키. JavaScript SDK 허용 도메인 등록 필요 |

실제 API 모드가 기본값입니다. 다른 Origin에 배포한다면 백엔드 CORS 허용이 필요합니다.

## 실제 테스트 데이터

현재 통합 시연용으로 확인된 연결 데이터입니다.

| 주문 | 매장 | 라이더 | 패키지 |
|---:|---:|---|---:|
| 118 | 781 | rider_102 | 740 |
| 184 | 467 | rider_103 | 638 |
| 226 | 273 | rider_105 | 635 |

추가 조회 예시:

- 주문 ID: `1`~`10`
- 문서상 매장 ID: `884`~`893` — 현재 주문 연결 여부에 따라 404가 날 수 있습니다.
- 배정 라이더 예시: `rider_102`, `rider_103`, `rider_105`
- 404 확인용 라이더 예시: `rider_1` (프로필은 존재해도 패키지 조회는 404일 수 있음)

통합 시연의 상세 연결 관계는 [docs/REAL_DEMO_DATA.md](docs/REAL_DEMO_DATA.md)를 참고하세요.

## 시연 순서

### 실제 API 조회 시연

실제 DB를 변경하지 않는 안전한 시연 순서입니다.

1. `/demo`를 열어 고객 주문 118, 매장 781·467·273, 라이더 102·103·105 패널이 표시되는지 확인합니다.
2. 고객 화면에서 주문 상태·ETA·메뉴·매장/배달지 좌표를 확인합니다.
3. 사장님 화면에서 주문별 조리시간과 패키지·라이더·방문 순서를 확인합니다.
4. 라이더 화면에서 패키지 상태·수익·방문 순서와 위치를 확인합니다.
5. 각 화면의 5초 폴링 및 빈 데이터·404·재시도 화면을 확인합니다.

### 상태 변경 시연

실제 API 모드에서 다음 동작은 DB를 변경합니다.

- 고객 주문 취소
- 사장님 조리시간 수정
- 라이더 패키지 픽업·완료

별도 테스트 DB가 없다면 아래처럼 목업 모드에서 실행합니다.

```bash
VITE_USE_MOCK=true npm run dev -- --host 0.0.0.0
```

목업 모드의 상태 변경은 브라우저 `localStorage`에만 저장됩니다.

## API 연결 구조

브라우저는 `static/backend-client.js`의 API 클라이언트를 통해 다음 API를 호출합니다.

- 고객: `GET/DELETE /api/customer/{order_id}`
- 사장님: `GET /api/merchant/{store_id}`, `PUT /api/merchant/orders/{order_id}/cook-time`
- 라이더: `GET /api/rider`, `GET /api/rider/{rider_id}`, `GET /api/rider/{rider_id}/profile`
- 라이더 수익: `GET /api/rider/{rider_id}/earnings`
- 패키지 상세: `GET /api/package/{package_id}`
- 패키지 처리: `PUT /api/rider/{rider_id}/package/{package_id}/pickup`, `.../complete`
- 매장: `GET /api/stores`
- 설명: `GET /api/explanation/context/{package_id}`, `POST /api/explanation`, `GET /api/explanation/{package_id}`

`menu_items`, `order_ids`, `route_detail`, `score_detail`처럼 문자열 JSON 또는 객체로 내려올 수 있는 필드는 클라이언트에서 공통 정규화합니다.

## 실제 API 모드의 제약사항

- 고객 주문 API의 `rider_id`와 `package_id`를 직접 사용한다. 라이더가 배정된 경우에만 해당 라이더 프로필을 5초 간격으로 조회하며, 매장 목록이나 사장님 주문 API로 담당 라이더를 역조회하지 않는다.
- 역할별 화면은 전체 라이더 목록 API(`GET /api/rider`)를 호출하지 않습니다. 전체 라이더 관제 화면이 필요하면 별도 API 최적화와 권한 설계가 필요합니다.
- 현재 지도는 SVG입니다. 카카오맵 SDK 키·허용 도메인이 준비되면 동일 지도 데이터 계층에 연결할 수 있습니다.
- 설명 API는 컨텍스트·저장·조회만 제공합니다. LLM 생성은 브라우저 API 키 노출을 피하기 위해 서버 측 생성 API가 추가되어야 합니다.
- 실제 API 경로와 응답 형식은 [docs/API_CONTRACT.md](docs/API_CONTRACT.md), 화면별 제어·데이터 매핑은 [docs/CONTROL_DATA_MAPPING.md](docs/CONTROL_DATA_MAPPING.md)를 참고하세요.

## 구조

```text
ygy-frontend/
├── frontend/src/main.jsx        # URL별 정적 화면 로더
├── static/
│   ├── backend-client.js        # 실제 FastAPI 클라이언트·응답 정규화
│   ├── mock-client.js           # VITE_USE_MOCK=true 전용 클라이언트
│   ├── map-data.js              # 좌표·마커·SVG 지도 데이터 계층
│   ├── customer/                # 고객 화면
│   ├── merchant/                # 사장님 화면
│   ├── rider/                   # 라이더 화면
│   └── demo/                    # 통합 시연 화면
├── docs/REAL_DEMO_DATA.md       # 실제 통합 시연 데이터
├── .env.example
└── vite.config.js
```
