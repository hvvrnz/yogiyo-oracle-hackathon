const mockMode = Yogiyo.useMock;
const controlRoot = document.querySelector('.control-groups');
if (controlRoot) {
  controlRoot.innerHTML = mockMode
    ? '<section class="control-subpanel"><h3>개발용 목업 모드</h3><p style="color:#b7b7c1;font-size:11px;margin:0;line-height:1.6">브라우저에 저장된 목업 주문·매장·라이더 데이터를 사용합니다. 고객 취소, 사장님 조리시간 변경, 라이더 패키지 처리도 실제 화면과 같은 API 인터페이스로 동작합니다.</p></section>'
    : '<section class="control-subpanel"><h3>실제 서버 조회 모드</h3><p style="color:#b7b7c1;font-size:11px;margin:0;line-height:1.6">매장 889·894·884와 해당 권역 라이더를 조회합니다. 고객 주문 번호는 DB 초기화 후 백엔드 담당자가 전달합니다. 데이터 생성·초기화·가상 시나리오는 실행하지 않습니다.</p></section>';
}
Yogiyo.el('demoModeDescription').textContent = mockMode
  ? '개발용 목업 모드입니다. 화면별 상태 변경은 브라우저 목업 데이터에만 반영됩니다.'
  : '실제 Oracle DB 조회 모드입니다. 각 패널은 현재 데이터 상태를 독립적으로 5초마다 갱신합니다.';
Yogiyo.el('backendDocsLink').hidden = mockMode;
Yogiyo.el('connectionText').textContent = mockMode ? '개발용 목업 데이터' : '실제 REST 조회 모드';
Yogiyo.el('summaryStatus').textContent = mockMode ? '목업 데이터' : '읽기 전용';
Yogiyo.el('summaryOrders').textContent = '초기화 후 주문 번호 입력';
Yogiyo.el('summaryDuration').textContent = '5초 폴링';
Yogiyo.el('summaryStrategy').textContent = mockMode ? '브라우저 저장소' : '역할별 독립 조회';
Yogiyo.el('summaryRevenue').textContent = '매장 889 · 894 · 884';
Yogiyo.el('summaryRider').textContent = '강남 rider_12 등 · 홍대 rider_2 등';
Yogiyo.el('summaryVersion').textContent = mockMode ? 'VITE_USE_MOCK=true' : '실제 API';
Yogiyo.el('eventList').innerHTML = mockMode
  ? '<div class="event"><code>MOCK_MODE</code><span>백엔드 없이 개발용 목업 데이터로 화면 흐름을 확인하고 있습니다.</span><time>LOCAL</time></div>'
  : '<div class="event"><code>REAL_DATA_MODE</code><span>목업 시나리오 제어는 실제 데이터 모드에서 비활성화되어 있습니다.</span><time>REST</time></div>';

const demoOrderInput = Yogiyo.el('demoOrderId');
const demoStoreSelect = Yogiyo.el('demoStoreId');
const demoRiderSelect = Yogiyo.el('demoRiderId');
const regionByStoreId = Object.freeze({
  889: 'gangnam',
  894: 'gangnam',
  884: 'hongdae',
});
const riderIdsByRegion = Object.freeze({
  gangnam: ['rider_12', 'rider_13', 'rider_19', 'rider_23', 'rider_31'],
  hongdae: ['rider_2', 'rider_5', 'rider_6'],
});
const demoQuery = new URLSearchParams(location.search);

if (demoQuery.has('orderId')) demoOrderInput.value = demoQuery.get('orderId');
if (regionByStoreId[demoQuery.get('storeId')]) demoStoreSelect.value = demoQuery.get('storeId');
if ([...demoRiderSelect.options].some(option => option.value === demoQuery.get('riderId'))) demoRiderSelect.value = demoQuery.get('riderId');

const syncRiderOptions = () => {
  const allowedRiderIds = riderIdsByRegion[regionByStoreId[demoStoreSelect.value]] || [];
  [...demoRiderSelect.options].forEach(option => {
    const available = allowedRiderIds.includes(option.value);
    option.hidden = !available;
    option.disabled = !available;
  });
  if (!allowedRiderIds.includes(demoRiderSelect.value)) demoRiderSelect.value = allowedRiderIds[0] || '';
};

if (mockMode) {
  if (!demoQuery.has('orderId')) demoOrderInput.value = '8941';
  if (!demoQuery.has('storeId')) demoStoreSelect.value = '894';
  if (!demoQuery.has('riderId')) demoRiderSelect.value = 'rider_12';
  Yogiyo.el('demoSelectorHelp').textContent = '목업 전체 흐름: 주문 8941을 고객으로 조회하고, 매장 894에서 조리 시작 → 약 1초 뒤 rider_12가 제안을 수락 → 픽업·완료를 진행하세요.';
  Yogiyo.el('resetMockDemo').hidden = false;
}

syncRiderOptions();

const setDemoPanel = (frameId, linkId, titleId, url, title) => {
  Yogiyo.el(frameId).src = url;
  Yogiyo.el(linkId).href = url;
  Yogiyo.el(titleId).textContent = title;
};

const applyDemoSelection = () => {
  const orderId = demoOrderInput.value.trim();
  const storeId = demoStoreSelect.value;
  const riderId = demoRiderSelect.value;
  const storeName = demoStoreSelect.options[demoStoreSelect.selectedIndex].text;

  const customerUrl = orderId ? `/customer?orderId=${encodeURIComponent(orderId)}` : '/customer';
  setDemoPanel('demoCustomerFrame', 'demoCustomerLink', 'demoCustomerTitle', customerUrl,
    orderId ? `고객 · 주문 ${orderId}` : '고객 · 주문 번호 입력');
  setDemoPanel('demoMerchantFrame', 'demoMerchantLink', 'demoMerchantTitle', `/merchant?storeId=${encodeURIComponent(storeId)}`,
    `사장님 · ${storeName}`);
  setDemoPanel('demoRiderFrame', 'demoRiderLink', 'demoRiderTitle', `/rider?riderId=${encodeURIComponent(riderId)}`,
    `라이더 · ${riderId}`);

  const nextQuery = new URLSearchParams({ storeId, riderId });
  if (orderId) nextQuery.set('orderId', orderId);
  history.replaceState(null, '', `${location.pathname}?${nextQuery.toString()}`);
};

Yogiyo.el('applyDemoSelection').addEventListener('click', applyDemoSelection);
demoStoreSelect.addEventListener('change', syncRiderOptions);
demoOrderInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') applyDemoSelection();
});
Yogiyo.el('resetMockDemo').addEventListener('click', () => {
  if (!mockMode) return;
  Yogiyo.resetMock();
  location.assign('/demo?orderId=8941&storeId=894&riderId=rider_12');
});
applyDemoSelection();
