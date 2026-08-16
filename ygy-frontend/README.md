# ygy-frontend

실속배달 해커톤 프로젝트의 Vite 프론트엔드입니다. 기본 모드는 제공된 FastAPI와 Oracle DB를 조회하는 **실제 API 모드**이며, 고객·사장님·라이더 화면은 같은 API 응답을 역할별로 표시합니다.

> 실제 API 모드의 변경 요청은 DB 상태를 바꿉니다. 취소·조리시간 수정·패키지 픽업/완료 시연은 별도 테스트 DB가 없으면 `VITE_USE_MOCK=true`에서 진행하세요.

## 제공 화면

| 화면 | 주소 | 실제 API 기능 |
|---|---|---|
| 고객 | `/customer?orderId={초기화 후 주문 번호}` | 주문 조회, 상태·ETA·메뉴·금액 확인, 취소 |
| 사장님 | `/merchant?storeId=889` | 매장 주문 조회, 조리시간 입력·조리 시작, 배차 상태 확인 |
| 라이더 | `/rider?riderId=rider_12` | 배차 제안 조회·수락, 프로필·패키지·수익 조회, 픽업/완료 |
| 통합 시연 | `/demo` | 고객 주문 번호 입력 안내와 강남 889·rider_12 조회 패널 |

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
VITE_DEFAULT_ORDER_ID=
VITE_DEFAULT_STORE_ID=889
VITE_DEFAULT_RIDER_ID=rider_12
VITE_KAKAO_MAP_JS_KEY=카카오맵_JavaScript_키
```

| 변수 | 설명 |
|---|---|
| `VITE_USE_MOCK` | `false`: 실제 FastAPI, `true`: 브라우저 개발용 목업 |
| `VITE_BACKEND_PROXY_TARGET` | 개발 서버가 `/api`를 전달할 FastAPI Origin |
| `VITE_API_BASE_URL` | 프론트와 API가 다른 Origin으로 배포될 때의 API Origin. `/api`는 제외 |
| `VITE_DEFAULT_ORDER_ID` | 선택값. 주문 ID는 DB 초기화 후 전달받은 값을 URL 또는 입력창에 사용 |
| `VITE_DEFAULT_STORE_ID` | 사장님 화면 기본 매장 ID |
| `VITE_DEFAULT_RIDER_ID` | 라이더 화면 기본 라이더 ID |
| `VITE_KAKAO_MAP_JS_KEY` | 카카오맵 Web(JavaScript) SDK 키. JavaScript SDK 허용 도메인 등록 필요 |

실제 API 모드가 기본값입니다. 백엔드는 CORS 전체 허용으로 설정되어 있어 다른 포트의 프론트에서도 직접 API를 호출할 수 있습니다.

## 실제 테스트 환경

DB 초기화 때마다 주문·패키지 ID가 바뀝니다. 백엔드 초기화 완료 후 전달받은 주문 번호를 고객 화면에 입력하세요.

- 시연 매장: 강남 `889`, `894`, 홍대 `884`
- 강남 라이더: `rider_12`, `rider_13`, `rider_19`, `rider_23`, `rider_31`
- 홍대 라이더: `rider_2`, `rider_5`, `rider_6`
- 주문은 `NEW → COOKING → MATCHED → PICKED_UP → DELIVERED`로 표시됩니다. `COOKING` 후 패키지는 30초 단위 클러스터링으로 제안됩니다.

## 시연 순서

### 실제 API 조회 시연

실제 DB를 변경하지 않는 안전한 시연 순서입니다.

1. 초기화 완료 안내와 새 주문 번호를 받습니다.
2. `/merchant?storeId=889` 또는 `894`·`884`에서 `NEW` 주문의 조리를 시작합니다.
3. `COOKING` 상태를 확인하고, 30초 클러스터링 주기 후 라이더 offers를 조회합니다.
4. `/rider?riderId=rider_12` 또는 해당 권역 라이더에서 제안을 수락합니다. 동시 수락으로 인한 `409`는 정상입니다.
5. 고객 화면에서 `MATCHED`, 픽업 후 `PICKED_UP`, 완료 후 `DELIVERED`를 확인합니다.

### 상태 변경 시연

실제 API 모드에서 다음 동작은 DB를 변경합니다.

- 고객 주문 취소
- 사장님 조리시간 수정
- 라이더 패키지 픽업·완료

별도 테스트 DB가 없다면 아래처럼 목업 모드에서 실행합니다.

```bash
VITE_USE_MOCK=true npm run dev -- --host 0.0.0.0
```

목업 모드의 상태 변경은 브라우저 `localStorage`에만 저장됩니다. 목업 전체 흐름은 주문 `8941`을 고객으로 조회하고, 매장 `894`에서 조리를 시작한 뒤 약 1초 후 `rider_12`가 제안을 수락하는 순서로 확인할 수 있습니다.

## API 연결 구조

브라우저는 `static/backend-client.js`의 API 클라이언트를 통해 다음 API를 호출합니다.

- 고객: `GET/DELETE /api/customer/{order_id}`
- 사장님: `GET /api/merchant/{store_id}`, `PUT /api/merchant/orders/{order_id}/cook-time`
- 라이더: `GET /api/rider`, `GET /api/rider/{rider_id}`, `GET /api/rider/{rider_id}/profile`
- 라이더 수익: `GET /api/rider/{rider_id}/earnings`
- 패키지 상세: `GET /api/package/{package_id}`
- 라이더 제안/처리: `GET /api/rider/{rider_id}/offers`, `PUT .../accept`, `.../pickup`, `.../complete`
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
