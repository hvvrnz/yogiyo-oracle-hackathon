# ygy-frontend-only

`ygy-frontend`에서 화면과 브라우저 동작만 분리한 독립 React/Vite 프론트엔드입니다. Python/FastAPI 코드, 상태 저장소, 배차 엔진 및 데이터 파일은 포함하지 않습니다.

## 제공 화면

- `/`: 역할별 시작 화면
- `/customer?customerId=C-001`: 고객 주문·ETA·품질·실시간 경로 화면
- `/merchant?storeId=S-001`: 사장님 주문·조리·라이더 도착 관리 화면
- `/rider?riderId=R-001`: 라이더 배차·수익·픽업/배달 경로 화면
- `/demo`: 고객·사장님·라이더 통합 시연 및 시나리오 제어 화면

화면 마크업, 스타일, 지도 fallback, 사용자 액션 및 실시간 갱신 동작은 기존 `ygy-frontend` 구현을 유지합니다. 프론트가 요구하는 백엔드 계약은 [docs/API_CONTRACT.md](docs/API_CONTRACT.md)에 정리되어 있습니다.
분리 기준과 기능별 소스 구성은 [docs/FRONTEND_SCOPE.md](docs/FRONTEND_SCOPE.md)에서 확인할 수 있습니다.

## 요구 환경

- Node.js 20.19 이상 또는 22.12 이상
- npm
- 별도로 실행 중인 `ygy-backend` 서버

## 개발 실행

```bash
cd ygy-frontend-only
cp .env.example .env
npm ci
npm run dev -- --host 0.0.0.0
```

기본 백엔드 주소는 `http://127.0.0.1:8000`입니다. 다른 주소를 사용하면 `.env`의 `VITE_BACKEND_PROXY_TARGET`을 변경합니다. 브라우저는 Vite 개발 서버의 `/api`, `/ws`, `/docs`로 요청하고 Vite가 백엔드로 전달하므로 개발 환경에서 별도 CORS 설정이 필요하지 않습니다.

## 배포 빌드

```bash
npm ci
npm run build
```

결과는 `dist/`에 생성됩니다. 운영에서 프론트와 백엔드를 같은 도메인의 리버스 프록시로 묶으면 별도 설정 없이 `/api`와 `/ws`를 사용할 수 있습니다.

서로 다른 도메인으로 배포할 때는 빌드 전에 다음 값을 지정합니다. `VITE_API_BASE_URL`에는 `/api`를 제외한 백엔드 Origin만 입력합니다.

```bash
VITE_API_BASE_URL=https://api.example.com \
VITE_WS_BASE_URL=wss://api.example.com \
npm run build
```

이 경우 백엔드에서 프론트 도메인에 대한 CORS 허용이 필요합니다. 배포 서버는 `/customer`, `/merchant`, `/rider`, `/demo` 요청을 모두 `index.html`로 되돌리는 SPA fallback도 설정해야 합니다.

## 백엔드 값 연결

화면의 HTML/CSS는 표시 구조와 문구를 하드코딩해 둔 상태이며, 주문·매장·라이더처럼 변하는 값은 모두 공통 API 어댑터를 통해 주입합니다. 따라서 백엔드 개발자는 [API 계약](docs/API_CONTRACT.md)의 응답 키로 값을 제공하면 되고, 화면 파일을 수정할 필요가 없습니다.

- API 주소와 기본 화면 ID는 `.env`의 `VITE_API_*`, `VITE_DEFAULT_*` 설정으로 교체합니다.
- 표준 계약과 경로만 다르면 `VITE_API_PATHS` JSON으로 바꿉니다. 예: `{"customer":"/v1/customers/:customerId/orders/current"}`
- 응답 키까지 다른 경우에는 `static/common.js`의 `apiClient`에서만 변환을 추가합니다. 역할별 화면 파일은 그대로 둡니다.

## 구조

```text
ygy-frontend-only/
├── frontend/
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       └── styles/common.css
├── public/favicon.svg
├── static/
│   ├── common.css
│   ├── common.js
│   ├── maps.js
│   ├── customer/
│   ├── merchant/
│   ├── rider/
│   └── demo/
├── docs/API_CONTRACT.md
├── package.json
└── vite.config.js
```
