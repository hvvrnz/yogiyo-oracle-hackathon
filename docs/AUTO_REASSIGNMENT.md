# 라이더 자동 재배차 구현

## 목적

라이더가 배차를 거절하거나 설정된 응답시간 안에 응답하지 않았을 때, 수동 초기화 없이 다음 라이더 후보에게 패키지를 자동 제안합니다.

## 처리 흐름

```text
패키지 OFFERED
  ↓
현재 offered_rider_id만 수락·거절 가능
  ↓ 거절 또는 TIMEOUT
기존 라이더 상태 AVAILABLE
거절/시간초과 이력 저장
  ↓
남은 라이더 후보 재검색·점수화
  ↓
최저 점수 후보에게 package.reoffered
  ↓
후보 없음
NO_RIDER_AVAILABLE
```

## 저장 상태

패키지에 다음 값이 추가됩니다.

```json
{
  "offered_rider_id": "R-002",
  "rider_id": null,
  "offer_attempt": 2,
  "rejected_rider_ids": ["R-001"],
  "timed_out_rider_ids": [],
  "offer_history": [],
  "offer_expires_at": "2026-08-04T21:00:30+09:00",
  "reassignment_status": "OFFERED",
  "reassignment_note": "다음 후보인 라이더 02에게 자동으로 배차를 제안했습니다."
}
```

## 후보 점수

`sequencing_engine/dispatch.py`의 `DispatchEngine`이 계산합니다.

```text
score = 예상 도착시간
      + 첫 픽업 매장까지 거리 × 0.35
      + 최근 거절 횟수 × 0.7
```

현재 POC는 위경도 기반 Haversine 거리를 사용합니다. 실제 배포에서는 Redis Geo로 일정 반경의 라이더를 조회한 뒤, 카카오모빌리티 길찾기의 도로 거리·시간을 넣을 수 있습니다.

## 주요 API

### 특정 라이더 수락·거절

```http
POST /api/rider/{rider_id}/action
```

```json
{"action": "reject"}
```

현재 제안 대상이 아닌 라이더의 수락·거절 요청은 HTTP 400으로 거절합니다.

### 시연용 현재 라이더 거절

```http
POST /api/demo/rider-reject
```

### 시연용 응답시간 만료

```http
POST /api/demo/rider-timeout
```

## 수정 파일

- `sequencing_engine/dispatch.py`
  - 거리 계산
  - 후보 라이더 필터링
  - 후보 점수화 및 정렬
- `common/state.py`
  - 최초 배차 제안 초기화
  - 수락·거절 검증
  - 거절 이력과 제안 이력 저장
  - 다음 후보 자동 제안
  - 응답시간 만료 처리
  - 후보 소진 fallback
- `api/routers/rider.py`
  - 라이더 동작 API
- `api/routers/demo.py`
  - 시연용 수락·거절·시간초과 API
- `api/main.py`
  - 주기적인 응답시간 만료 검사와 WebSocket 전파
- `static/rider/app.js`
  - 현재 제안 대상 여부에 따른 버튼 표시
  - 이전 라이더 화면에서 새 제안 라이더 화면으로 이동
- `static/demo/app.js`
  - 재배차 시 라이더 iframe 자동 전환
- `data/dummy/scenarios/*.json`
  - 다중 후보 라이더 데이터
- `tests/test_app.py`
  - 거절 후 자동 재제안
  - 현재 제안 대상 검증
  - 후보 소진 fallback
  - 응답시간 만료 재배차
