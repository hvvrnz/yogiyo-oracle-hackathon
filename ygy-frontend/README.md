# ygy-frontend

`ygy-frontend`에서 화면과 브라우저 동작만 분리한 독립 Vite 프론트엔드입니다. React는 URL별 페이지를 선택하고 정적 HTML 템플릿을 마운트하는 셸 역할을 하며, 고객·사장님·라이더·통합 시연의 실제 DOM 렌더링과 상호작용은 `static/`의 브라우저 JavaScript가 담당합니다. Python/FastAPI 코드, 서버 상태 저장소, 배차 엔진 및 데이터 파일은 포함하지 않습니다.

기본 모드는 `VITE_USE_MOCK=true`입니다. 이때 `static/common.js`의 브라우저 내 mock 엔진이 주문·조리·배차·라이더 상태를 `localStorage`에 저장하고, 같은 Origin의 탭과 통합 시연 iframe에 상태 변경을 반영합니다. mock은 UI 개발 및 시연 전용이며, 실제 서버가 준비되면 같은 API 경계에서 REST·WebSocket 응답으로 교체합니다.

## 렌더링 구조

- `frontend/src/main.jsx`: Vite/React 진입점. URL별 정적 HTML을 선택하고, 공통·화면별 스크립트를 브라우저 전역 범위에서 실행합니다.
- `static/index.html`, `static/customer/`, `static/merchant/`, `static/rider/`, `static/demo/`: 화면 마크업·역할별 DOM 렌더러·시연 제어 코드입니다.
- `static/common.js`: mock 상태 전이, API 클라이언트, WebSocket, ETA·거리 계산, SVG 지도, 공통 UI 동작입니다.
- `static/common.css`: 모든 역할 화면의 공통 스타일입니다. `frontend/src/styles/common.css`는 이 파일을 Vite 번들에 포함시키는 import 래퍼입니다.

이 구조는 기존 정적 시연 화면을 유지하기 위한 선택입니다. 화면을 React 컴포넌트와 state로 직접 구성한 구조는 아닙니다.

## 제공 화면

- `/`: 역할별 시작 화면
- `/customer?customerId=C-001`: 고객 주문·ETA·품질·실시간 경로 화면 (`C-001~C-003` 지원; 각 고객은 치킨·버거·한식 매장에 대응)
- `/merchant?storeId=S-001`: 사장님 주문·조리·라이더 도착 관리 화면
- `/rider?riderId=R-001`: 라이더 배차·수익·픽업/배달 경로 화면
- `/demo`: 고객·사장님·라이더 통합 시연 및 시나리오 제어 화면

화면 마크업, 스타일, 개인정보를 노출하지 않는 좌표 기반 SVG 시연용 경로 지도, 사용자 액션 구조는 기존 `ygy-frontend` 구현을 유지합니다. 지도는 강남역·역삼·선릉 권역과 세 매장을 고정 좌표계로 표시하고, 고객·라이더·경로만 위도·경도를 기준으로 이동합니다. 위치·거리·예상 시간은 시연용 이동 속도로 계산하며, 실제 도로 길이나 교통 정보는 사용하지 않습니다. FastAPI 연동 시 사용할 REST·WebSocket 계약은 [docs/API_CONTRACT.md](docs/API_CONTRACT.md)에 정리되어 있습니다.
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

기본값은 `VITE_USE_MOCK=true`이며, 고객·사장님·라이더·통합시연 화면은 `static/common.js`의 mock 상태로 동작합니다. 통합시연의 제어 버튼은 같은 상태를 변경하며, 브라우저 저장소를 통해 iframe 화면에도 반영합니다. `.env.example`을 복사해 개발 환경을 만들 때도 `VITE_USE_MOCK=true`를 유지하면 됩니다.

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
│   ├── landing/
│   │   └── app.js
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
