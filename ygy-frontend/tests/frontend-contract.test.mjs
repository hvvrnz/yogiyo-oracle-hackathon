import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('고객 화면은 전체 주문 상태와 배차 단계 안내를 유지한다', () => {
  const source = read('../static/customer/app.js');
  for (const status of ['NEW', 'COOKING', 'MATCHED', 'PICKED_UP', 'DELIVERED']) {
    assert.match(source, new RegExp(`${status}:`));
  }
  assert.match(source, /배차 제안 생성 대기 중/);
  assert.match(source, /배차 제안됨/);
  assert.match(source, /라이더 수락 대기 중/);
  assert.match(source, /hasOfferedPackage/);
  assert.match(source, /LLM 배차 안내 생성 준비 중입니다/);
});

test('고객 화면은 매장 주문 중 취소되지 않은 한 건을 선택해 조회한다', () => {
  const source = read('../static/customer/app.js');
  const template = read('../static/customer/index.html');
  assert.match(source, /apiClient\.merchants\.get\(storeId\)/);
  assert.match(source, /order\.status !== 'CANCELLED'/);
  assert.match(source, /Math\.random\(\) \* availableOrders\.length/);
  assert.match(source, /Yogiyo\.qs\('storeId', Yogiyo\.defaultIds\.merchant\)/);
  assert.match(source, /Yogiyo\.qs\('orderId', Yogiyo\.defaultIds\.customer\)/);
  assert.match(source, /if \(\/\^\\d\+\$\/\.test\(orderId\)\) return Yogiyo\.apiClient\.customers\.get\(orderId\)/);
  assert.doesNotMatch(template, /storeIdInput|orderIdInput|loadStoreButton/);
});

test('역할 화면은 상단 대상 정보와 중복되는 조회 입력 영역을 두지 않는다', () => {
  const customer = read('../static/customer/index.html');
  const merchant = read('../static/merchant/index.html');
  const rider = read('../static/rider/index.html');
  assert.doesNotMatch(customer, /매장 번호 조회|loadStoreButton/);
  assert.doesNotMatch(merchant, /매장 주문 조회|merchantDispatchButton|storeIdInput/);
  assert.doesNotMatch(rider, /<h2>라이더 조회<\/h2>|loadRiderButton|riderIdInput/);
});

test('사장님 화면은 배차 제안·수락 단계를 구분하고 시연 주문을 일괄 조리 시작한다', () => {
  const screen = read('../static/merchant/app.js');
  const template = read('../static/merchant/index.html');
  assert.match(screen, /hasOfferedPackage/);
  assert.match(screen, /배차 제안됨 · 수락 대기/);
  assert.match(screen, /라이더 수락 완료 · 배차 완료/);
  assert.match(screen, /const demoStoreIds = Object\.freeze\(\['889', '894', '884'\]\)/);
  assert.match(screen, /Promise\.allSettled/);
  assert.match(template, /id="demoBulkCookStartButton"/);
  assert.match(template, /id="offeredCount"/);
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
  const template = read('../static/rider/index.html');
  const styles = read('../static/common.css');
  assert.match(screen, /class="offer-list"/);
  assert.match(screen, /data-offer-accept/);
  assert.match(screen, /data-offer-decline/);
  assert.match(screen, /data-offer-detail/);
  assert.match(screen, /function declineOffer/);
  assert.match(screen, /offerSortValue/);
  assert.match(screen, /sortedVisibleOffers/);
  assert.match(screen, /예상 패키지 수익/);
  assert.match(screen, /OFFERED → MATCHING으로 전환됩니다/);
  assert.match(screen, /서버에는 저장되지 않습니다/);
  assert.match(screen, /isFutureReservation/);
  assert.match(template, /id="currentRun"/);
  assert.match(template, /id="nextRunReservation"/);
  assert.match(styles, /\.offer-list \{[^}]*max-height:340px/);
  assert.match(styles, /package-accepted-pulse/);
});

test('통합 시연은 권역별 라이더 필터와 URL 선택 상태를 제공한다', () => {
  const source = read('../static/demo/app.js');
  const template = read('../static/demo/index.html');
  assert.match(source, /riderIdsByRegion/);
  assert.match(source, /syncRiderOptions/);
  assert.match(source, /history\.replaceState/);
  assert.match(source, /resetMockDemo/);
  assert.match(source, /customer\?storeId=/);
  assert.doesNotMatch(source, /demoOrderId/);
  assert.match(source, /hongdaeSoloPreset/);
  assert.match(source, /apiClient\.merchants\.get\(hongdaeSoloPreset\.storeId\)/);
  assert.match(source, /preset: hongdaeSoloPreset\.id/);
  assert.match(template, /id="hongdaeSoloPresetButton"/);
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

test('역할 화면과 통합 시연 프레임은 모바일 세로 비율을 유지한다', () => {
  const styles = read('../static/common.css');
  const demo = read('../static/demo/index.html');
  assert.match(styles, /aspect-ratio: 390 \/ 844/);
  assert.match(styles, /html\.embedded \.mobile-shell/);
  assert.match(demo, /aspect-ratio:390\/844/);
  assert.match(demo, /repeat\(auto-fit,minmax\(280px,390px\)\)/);
});
