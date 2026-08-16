import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../static/mock-client.js', import.meta.url), 'utf8');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function createMockClient() {
  const storage = new Map();
  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
  };
  const window = { Yogiyo: { poll: () => () => {} }, localStorage, setTimeout };
  const context = vm.createContext({ window, setTimeout, JSON, Date, Math, Object });
  vm.runInContext(source, context, { filename: 'mock-client.js' });
  return window.Yogiyo.apiClient;
}

test('목업 초기 상태에서는 라이더에게 배차 제안이 없다', async () => {
  const client = createMockClient();
  const { offers } = await client.riders.offers('rider_12');
  assert.equal(offers.length, 0);
});

test('목업 주문은 조리 시작 후 제안·수락·픽업·완료 상태를 순서대로 전이한다', async () => {
  const client = createMockClient();

  assert.equal((await client.customers.get(8941)).status, 'NEW');
  await client.merchants.updateCookTime(8941, 20);
  assert.equal((await client.customers.get(8941)).status, 'COOKING');

  await delay(1100);
  const offer = (await client.riders.offers('rider_12')).offers.find(pkg => pkg.order_ids.includes(8941));
  assert.ok(offer, '조리 시작한 주문의 배차 제안이 생성되어야 합니다.');
  assert.equal(offer.status, 'OFFERED');

  await client.riders.accept('rider_12', offer.package_id);
  assert.equal((await client.customers.get(8941)).status, 'MATCHED');

  await client.riders.pickup('rider_12', offer.package_id);
  assert.equal((await client.customers.get(8941)).status, 'PICKED_UP');

  await client.riders.complete('rider_12', offer.package_id);
  assert.equal((await client.customers.get(8941)).status, 'DELIVERED');
});

test('목업 수락 API는 경쟁 수락과 없는 패키지를 실제 API와 같은 오류로 처리한다', async () => {
  const client = createMockClient();
  await client.merchants.updateCookTime(8941, 20);
  await delay(1100);
  const offer = (await client.riders.offers('rider_12')).offers.find(pkg => pkg.order_ids.includes(8941));
  assert.ok(offer, '조리 시작 후 생성된 제안이 있어야 합니다.');

  await client.riders.accept('rider_12', offer.package_id);
  await assert.rejects(() => client.riders.accept('rider_13', offer.package_id), error => error.status === 409);
  await assert.rejects(() => client.riders.accept('rider_12', 99999), error => error.status === 404);
});
