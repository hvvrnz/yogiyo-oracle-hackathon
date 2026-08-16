const mockMode = Yogiyo.useMock;
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

const demoStoreSelect = Yogiyo.el('demoStoreId');
const demoRiderSelect = Yogiyo.el('demoRiderId');
const hongdaeSoloPresetButton = Yogiyo.el('hongdaeSoloPresetButton');
const futureSlotPresetButton = Yogiyo.el('futureSlotPresetButton');
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
const hongdaeSoloPreset = Object.freeze({ id: 'hongdae-solo', storeId: '884', riderId: 'rider_2' });
const futureSlotPreset = Object.freeze({ id: 'future-slot', storeId: '884', riderId: 'rider_2' });
const knownPresetIds = new Set([hongdaeSoloPreset.id, futureSlotPreset.id]);
let activePreset = knownPresetIds.has(demoQuery.get('preset')) ? demoQuery.get('preset') : undefined;
let demoSelectionRequestId = 0;

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
  if (!demoQuery.has('storeId')) demoStoreSelect.value = '894';
  if (!demoQuery.has('riderId')) demoRiderSelect.value = 'rider_12';
  Yogiyo.el('demoSelectorHelp').textContent = '목업 전체 흐름: 매장 894 주문 중 한 건을 고객으로 표시하고, 매장 894에서 조리 시작 → 약 1초 뒤 rider_12가 제안을 수락 → 픽업·완료를 진행하세요.';
  Yogiyo.el('resetMockDemo').hidden = false;
  hongdaeSoloPresetButton.disabled = true;
  hongdaeSoloPresetButton.title = '홍대 SOLO 목업 주문은 시연 데이터 작업 후 사용할 수 있습니다.';
  futureSlotPresetButton.title = '목업 강남894점·rider_12 기준으로 Future Slot UI를 표시합니다.';
}

syncRiderOptions();

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
  const { type, packageId, riderId } = event.data || {};
  if (type !== 'ygy:package-accepted') return;
  refreshDemoFrame('demoCustomerFrame');
  refreshDemoFrame('demoMerchantFrame');
  const message = `패키지 ${packageId}를 ${riderId}가 수락했습니다. 고객·사장님 화면을 즉시 갱신했습니다.`;
  appendDemoEvent('PACKAGE_ACCEPTED', message);
  Yogiyo.el('simulationAnnouncement').textContent = message;
  Yogiyo.toast('배차 수락 상태를 고객·사장님 화면에 즉시 반영했습니다.');
});

const syncPresetButton = () => {
  hongdaeSoloPresetButton.setAttribute('aria-pressed', String(activePreset === hongdaeSoloPreset.id));
  futureSlotPresetButton.setAttribute('aria-pressed', String(activePreset === futureSlotPreset.id));
};

const demoOrderCandidate = orders => (orders || []).find(order => (
  order.status === 'NEW' && !order.package_id
)) || (orders || []).find(order => order.status !== 'CANCELLED');

const applyDemoSelection = ({ futureSlot = false } = {}) => {
  activePreset = futureSlot ? futureSlotPreset.id : undefined;
  demoSelectionRequestId += 1;
  const storeId = demoStoreSelect.value;
  const riderId = demoRiderSelect.value;
  const storeName = demoStoreSelect.options[demoStoreSelect.selectedIndex].text;

  const futureSlotQuery = futureSlot ? '&futureSlot=demo' : '';
  const customerUrl = `/customer?storeId=${encodeURIComponent(storeId)}${futureSlotQuery}`;
  setDemoPanel('demoCustomerFrame', 'demoCustomerLink', 'demoCustomerTitle', customerUrl,
    futureSlot ? `고객 · Future Slot · ${storeName} 주문 1건` : `고객 · ${storeName} 주문 1건`);
  setDemoPanel('demoMerchantFrame', 'demoMerchantLink', 'demoMerchantTitle', `/merchant?storeId=${encodeURIComponent(storeId)}${futureSlotQuery}`,
    `사장님 · ${storeName}`);
  setDemoPanel('demoRiderFrame', 'demoRiderLink', 'demoRiderTitle', `/rider?riderId=${encodeURIComponent(riderId)}${futureSlotQuery}`,
    `라이더 · ${riderId}`);

  const nextQuery = new URLSearchParams({ storeId, riderId });
  if (futureSlot) nextQuery.set('preset', futureSlotPreset.id);
  if (futureSlot) nextQuery.set('futureSlot', 'demo');
  history.replaceState(null, '', `${location.pathname}?${nextQuery.toString()}`);
  syncPresetButton();
};

const applyHongdaeSoloPreset = async ({ useQueryOrder = false, futureSlot = false } = {}) => {
  if (mockMode) return;
  const requestId = ++demoSelectionRequestId;
  const preset = futureSlot ? futureSlotPreset : hongdaeSoloPreset;
  activePreset = preset.id;
  demoStoreSelect.value = preset.storeId;
  syncRiderOptions();
  demoRiderSelect.value = preset.riderId;
  syncPresetButton();

  const storeName = demoStoreSelect.options[demoStoreSelect.selectedIndex].text;
  const futureSlotQuery = futureSlot ? '&futureSlot=demo' : '';
  setDemoPanel('demoMerchantFrame', 'demoMerchantLink', 'demoMerchantTitle', `/merchant?storeId=${preset.storeId}${futureSlotQuery}`,
    `사장님 · ${storeName}`);
  setDemoPanel('demoRiderFrame', 'demoRiderLink', 'demoRiderTitle', `/rider?riderId=${preset.riderId}${futureSlotQuery}`,
    `라이더 · ${preset.riderId}`);
  setDemoPanel('demoCustomerFrame', 'demoCustomerLink', 'demoCustomerTitle', `/customer?storeId=${preset.storeId}${futureSlotQuery}`,
    futureSlot ? '고객 · Future Slot 시연 주문 확인 중' : '고객 · 홍대 SOLO 시연 주문 확인 중');

  try {
    const queryOrderId = useQueryOrder ? demoQuery.get('orderId') : undefined;
    const orderId = /^\d+$/.test(queryOrderId || '')
      ? queryOrderId
      : String(demoOrderCandidate((await Yogiyo.apiClient.merchants.get(preset.storeId)).orders)?.order_id || '');
    if (requestId !== demoSelectionRequestId) return;
    if (!/^\d+$/.test(orderId)) throw new Error('홍대 884점에 시연할 주문이 없습니다. 백엔드 초기화 후 주문 데이터를 확인해 주세요.');

    const customerUrl = `/customer?storeId=${preset.storeId}&orderId=${encodeURIComponent(orderId)}${futureSlotQuery}`;
    setDemoPanel('demoCustomerFrame', 'demoCustomerLink', 'demoCustomerTitle', customerUrl,
      futureSlot ? `고객 · Future Slot 주문 ${orderId}` : `고객 · 홍대 SOLO 주문 ${orderId}`);
    const nextQuery = new URLSearchParams({
      preset: preset.id,
      storeId: preset.storeId,
      riderId: preset.riderId,
      orderId,
    });
    if (futureSlot) nextQuery.set('futureSlot', 'demo');
    history.replaceState(null, '', `${location.pathname}?${nextQuery.toString()}`);
    Yogiyo.toast(futureSlot ? `Future Slot 시연 주문 ${orderId}을 고정했습니다.` : `홍대 SOLO 시연 주문 ${orderId}을 고정했습니다.`);
  } catch (error) {
    if (requestId !== demoSelectionRequestId) return;
    activePreset = undefined;
    syncPresetButton();
    Yogiyo.el('demoCustomerTitle').textContent = '고객 · 홍대 시연 주문 없음';
    Yogiyo.toast(error.message);
  }
};

Yogiyo.el('applyDemoSelection').addEventListener('click', applyDemoSelection);
demoStoreSelect.addEventListener('change', syncRiderOptions);
hongdaeSoloPresetButton.addEventListener('click', () => applyHongdaeSoloPreset());
futureSlotPresetButton.addEventListener('click', () => {
  if (mockMode) {
    demoStoreSelect.value = '894';
    syncRiderOptions();
    demoRiderSelect.value = 'rider_12';
    applyDemoSelection({ futureSlot: true });
    Yogiyo.toast('목업 Future Slot 시연을 적용했습니다. 예약 상태는 화면 전용입니다.');
    return;
  }
  applyHongdaeSoloPreset({ futureSlot: true });
});
Yogiyo.el('resetMockDemo').addEventListener('click', () => {
  if (!mockMode) return;
  Yogiyo.resetMock();
  location.assign('/demo?storeId=894&riderId=rider_12');
});
if (activePreset && !mockMode) applyHongdaeSoloPreset({ useQueryOrder: true, futureSlot: activePreset === futureSlotPreset.id });
else applyDemoSelection({ futureSlot: activePreset === futureSlotPreset.id });
