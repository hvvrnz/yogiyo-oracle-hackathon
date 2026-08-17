let orderId = Yogiyo.qs('orderId', Yogiyo.defaultIds.customer);
const storeId = Yogiyo.qs('storeId', Yogiyo.defaultIds.merchant);
const isDirectOrderLookup = /^\d+$/.test(orderId);
const useDemoActiveOrder = Yogiyo.qs('demoActive') === '1';
const futureSlotDemo = Yogiyo.qs('futureSlot') === 'demo';
let usingDemoActiveOrder = false;
let demoAcceptedAssignment;
let currentOrder;
let stopPolling;
let stopRiderPolling;
let currentRider;
let currentRiderId;
let riderResolutionError;
let customerExplanation;
let customerExplanationPackageId;
let customerExplanationRequestId = 0;

const cancelBlockedStatuses = new Set(['PICKED_UP', 'DELIVERED', 'COMPLETED', 'CANCELLED']);
const assignmentConfirmedStatuses = new Set(['MATCHING', 'MATCHED', 'PICKED_UP', 'DELIVERED', 'COMPLETED']);
const hasPackage = order => order?.package_id != null && order?.package_id !== '';
const hasAssignedRider = order => order?.rider_id != null && order?.rider_id !== '';
const hasConfirmedAssignment = order => hasPackage(order) && (assignmentConfirmedStatuses.has(order?.status) || hasAssignedRider(order));
const hasOfferedPackage = order => order?.status === 'COOKING' && hasPackage(order) && !hasAssignedRider(order);
const setContentVisible = visible => { Yogiyo.el('customerContent').hidden = !visible; };
const showCustomerFailure = (error, { action = false } = {}) => {
  setConnection(false);
  if (!currentOrder) setContentVisible(false);
  Yogiyo.renderLoadState('customerLoadState', {
    title: action ? '주문을 취소하지 못했습니다.' : error?.status === 404 ? '매장 주문을 찾을 수 없습니다.' : '주문 정보를 불러오지 못했습니다.',
    description: action ? Yogiyo.errorMessage(error, '주문 취소') : Yogiyo.errorMessage(error, isDirectOrderLookup ? '주문' : '매장 주문'),
    onRetry: () => loadCustomer(),
  });
};

const statusMeta = {
  NEW: { label: '신규 주문', progress: 0, message: '주문이 접수되었습니다. 매장에서 주문을 확인하고 있어요.' },
  COOKING: { label: '조리 중', progress: 1, message: '음식을 조리하고 있어요. 배차 제안을 준비하고 있습니다.' },
  MATCHED: { label: '배차 완료', progress: 3, message: '배차가 완료되었습니다. 라이더가 픽업을 준비하고 있어요.' },
  PICKED_UP: { label: '픽업 완료', progress: 5, message: '라이더가 음식을 픽업해 배달 중이에요.' },
  DELIVERED: { label: '배달 완료', progress: 6, message: '배달이 완료되었습니다.' },
  COMPLETED: { label: '배달 완료', progress: 6, message: '배달이 완료되었습니다.' },
  CANCELLED: { label: '주문 취소', progress: 0, message: '이 주문은 취소되었습니다.' },
};

function setConnection(online) {
  const root = Yogiyo.el('connection');
  if (!root) return;
  root.classList.toggle('online', online);
  root.classList.toggle('offline', !online);
  const label = root.querySelector('span');
  if (label) label.textContent = online ? '서버 연결됨' : '재연결 필요';
}

function menuSummary(items) {
  return items.map(item => `${item.menu}${item.qty > 1 ? ` ${item.qty}개` : ''}`).join(' · ') || '메뉴 정보 없음';
}

function riderLocationLabel() {
  if (currentRider?.name || currentRiderId) return `${currentRider?.name || currentRiderId} 위치 · 5초 갱신`;
  if (riderResolutionError) return '담당 라이더 정보 조회 실패 · 다시 시도 중';
  return '담당 라이더 배정 전';
}

function explanationText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function renderCustomerExplanation() {
  const section = Yogiyo.el('customerExplanationSection');
  const content = Yogiyo.el('customerExplanationContent');
  const state = customerExplanation;
  section.hidden = !state?.packageId;
  if (!state?.packageId) {
    content.replaceChildren();
    return;
  }

  if (state.status === 'loading') {
    content.innerHTML = '<div class="notice info"><span>ⓘ</span><div><strong>배차 안내를 불러오는 중입니다.</strong><span>현재 배차 정보를 바탕으로 준비된 안내를 확인하고 있어요.</span></div></div>';
    return;
  }
  if (state.status === 'ready') {
    content.innerHTML = `<div class="notice info"><span>ⓘ</span><div><strong>배차 안내</strong><span class="explanation-copy">${Yogiyo.escape(state.text)}</span></div></div>`;
    return;
  }

  const isMissing = state.status === 'missing';
  content.innerHTML = `<div class="notice ${isMissing ? 'info' : 'warn'}"><span>${isMissing ? 'ⓘ' : '!'}</span><div><strong>${isMissing ? 'LLM 배차 안내 생성 준비 중입니다.' : '배차 안내를 불러오지 못했습니다.'}</strong><span>${isMissing ? '현재는 저장된 안내를 조회합니다. 생성된 문구가 준비되면 이곳에 표시됩니다.' : Yogiyo.escape(Yogiyo.errorMessage(state.error, '배차 안내'))}</span><button type="button" class="ghost-button explanation-retry" data-customer-explanation-retry>다시 확인</button></div></div>`;
  content.querySelector('[data-customer-explanation-retry]').addEventListener('click', () => {
    loadCustomerExplanation(state.packageId, { force: true });
  });
}

async function loadCustomerExplanation(packageId, { force = false } = {}) {
  const normalizedPackageId = String(packageId);
  if (!force && customerExplanationPackageId === normalizedPackageId && customerExplanation) return;
  const requestId = ++customerExplanationRequestId;
  customerExplanationPackageId = normalizedPackageId;
  customerExplanation = { packageId, status: 'loading' };
  renderCustomerExplanation();
  try {
    const explanation = await Yogiyo.apiClient.explanations.get(packageId);
    if (requestId !== customerExplanationRequestId || customerExplanationPackageId !== normalizedPackageId) return;
    const text = explanationText(explanation?.consumer_text);
    customerExplanation = text
      ? { packageId, status: 'ready', text }
      : { packageId, status: 'missing' };
  } catch (error) {
    if (requestId !== customerExplanationRequestId || customerExplanationPackageId !== normalizedPackageId) return;
    customerExplanation = error?.status === 404
      ? { packageId, status: 'missing' }
      : { packageId, status: 'error', error };
  }
  renderCustomerExplanation();
}

function syncCustomerExplanation(order) {
  const packageId = order.package_id;
  if (!hasConfirmedAssignment(order)) {
    customerExplanationRequestId += 1;
    customerExplanationPackageId = undefined;
    customerExplanation = undefined;
    return;
  }
  loadCustomerExplanation(packageId);
}

function customerStatusMeta(order) {
  if (hasConfirmedAssignment(order) && !['PICKED_UP', 'DELIVERED', 'COMPLETED', 'CANCELLED'].includes(order?.status)) {
    return statusMeta.MATCHED;
  }
  if (hasOfferedPackage(order)) {
    return {
      label: '배차 제안됨',
      progress: 1,
      message: '조리 중인 주문의 배차 제안이 생성되었습니다. 라이더의 수락을 기다리고 있어요.',
    };
  }
  return statusMeta[order.status] || { label: order.status || '상태 확인 중', progress: 0, message: '주문 상태를 확인하고 있어요.' };
}

function renderCustomerFutureSlot() {
  const section = Yogiyo.el('customerFutureSlotSection');
  section.hidden = !futureSlotDemo;
  if (!futureSlotDemo) return;
  Yogiyo.el('customerFutureSlotContent').innerHTML = '<div class="future-slot-card"><div class="future-slot-head"><strong>음식 완성 시점에 맞춘 라이더 방문 예약</strong><span class="badge good">예상 대기 0분</span></div><div class="future-slot-grid"><span>음식 완료 예정 <b>18:27</b></span><span>라이더 도착 예정 <b>18:27</b></span></div><p>현재 운행 경로는 변경하지 않고, 다음 운행만 미리 예약한 시연용 상태입니다.</p></div>';
}

function renderCustomer(order) {
  currentOrder = order;
  const meta = customerStatusMeta(order);
  const assignmentConfirmed = hasConfirmedAssignment(order);
  const etaLabel = !assignmentConfirmed && ['NEW', 'COOKING'].includes(order.status)
    ? order.status === 'NEW' ? '매장 확인 대기 중'
      : hasOfferedPackage(order) ? '라이더 수락 대기 중' : '배차 제안 생성 대기 중'
    : order.eta_min == null ? 'ETA 계산 중' : `약 ${Math.ceil(order.eta_min)}분`;
  const items = Array.isArray(order.menu_items) ? order.menu_items : [];
  const riderMap = currentRider
    ? Yogiyo.mapData.fromRiderProfile({ ...currentRider, rider_id: currentRiderId, meta: { selected: true } })
    : Yogiyo.mapData.create();
  const map = Yogiyo.mapData.combine(Yogiyo.mapData.fromCustomerOrder(order), riderMap);

  Yogiyo.el('orderId').textContent = `내 주문번호 #${order.order_id} · ${order.store_name}`;
  Yogiyo.el('etaWindow').textContent = etaLabel;
  Yogiyo.el('currentMessage').textContent = meta.message;
  Yogiyo.el('deliveryOrder').textContent = meta.label;
  Yogiyo.el('etaUpdated').textContent = usingDemoActiveOrder ? '현재 시연 주문 자동 조회' : isDirectOrderLookup ? '주문 ID 직접 조회' : `매장 ${storeId} 주문 중 임의 선택`;
  Yogiyo.el('statusBadge').innerHTML = `<span class="dot"></span>${Yogiyo.escape(meta.label)}`;
  Yogiyo.el('storeName').textContent = order.store_name;
  Yogiyo.el('orderNumber').textContent = `내 주문번호 #${order.order_id}`;
  Yogiyo.el('menuSummary').textContent = menuSummary(items);
  Yogiyo.el('remainingMin').textContent = order.status === 'CANCELLED' ? '취소됨' : etaLabel;
  Yogiyo.el('packageId').textContent = assignmentConfirmed
    ? `배차 번호 ${order.package_id}`
    : hasOfferedPackage(order) ? `배차 제안 ${order.package_id} · 라이더 수락 대기`
      : order.status === 'COOKING' ? '배차 제안 생성 대기 중'
      : order.status === 'CANCELLED' ? '배차 취소됨' : '배차 번호 배정 전';
  [...Yogiyo.el('progressTrack').children].forEach((node, index) => node.classList.toggle('active', index <= meta.progress));
  Yogiyo.el('amount').textContent = Yogiyo.money(order.amount);
  Yogiyo.el('itemsCard').innerHTML = items.map(item => `<div class="row"><span class="label">${Yogiyo.escape(item.menu)}</span><span class="value">${item.qty}개 · ${Yogiyo.money(item.price)}</span></div>`).join('') || '<div class="subtext">메뉴 정보가 없습니다.</div>';
  Yogiyo.renderMap('customerMap', map);
  Yogiyo.el('riderStep').textContent = riderLocationLabel();
  renderCustomerFutureSlot();
  renderCustomerExplanation();

  const cancelButton = Yogiyo.el('createOrderButton');
  const cancelBlocked = cancelBlockedStatuses.has(order.status);
  const cancelLabel = order.status === 'CANCELLED' ? '취소된 주문입니다'
    : order.status === 'PICKED_UP' ? '픽업 완료 후에는 취소할 수 없습니다'
      : ['DELIVERED', 'COMPLETED'].includes(order.status) ? '배달 완료된 주문입니다' : '주문 취소';
  cancelButton.disabled = cancelBlocked;
  cancelButton.textContent = cancelLabel;
  setContentVisible(true);
  Yogiyo.clearLoadState('customerLoadState');
  setConnection(true);
}

function startRiderPolling(riderId) {
  if (currentRiderId === riderId && stopRiderPolling) return;
  stopRiderPolling?.();
  currentRiderId = riderId;
  currentRider = undefined;
  stopRiderPolling = Yogiyo.poll(() => Yogiyo.apiClient.riders.profile(riderId), profile => {
    if (currentRiderId !== riderId) return;
    currentRider = profile;
    riderResolutionError = undefined;
    if (currentOrder) renderCustomer(currentOrder);
  }, {
    intervalMs: 5000,
    onError: error => {
      if (currentRiderId !== riderId) return;
      riderResolutionError = error;
      if (currentOrder) renderCustomer(currentOrder);
      console.warn('customer assigned-rider polling failed', error);
    },
  });
}

function clearRiderPolling() {
  stopRiderPolling?.();
  stopRiderPolling = undefined;
  currentRiderId = undefined;
  currentRider = undefined;
  riderResolutionError = undefined;
}

function syncAssignedRider(order) {
  const riderId = order.rider_id == null || order.rider_id === '' ? null : String(order.rider_id);
  if (!riderId) {
    if (currentRiderId || stopRiderPolling) clearRiderPolling();
    return;
  }
  startRiderPolling(riderId);
}

function mergeDemoAcceptedAssignment(order) {
  const assignment = demoAcceptedAssignment;
  if (!assignment || !order) return order;
  const orderIds = assignment.orderIds || [];
  const matchesPackage = String(order.package_id ?? '') === String(assignment.packageId);
  const matchesOrder = orderIds.some(orderId => String(orderId) === String(order.order_id));
  if (!matchesPackage && !matchesOrder) return order;
  return {
    ...order,
    package_id: order.package_id ?? assignment.packageId,
    rider_id: order.rider_id ?? assignment.riderId,
    status: ['COOKING', 'MATCHING'].includes(order.status) ? 'MATCHED' : order.status,
  };
}

function refreshCustomer(order) {
  const resolvedOrder = mergeDemoAcceptedAssignment(order);
  syncAssignedRider(resolvedOrder);
  syncCustomerExplanation(resolvedOrder);
  renderCustomer(resolvedOrder);
}

function noStoreOrderError() {
  const error = new Error('선택한 매장에 조회할 수 있는 주문이 없습니다. 통합 시연 또는 URL의 매장 번호를 확인해 주세요.');
  error.status = 404;
  return error;
}

async function loadSelectedCustomerOrder() {
  if (isDirectOrderLookup && !useDemoActiveOrder) return Yogiyo.apiClient.customers.get(orderId);
  try {
    const active = await Yogiyo.apiClient.customers.getDemoActive();
    const activeOrderId = String(active?.order_id || '');
    if (!/^\d+$/.test(activeOrderId)) throw noStoreOrderError();
    usingDemoActiveOrder = true;
    return Yogiyo.apiClient.customers.get(activeOrderId);
  } catch (error) {
    if (error?.status !== 404) throw error;
    usingDemoActiveOrder = false;
  }
  if (!/^\d+$/.test(storeId)) throw noStoreOrderError();

  const merchant = await Yogiyo.apiClient.merchants.get(storeId);
  const availableOrders = (merchant.orders || []).filter(order => (
    /^\d+$/.test(String(order.order_id ?? '')) && order.status !== 'CANCELLED'
  ));
  if (!availableOrders.length) throw noStoreOrderError();

  const selectedOrder = availableOrders[Math.floor(Math.random() * availableOrders.length)];
  orderId = String(selectedOrder.order_id);
  return Yogiyo.apiClient.customers.get(orderId);
}

async function loadCustomer({ silent = false } = {}) {
  try {
    refreshCustomer(await loadSelectedCustomerOrder());
  } catch (error) {
    showCustomerFailure(error);
    if (!silent) Yogiyo.toast(error.message);
  }
}

async function cancelOrder() {
  if (!currentOrder || cancelBlockedStatuses.has(currentOrder.status)) return;
  if (!window.confirm(`주문 ${currentOrder.order_id}을 취소할까요?\n픽업 완료된 주문은 취소할 수 없습니다.`)) return;
  try {
    const result = await Yogiyo.apiClient.customers.cancel(currentOrder.order_id);
    Yogiyo.toast(`주문 ${result.order_id}이 취소되었습니다.`);
    await loadCustomer();
  } catch (error) {
    showCustomerFailure(error, { action: true });
    Yogiyo.toast(error.message);
  }
}

Yogiyo.el('createOrderButton').addEventListener('click', event => Yogiyo.withPending(event.currentTarget, cancelOrder));

window.addEventListener('message', event => {
  if (event.origin !== window.location.origin || event.source !== window.parent) return;
  const { type, packageId, riderId, orderIds } = event.data || {};
  if (type !== 'ygy:customer-package-accepted' || packageId == null || !riderId) return;
  demoAcceptedAssignment = {
    packageId,
    riderId,
    orderIds: Array.isArray(orderIds) ? orderIds : [],
  };
  if (currentOrder) refreshCustomer(currentOrder);
});

stopPolling = Yogiyo.poll(() => loadSelectedCustomerOrder(), order => {
  refreshCustomer(order);
}, {
  intervalMs: 5000,
  onError: error => {
    setConnection(false);
    if (!currentOrder) showCustomerFailure(error);
    console.warn('customer polling failed', error);
  },
});
window.addEventListener('beforeunload', () => {
  stopPolling?.();
  stopRiderPolling?.();
}, { once: true });
