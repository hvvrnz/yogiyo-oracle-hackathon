const mockMode = Yogiyo.useMock;
const demoStartupQuery = new URLSearchParams(location.search);
if (mockMode && !demoStartupQuery.has('keepMock')) Yogiyo.resetMock();
const controlRoot = document.querySelector('.control-groups');
if (controlRoot) {
  controlRoot.innerHTML = mockMode
    ? '<section class="control-subpanel"><h3>개발용 목업 모드</h3><p style="color:#b7b7c1;font-size:11px;margin:0;line-height:1.6">브라우저에 저장된 목업 주문·매장·라이더 데이터를 사용합니다. 고객 취소, 사장님 조리시간 변경, 라이더 패키지 처리도 실제 화면과 같은 API 인터페이스로 동작합니다.</p></section>'
    : '<section class="control-subpanel"><h3>실제 서버 조회 모드</h3><p style="color:#b7b7c1;font-size:11px;margin:0;line-height:1.6">매장 889·894·884와 해당 권역 라이더를 조회합니다. 고객 화면은 선택한 매장 주문 중 한 건을 표시합니다. 데이터 생성·초기화·가상 시나리오는 실행하지 않습니다.</p></section>';
}
Yogiyo.el('demoModeDescription').textContent = mockMode
  ? '개발용 목업 모드입니다. 화면별 상태 변경은 브라우저 목업 데이터에만 반영됩니다.'
  : '실제 Oracle DB 조회 모드입니다. 각 패널은 현재 데이터 상태를 독립적으로 5초마다 갱신합니다.';
Yogiyo.el('backendDocsLink').hidden = mockMode;
Yogiyo.el('connectionText').textContent = mockMode ? '개발용 목업 데이터' : '실제 REST 조회 모드';
Yogiyo.el('summaryStatus').textContent = mockMode ? '목업 데이터' : '읽기 전용';
Yogiyo.el('summaryOrders').textContent = '선택 매장 주문 1건';
Yogiyo.el('summaryDuration').textContent = '5초 폴링';
Yogiyo.el('summaryStrategy').textContent = mockMode ? '브라우저 저장소' : '역할별 독립 조회';
Yogiyo.el('summaryRevenue').textContent = '매장 889 · 894 · 884';
Yogiyo.el('summaryRider').textContent = '강남 rider_12 등 · 홍대 rider_2 등';
Yogiyo.el('summaryVersion').textContent = mockMode ? 'VITE_USE_MOCK=true' : '실제 API';
Yogiyo.el('eventList').innerHTML = mockMode
  ? '<div class="event"><code>MOCK_MODE</code><span>백엔드 없이 개발용 목업 데이터로 화면 흐름을 확인하고 있습니다.</span><time>LOCAL</time></div>'
  : '<div class="event"><code>REAL_DATA_MODE</code><span>목업 시나리오 제어는 실제 데이터 모드에서 비활성화되어 있습니다.</span><time>REST</time></div>';

const demoQuery = new URLSearchParams(location.search);
let demoSelectionRequestId = 0;
const demoStoreId = ['889', '894', '884'].includes(demoQuery.get('storeId')) ? demoQuery.get('storeId') : '889';
const demoRiderId = /^rider_\d+$/.test(demoQuery.get('riderId') || '') ? demoQuery.get('riderId') : 'rider_12';

const setDemoPanel = (frameId, linkId, titleId, url, title) => {
  Yogiyo.el(frameId).src = url;
  Yogiyo.el(linkId).href = url;
  Yogiyo.el(titleId).textContent = title;
};

const refreshDemoFrame = frameId => {
  const frame = Yogiyo.el(frameId);
  try {
    frame.contentWindow.location.reload();
  } catch {
    frame.src = frame.src;
  }
};

const appendDemoEvent = (code, message) => {
  const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  Yogiyo.el('eventList').insertAdjacentHTML('afterbegin', `<div class="event"><code>${Yogiyo.escape(code)}</code><span>${Yogiyo.escape(message)}</span><time>${Yogiyo.escape(time)}</time></div>`);
};

window.addEventListener('message', event => {
  if (event.origin !== window.location.origin || event.source !== Yogiyo.el('demoRiderFrame').contentWindow) return;
  const { type, packageId, riderId, orderIds } = event.data || {};
  if (type !== 'ygy:package-accepted') return;
  Yogiyo.el('demoCustomerFrame').contentWindow?.postMessage({
    type: 'ygy:customer-package-accepted',
    packageId,
    riderId,
    orderIds: Array.isArray(orderIds) ? orderIds : [],
  }, window.location.origin);
  refreshDemoFrame('demoMerchantFrame');
  const message = `패키지 ${packageId}를 ${riderId}가 수락했습니다. 고객·사장님 화면을 즉시 갱신했습니다.`;
  appendDemoEvent('PACKAGE_ACCEPTED', message);
  Yogiyo.el('simulationAnnouncement').textContent = message;
  Yogiyo.toast('배차 수락 상태를 고객·사장님 화면에 즉시 반영했습니다.');
});

const loadDemoPanels = async () => {
  const requestId = ++demoSelectionRequestId;
  const riderId = demoRiderId;

  try {
    await Yogiyo.apiClient.demo.reset();
    if (requestId !== demoSelectionRequestId) return;
    setDemoPanel('demoCustomerFrame', 'demoCustomerLink', 'demoCustomerTitle', '/customer', '고객 · 주문 90001');
    setDemoPanel('demoMerchantFrame', 'demoMerchantLink', 'demoMerchantTitle', '/merchant', '사장님 · 매장 889');
    setDemoPanel('demoRiderFrame', 'demoRiderLink', 'demoRiderTitle', `/rider?riderId=${encodeURIComponent(riderId)}`, `라이더 · ${riderId}`);
    appendDemoEvent('DEMO_RESET', '시연 데이터를 초기화했습니다. 고객 주문 90001을 기준으로 시작합니다.');
  } catch (error) {
    if (requestId !== demoSelectionRequestId) return;
    Yogiyo.el('demoCustomerTitle').textContent = '고객 · 시연 주문 없음';
    Yogiyo.el('demoRiderTitle').textContent = `라이더 · ${riderId} · 주문 연결 실패`;
    setDemoPanel('demoCustomerFrame', 'demoCustomerLink', 'demoCustomerTitle', '/customer', '고객 · 시연 연결 실패');
    setDemoPanel('demoMerchantFrame', 'demoMerchantLink', 'demoMerchantTitle', '/merchant', '사장님 · 시연 연결 실패');
    setDemoPanel('demoRiderFrame', 'demoRiderLink', 'demoRiderTitle', `/rider?riderId=${encodeURIComponent(riderId)}`, `라이더 · ${riderId} · 시연 연결 실패`);
    Yogiyo.toast(error.message);
  }
};

loadDemoPanels();
