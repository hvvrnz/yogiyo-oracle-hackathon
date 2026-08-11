# ygy-frontend

`ygy-frontend`에서 화면과 브라우저 동작만 분리한 독립 React/Vite 프론트엔드입니다. Python/FastAPI 코드, 상태 저장소, 배차 엔진 및 데이터 파일은 포함하지 않습니다.

현재 백엔드 API는 설계·개발 전 단계이므로, 프론트 화면과 통합시연을 먼저 구현하기 위한 임의의 mock JSON 데이터를 사용합니다. 이 mock은 UI 개발 및 시연 전용이며, FastAPI가 개발되면 API 응답으로 교체하고 제거할 예정입니다.

## 제공 화면

- `/`: 역할별 시작 화면
- `/customer?customerId=C-001`: 고객 주문·ETA·품질·실시간 경로 화면 (`C-001~C-003` 지원; 각 고객은 치킨·버거·한식 매장에 대응)
- `/merchant?storeId=S-001`: 사장님 주문·조리·라이더 도착 관리 화면
- `/rider?riderId=R-001`: 라이더 배차·수익·픽업/배달 경로 화면
- `/demo`: 고객·사장님·라이더 통합 시연 및 시나리오 제어 화면

화면 마크업, 스타일, 개인정보를 노출하지 않는 SVG 시연용 경로 지도, 사용자 액션 구조는 기존 `ygy-frontend` 구현을 유지합니다. FastAPI 연동 시 사용할 REST·WebSocket 계약은 [docs/API_CONTRACT.md](docs/API_CONTRACT.md)에 정리되어 있습니다.
분리 기준과 기능별 소스 구성은 [docs/FRONTEND_SCOPE.md](docs/FRONTEND_SCOPE.md)에서 확인할 수 있습니다.

## 요구 환경

- Node.js 20.19 이상 또는 22.12 이상
- npm
- FastAPI 백엔드는 현재 실행하지 않아도 됨(mock 모드 기본 사용)

## 개발 실행

```bash
npm ci
npm run dev -- --host 0.0.0.0
```

기본값은 `VITE_USE_MOCK=true`이며, 고객·사장님·라이더·통합시연 화면은 `static/common.js`의 임시 mock JSON으로 동작합니다. 통합시연의 제어 버튼은 같은 mock 상태를 변경하며, 브라우저 저장소를 통해 iframe 화면에도 반영합니다.

## 배포 빌드

```bash
npm ci
npm run build
```

결과는 `dist/`에 생성됩니다. FastAPI 연동 시 프론트와 백엔드를 같은 도메인의 리버스 프록시로 묶으면, 별도 Origin 설정 없이 `/api`와 `/ws`를 사용할 수 있습니다.

## FastAPI 연동 전환

백엔드가 준비되면 mock을 사용하지 않도록 `VITE_USE_MOCK=false`를 설정합니다. 기본 개발 프록시는 `http://127.0.0.1:8000`을 가리키며, 다른 주소라면 `VITE_BACKEND_PROXY_TARGET`을 설정합니다.

```bash
VITE_USE_MOCK=false \
VITE_BACKEND_PROXY_TARGET=http://127.0.0.1:8000 \
npm run dev
```

서로 다른 도메인으로 배포할 때는 빌드 전에 다음 값을 지정합니다. `VITE_API_BASE_URL`에는 `/api`를 제외한 백엔드 Origin만 입력합니다.

```bash
VITE_USE_MOCK=false \
VITE_API_BASE_URL=https://api.example.com \
VITE_WS_BASE_URL=wss://api.example.com \
npm run build
```

이 경우 백엔드에서 프론트 도메인에 대한 CORS 허용이 필요합니다. WebSocket은 `VITE_WS_BASE_URL`을 우선 사용하며, 연결이 끊기면 최대 30초 간격으로 재연결하고 20초마다 `ping`을 보냅니다. 배포 서버는 `/customer`, `/merchant`, `/rider`, `/demo` 요청을 모두 `index.html`로 되돌리는 SPA fallback도 설정해야 합니다.

FastAPI가 아래 데이터 계약에 맞춰 JSON을 내려주면 역할별 화면 코드는 그대로 사용할 수 있습니다. 계약 키가 확정되기 전까지는 [제어·데이터 목록](docs/CONTROL_DATA_MAPPING.md)의 임시 제안 키를 사용합니다.

## 데이터 연결 구조

화면의 HTML/CSS는 표시 구조와 문구를 하드코딩해 둔 상태이며, 주문·매장·라이더처럼 변하는 값은 공통 API 경계를 통해 주입합니다. 현재 그 경계는 mock 데이터를 반환하고, FastAPI 연동 시 같은 요청 경계에서 실제 JSON 응답을 반환합니다.

- API 주소와 기본 화면 ID는 `VITE_API_BASE_URL`, `VITE_WS_BASE_URL`, `VITE_DEFAULT_*` 설정으로 바꿉니다.
- 표준 계약과 경로만 다르면 `VITE_API_PATHS` JSON으로 바꿉니다. 경로의 `:customerId`, `:storeId`, `:riderId`, `:orderId`, `:packageId`, `:role`, `:entityId`는 호출 시 실제 값으로 치환됩니다. 예: `{"customer":"/v1/customers/:customerId/orders/current","websocket":"/v1/ws/:role/:entityId"}`. 지원 키 전체는 [`.env.example`](.env.example)에 적었습니다.
- 응답 키까지 다르면 `static/common.js`의 API 응답 경계에 매핑을 추가합니다. 역할별 화면 파일은 가능한 그대로 유지합니다.
- mock 데이터와 제어 로직은 `static/common.js`의 `mock`, `mockApi()`에 있으며, FastAPI 연동 완료 후 제거 대상입니다.

## 구조

```text
ygy-frontend/
├── frontend/
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       └── styles/common.css
├── public/favicon.svg
├── static/
│   ├── common.css
│   ├── common.js
│   ├── index.html
│   ├── customer/
│   ├── merchant/
│   ├── rider/
│   └── demo/
├── docs/
│   ├── API_CONTRACT.md
│   ├── CONTROL_DATA_MAPPING.md
│   └── FRONTEND_SCOPE.md
├── package.json
└── vite.config.js
```
