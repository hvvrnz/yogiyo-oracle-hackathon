import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('프런트 API 클라이언트는 시연 API만 제공한다', () => {
  const client = read('../static/backend-client.js');
  for (const path of [
  '/api/demo/reset',
  '/api/demo/customer/order',
  '/api/demo/merchant/next-to-cook',
  '/api/demo/merchant/cook-start',
  '/api/demo/rider/offers',
  '/api/demo/rider/profile',
  '/api/demo/rider/package/${encodeURIComponent(packageId)}/accept',
  '/api/demo/rider/next-stop',
  '/api/demo/rider/arrive',
  '/api/demo/stores',
]) {
  assert.match(
    client,
    new RegExp(
      path.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      )
    )
  );
}
});

test('고객 화면은 시연 주문 API만 5초마다 조회한다', () => {
  const source = read('../static/customer/app.js');
  assert.match(source, /apiClient\.demo\.customerOrder\(\)/);
  assert.match(source, /시연 주문 API · 5초 갱신/);
  assert.match(source, /delivery_address/);
  assert.match(source, /배차 수락 대기/);
  assert.match(source, /consumer_text/);
  assert.doesNotMatch(source, /apiClient\.(customers|merchants|riders|explanations)/);
  assert.doesNotMatch(source, /reverseGeocode/);
});

test('사장님 화면은 주문 수락·거절·조리 완료 상태를 처리한다', () => {
  const source = read('../static/merchant/app.js');
  for (const method of ['merchantOrders', 'merchantCookStart']) {
    assert.match(source, new RegExp(`apiClient\\.demo\\.${method}`));
  }
  assert.match(source, /수락하고 조리 시작/);
  assert.match(source, /apiClient\.demo\.stores\(\)/);
  assert.match(source, /merchant_text/);
  assert.doesNotMatch(source, /demoTrigger|updateCookTime|apiClient\.merchants/);
});

test('라이더 화면은 다음 작업 조회와 단일 완료 API로 순서대로 운행한다', () => {
  const source = read('../static/rider/app.js');
  for (const method of ['riderProfile', 'riderOffers', 'acceptPackage', 'riderNextStop', 'riderArrive']) {
    assert.match(source, new RegExp(`apiClient\\.demo\\.${method}`));
  }
  assert.doesNotMatch(
  source,
  /apiClient\.demo\.riderPackages/
);
  assert.match(source, /data-rider-arrive/);
  assert.match(source, /completeCurrentStop/);
  assert.match(source, /픽업 완료/);
  assert.match(source, /배달 완료/);
  assert.match(source, /profile\.status === 'BUSY'/);
  assert.match(source, /rider_text/);
  assert.match(source, /fromRouteDetail/);
  assert.match(source, /riderMapData/);
  assert.doesNotMatch(source, /apiClient\.demo\.(pickupPackage|completePackage)/);
  assert.doesNotMatch(source, /apiClient\.(customers|merchants|riders|packages|explanations)/);
});

test('통합 시연은 시작 시 시연 데이터를 초기화한다', () => {
  const source = read('../static/demo/app.js');
  assert.match(source, /apiClient\.demo\.reset\(\)/);
  assert.match(source, /DEMO_RESET/);
  assert.doesNotMatch(source, /apiClient\.(customers|merchants|riders)/);
});

test('세 역할 화면의 LLM 안내는 전용 파란색 토큰을 사용한다', () => {
  const styles = read('../static/common.css');
  assert.match(styles, /--info: #61616b/);
  assert.match(styles, /--llm: #3f6fe5/);
  assert.match(styles, /\.llm-guidance \{ background:var\(--llm-soft\); color:var\(--llm\)/);
  assert.match(styles, /\.offer-ai-guidance \{ grid-column:1 \/ -1; width:100%/);
});
