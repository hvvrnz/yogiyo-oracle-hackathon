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
    '/api/demo/rider/packages',
    '/api/demo/rider/package/${encodeURIComponent(packageId)}/accept',
    '/api/demo/rider/package/${encodeURIComponent(packageId)}/pickup',
    '/api/demo/rider/package/${encodeURIComponent(packageId)}/complete',
    '/api/demo/stores',
  ]) assert.match(client, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(client, /\/api\/(customer|merchant|rider|explanation|package)(?!\/demo)/);
});

test('고객 화면은 시연 주문 API만 5초마다 조회한다', () => {
  const source = read('../static/customer/app.js');
  assert.match(source, /apiClient\.demo\.customerOrder\(\)/);
  assert.match(source, /시연 주문 API · 5초 갱신/);
  assert.doesNotMatch(source, /apiClient\.(customers|merchants|riders|explanations)/);
  assert.doesNotMatch(source, /reverseGeocode/);
});

test('사장님 화면은 조리 시작 응답의 동시 시작 매장을 안내한다', () => {
  const source = read('../static/merchant/app.js');
  assert.match(source, /apiClient\.demo\.merchantNextToCook\(\)/);
  assert.match(source, /apiClient\.demo\.merchantCookStart\(\)/);
  assert.match(source, /매장 조리 시작됨/);
  assert.match(source, /apiClient\.demo\.stores\(\)/);
  assert.doesNotMatch(source, /demoTrigger|updateCookTime|apiClient\.merchants/);
});

test('라이더 화면은 시연 프로필·제안·진행 패키지와 상태 변경 API만 사용한다', () => {
  const source = read('../static/rider/app.js');
  for (const method of ['riderProfile', 'riderOffers', 'riderPackages', 'acceptPackage', 'pickupPackage', 'completePackage']) {
    assert.match(source, new RegExp(`apiClient\\.demo\\.${method}`));
  }
  assert.match(source, /profile\.status === 'BUSY'/);
  assert.doesNotMatch(source, /apiClient\.(customers|merchants|riders|packages|explanations)/);
  assert.doesNotMatch(source, /reverseGeocode/);
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
});
