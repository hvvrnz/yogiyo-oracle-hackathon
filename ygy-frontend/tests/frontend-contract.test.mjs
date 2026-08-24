import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const riderSource = readFileSync(
  new URL('../static/rider/app.js', import.meta.url),
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
