import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('고객 화면은 전체 주문 상태와 배차 단계 안내를 유지한다', () => {
  const source = read('../static/customer/app.js');
  const template = read('../static/customer/index.html');
  for (const status of ['NEW', 'COOKING', 'MATCHED', 'PICKED_UP', 'DELIVERED']) {
    assert.match(source, new RegExp(`${status}:`));
  }
  assert.match(source, /배차 제안 생성 대기 중/);
  assert.match(source, /배차 제안됨/);
  assert.match(source, /라이더 수락 대기 중/);
  assert.match(source, /hasAssignedRider/);
  assert.match(source, /MATCHING/);
  assert.match(source, /ygy:customer-package-accepted/);
  assert.match(source, /mergeDemoAcceptedAssignment/);
  assert.match(source, /hasOfferedPackage/);
  assert.match(source, /LLM 배차 안내 생성 준비 중입니다/);
  assert.match(source, /notice llm-guidance/);
  assert.match(source, /내 주문번호 #\$\{order\.order_id\}/);
  assert.match(template, /id="orderNumber"/);
});

test('고객 화면은 매장 주문 중 취소되지 않은 한 건을 선택해 조회한다', () => {
  const source = read('../static/customer/app.js');
  const client = read('../static/backend-client.js');
  const template = read('../static/customer/index.html');
  assert.match(source, /apiClient\.merchants\.get\(storeId\)/);
  assert.match(source, /order\.status !== 'CANCELLED'/);
  assert.match(source, /Math\.random\(\) \* availableOrders\.length/);
  assert.match(source, /Yogiyo\.qs\('storeId', Yogiyo\.defaultIds\.merchant\)/);
  assert.match(source, /Yogiyo\.qs\('orderId', Yogiyo\.defaultIds\.customer\)/);
  assert.match(source, /if \(isDirectOrderLookup && !useDemoActiveOrder\) return Yogiyo\.apiClient\.customers\.get\(orderId\)/);
  assert.match(source, /apiClient\.customers\.getDemoActive\(\)/);
  assert.match(source, /현재 시연 주문 자동 조회/);
  assert.match(client, /\/api\/customer\/demo\/active/);
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

test('사장님 화면은 배차 제안·수락 단계를 구분하고 조리 시작 뒤 시연 트리거를 호출한다', () => {
  const client = read('../static/backend-client.js');
  const screen = read('../static/merchant/app.js');
  const template = read('../static/merchant/index.html');
  assert.match(screen, /hasOfferedPackage/);
  assert.match(screen, /배차 제안됨 · 수락 대기/);
  assert.match(screen, /라이더 수락 완료 · 배차 완료/);
  assert.match(client, /\/api\/merchant\/demo-trigger/);
  assert.match(screen, /apiClient\.merchants\.demoTrigger\(\{/);
  assert.match(screen, /primaryStoreId: currentMerchant\?\.store_id \?\? storeId/);
  assert.match(screen, /primaryOrderId: orderId/);
  assert.match(screen, /ownerCookMin: cookMin/);
  assert.match(screen, /apiClient\.merchants\.nextToCook\(\)/);
  assert.doesNotMatch(screen, /apiClient\.merchants\.get\(storeId\)/);
  assert.match(client, /\/api\/merchant\/next-to-cook/);
  assert.match(screen, /locallyStartedOrderIds/);
  assert.match(screen, /조리 시작 요청 완료 · 상태 갱신 중/);
  assert.match(client, /primary_store_id/);
  assert.match(client, /primary_order_id/);
  assert.doesNotMatch(template, /demoBulkCookStartButton/);
  assert.match(template, /id="offeredCount"/);
  assert.match(template, /id="merchantExplanationContent"/);
  assert.match(screen, /AI 조리·포장 안내/);
  assert.match(template, /llm-guidance/);
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
  assert.match(screen, /AI 수락 판단/);
  assert.match(screen, /llm-guidance offer-ai-guidance/);
  assert.match(screen, /loadOfferExplanation/);
  assert.match(screen, /explanations\.get\(packageId\)/);
  assert.match(screen, /data-offer-decline/);
  assert.match(screen, /data-offer-detail/);
  assert.match(screen, /function declineOffer/);
  assert.match(screen, /offerSortValue/);
  assert.match(screen, /sortedVisibleOffers/);
  assert.doesNotMatch(screen, /uniqueOfferRepresentatives/);
  assert.doesNotMatch(screen, /maxVisibleOffers/);
  assert.match(screen, /모든 OFFERED 패키지를 누적해서 보여 준다/);
  assert.match(screen, /동일 주문 조합 제안을 이 화면에서 숨겼습니다/);
  assert.doesNotMatch(screen, /includesSelectedOrder/);
  assert.match(screen, /acceptedOfferOrderIds/);
  assert.match(screen, /class="assigned-package-list"/);
  assert.match(screen, /class="assigned-package-row/);
  assert.match(screen, /패키지 \$\{pkg\.package_id\} 상세 배차 정보 보기/);
  assert.match(screen, /예상 패키지 수익/);
  assert.match(screen, /routeActionControls/);
  assert.match(screen, /data-route-step/);
  assert.match(screen, /assigned-route-panel/);
  assert.match(screen, /모든 픽업 완료 시에만 고객 주문을 픽업 완료로 전환합니다/);
  assert.match(screen, /OFFERED → MATCHING으로 전환됩니다/);
  assert.match(screen, /서버에는 저장되지 않습니다/);
  assert.match(screen, /isFutureReservation/);
  assert.match(template, /id="currentRun"/);
  assert.match(template, /id="nextRunReservation"/);
  assert.match(styles, /\.offer-list \{[^}]*max-height:340px/);
  assert.match(styles, /\.offer-list-notice/);
  assert.match(styles, /\.assigned-package-list/);
  assert.match(styles, /\.assigned-package-row/);
  assert.match(styles, /\.assigned-route-panel/);
  assert.match(styles, /package-accepted-pulse/);
});

test('라이더는 묶음 패키지의 방문 단계를 순서대로 처리한다', () => {
  const screen = read('../static/rider/app.js');
  const styles = read('../static/common.css');
  assert.match(screen, /routeActionControls/);
  assert.match(screen, /data-route-step/);
  assert.match(screen, /completeRouteStep/);
  assert.match(screen, /pickupsComplete/);
  assert.match(screen, /deliveriesComplete/);
  assert.match(screen, /모든 픽업 완료 시에만 고객 주문을 픽업 완료로 전환합니다/);
  assert.match(styles, /\.route-stop-list/);
});

test('통합 시연은 선택 패널 없이 기본 시연 화면을 로드한다', () => {
  const source = read('../static/demo/app.js');
  const template = read('../static/demo/index.html');
  assert.match(source, /const demoStoreId/);
  assert.match(source, /const demoRiderId/);
  assert.match(source, /loadDemoPanels\(\)/);
  assert.match(source, /history\.replaceState/);
  assert.match(source, /mockMode && !demoStartupQuery\.has\('keepMock'\)/);
  assert.match(source, /Yogiyo\.resetMock\(\)/);
  assert.match(source, /customer\?storeId=/);
  assert.doesNotMatch(source, /demoOrderId/);
  assert.match(source, /apiClient\.merchants\.get\(storeId\)/);
  assert.match(source, /apiClient\.customers\.getDemoActive\(\)/);
  assert.match(source, /demoActive=1/);
  assert.match(source, /&orderId=\$\{encodeURIComponent\(orderId\)\}/);
  assert.match(source, /주문 \$\{orderId\}/);
  assert.match(source, /order\.status === 'NEW' && !order\.package_id/);
  assert.doesNotMatch(source, /order\.status !== 'CANCELLED'/);
  assert.doesNotMatch(template, /테스트 화면 선택/);
  assert.doesNotMatch(template, /demoStoreId|demoRiderId|applyDemoSelection/);
});

test('Future Slot 시연은 세 역할 화면에 미래 시간 예약과 경로 불변 안내를 표시한다', () => {
  const customer = read('../static/customer/app.js');
  const customerTemplate = read('../static/customer/index.html');
  const merchant = read('../static/merchant/app.js');
  const merchantTemplate = read('../static/merchant/index.html');
  const rider = read('../static/rider/app.js');
  const styles = read('../static/common.css');
  assert.match(customer, /futureSlotDemo/);
  assert.match(customerTemplate, /id="customerFutureSlotSection"/);
  assert.match(merchant, /renderMerchantFutureSlot/);
  assert.match(merchantTemplate, /id="merchantFutureSlotSection"/);
  assert.match(rider, /futureSlotDemoCard/);
  assert.match(rider, /현재 운행 경로 변경 없음/);
  assert.match(styles, /\.future-slot-card/);
});

test('통합 시연은 라이더 수락 이벤트를 받아 고객·사장님 프레임을 즉시 갱신한다', () => {
  const demo = read('../static/demo/app.js');
  const rider = read('../static/rider/app.js');
  assert.match(rider, /notifyDemoPackageAccepted/);
  assert.match(rider, /type: 'ygy:package-accepted'/);
  assert.match(rider, /orderIds/);
  assert.match(demo, /window\.addEventListener\('message'/);
  assert.match(demo, /event\.origin !== window\.location\.origin/);
  assert.match(demo, /ygy:customer-package-accepted/);
  assert.match(demo, /refreshDemoFrame\('demoMerchantFrame'\)/);
  assert.match(demo, /PACKAGE_ACCEPTED/);
});

test('라이더 패키지 상세는 No-Harm 품질 보증 비교와 데이터 미제공 상태를 표시한다', () => {
  const screen = read('../static/rider/app.js');
  const styles = read('../static/common.css');
  const mock = read('../static/mock-client.js');
  assert.match(screen, /noHarmGuaranteeCard/);
  assert.match(screen, /No-Harm 품질 보증서/);
  assert.match(screen, /단건 기준 ETA·음식 방치시간·라이더 수익 비교 데이터/);
  assert.match(screen, /보증 통과/);
  assert.match(styles, /\.quality-comparison/);
  assert.match(mock, /no_harm/);
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

test('세 역할 화면의 LLM 안내는 전용 색상 토큰을 사용한다', () => {
  const styles = read('../static/common.css');
  assert.match(styles, /--llm: #6d4cc7/);
  assert.match(styles, /\.llm-guidance \{ background:var\(--llm-soft\); color:var\(--llm\)/);
});
