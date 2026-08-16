import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('고객 화면은 전체 주문 상태와 배차 대기 안내를 유지한다', () => {
  const source = read('../static/customer/app.js');
  for (const status of ['NEW', 'COOKING', 'MATCHED', 'PICKED_UP', 'DELIVERED']) {
    assert.match(source, new RegExp(`${status}:`));
  }
  assert.match(source, /배차 제안 생성 대기 중/);
});

test('라이더 화면은 offers 수락 API와 404·409 경쟁 오류 안내를 유지한다', () => {
  const client = read('../static/backend-client.js');
  const screen = read('../static/rider/app.js');
  assert.match(client, /\/api\/rider\/:riderId\/offers/);
  assert.match(client, /\/package\/:packageId\/accept/);
  assert.match(screen, /error\?\.status === 409/);
  assert.match(screen, /error\?\.status === 404/);
});

test('라이더 제안은 최소 정보의 스크롤 리스트와 수락·거절 동작으로 표시한다', () => {
  const screen = read('../static/rider/app.js');
  const styles = read('../static/common.css');
  assert.match(screen, /class="offer-list"/);
  assert.match(screen, /data-offer-accept/);
  assert.match(screen, /data-offer-decline/);
  assert.match(screen, /data-offer-detail/);
  assert.match(screen, /function declineOffer/);
  assert.match(screen, /offerSortValue/);
  assert.match(screen, /sortedVisibleOffers/);
  assert.match(styles, /\.offer-list \{[^}]*max-height:340px/);
});

test('통합 시연은 권역별 라이더 필터와 URL 선택 상태를 제공한다', () => {
  const source = read('../static/demo/app.js');
  assert.match(source, /riderIdsByRegion/);
  assert.match(source, /syncRiderOptions/);
  assert.match(source, /history\.replaceState/);
  assert.match(source, /resetMockDemo/);
});

test('패키지 상세 바텀시트는 포커스 복귀·포커스 가두기와 맥락 있는 버튼 레이블을 제공한다', () => {
  const screen = read('../static/rider/app.js');
  const template = read('../static/rider/index.html');
  assert.match(screen, /setDetailBackgroundInert/);
  assert.match(screen, /detailFocusableElements/);
  assert.match(screen, /event\.key !== 'Tab'/);
  assert.match(screen, /packageDetailTrigger\?\.isConnected/);
  assert.match(screen, /aria-label="패키지 \$\{pkg\.package_id\} 제안 수락"/);
  assert.match(template, /aria-describedby="packageDetailSummary"/);
});
