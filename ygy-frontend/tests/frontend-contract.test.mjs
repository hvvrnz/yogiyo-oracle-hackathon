import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const riderSource = readFileSync(
  new URL('../static/rider/app.js', import.meta.url),
  'utf8'
);
const backendClientSource = readFileSync(
  new URL('../static/backend-client.js', import.meta.url),
  'utf8'
);

test('라이더 데이터 렌더링은 운행 지도를 갱신한다', () => {
  const renderRiderStart = riderSource.indexOf('function renderRider(view)');
  const renderRiderEnd = riderSource.indexOf('\nasync function ', renderRiderStart);

  assert.notEqual(renderRiderStart, -1, 'renderRider 함수가 있어야 합니다.');

  const renderRiderSource = riderSource.slice(
    renderRiderStart,
    renderRiderEnd === -1 ? undefined : renderRiderEnd
  );

  assert.match(
    renderRiderSource,
    /Yogiyo\.renderMap\(\s*['"]riderMap['"]\s*,\s*riderMapData\(\s*profile\s*,\s*activePackage\s*\)/,
    '라이더 조회 후 지도에 현재 경로와 위치를 반영해야 합니다.'
  );
});

test('라이더 조리시간은 현재 패키지의 서버 잔여시간으로 갱신된다', () => {
  const cookTimeStart = riderSource.indexOf('function cookTimeItems(pkg)');
  const cookTimeEnd = riderSource.indexOf('\nfunction renderCookTimeGrid', cookTimeStart);
  const cookTimeSource = riderSource.slice(cookTimeStart, cookTimeEnd);

  assert.match(cookTimeSource, /cook_time_detail/);
  assert.match(cookTimeSource, /remaining_seconds/);
  assert.doesNotMatch(
    cookTimeSource,
    /detail\?\.wait_min/,
    '배차 시점의 라이더 대기시간을 남은 조리시간으로 사용하면 안 됩니다.'
  );
  assert.match(
    backendClientSource,
    /riderPackages:\s*async\s*\(\)\s*=>/,
    '운행 중인 패키지를 폴링해 서버 잔여시간을 다시 받아야 합니다.'
  );
});

test('배차 제안 경로는 순서 숫자 대신 주문별 색상을 사용한다', () => {
  const summaryStart = riderSource.indexOf('const offerRouteSummary = pkg =>');
  const summaryEnd = riderSource.indexOf('\nconst routeSummaryText', summaryStart);
  const summarySource = riderSource.slice(summaryStart, summaryEnd);

  assert.notEqual(summaryStart, -1);
  assert.match(summarySource, /orderColorById/);
  assert.match(summarySource, /offer-route-type order-color-/);
  assert.doesNotMatch(
    summarySource,
    /step\.sequence/,
    '배차 제안 카드에는 1~6 순서 숫자를 표시하지 않습니다.'
  );
});

test('운행 상세 경로의 원은 숫자 대신 주문별 색상을 사용한다', () => {
  const scheduleStart = riderSource.indexOf('function routeSchedule(');
  const scheduleEnd = riderSource.indexOf('\nfunction runDetail', scheduleStart);
  const scheduleSource = riderSource.slice(scheduleStart, scheduleEnd);

  assert.match(scheduleSource, /routeOrderColorMap\(pkg\)/);
  assert.match(scheduleSource, /class="order-color-\$\{colorIndex \+ 1\}"/);
  assert.doesNotMatch(
    scheduleSource,
    /<b>\$\{step\.sequence\}<\/b>/,
    '운행 상세의 원 안에는 1~6 숫자를 표시하지 않습니다.'
  );
});
