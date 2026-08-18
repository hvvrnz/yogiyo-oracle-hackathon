const futureSlotDemo = Yogiyo.qs('futureSlot') === 'demo';
let currentOrder;
let stopPolling;

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
    description: action ? Yogiyo.errorMessage(error, '주문 취소') : Yogiyo.errorMessage(error, '시연 주문'),
    onRetry: () => loadCustomer(),
  });
};

const statusMeta = {
  NEW: { label: '신규 주문', progress: 0, message: '주문이 접수되었습니다. 매장에서 주문을 확인하고 있어요.' },
  COOKING: { label: '조리 중 · 배차 수락 대기', progress: 1, message: '음식을 조리하고 있어요. 라이더의 배차 수락을 기다리고 있습니다.' },
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

function renderCustomerExplanation() {
  const section = Yogiyo.el('customerExplanationSection');
  const content = Yogiyo.el('customerExplanationContent');
  if (!hasConfirmedAssignment(currentOrder)) {
    section.hidden = true;
    content.replaceChildren();
    return;
  }
  section.hidden = false;
  const text = String(currentOrder?.consumer_text || '').trim();
  const copy = text || '배차 안내를 준비 중입니다. 확정된 배차 정보는 위 상태와 경로에서 확인할 수 있습니다.';
  content.innerHTML = `<div class="notice llm-guidance"><span>✦</span><div><strong>배차 안내</strong><span class="explanation-copy">${Yogiyo.escape(copy)}</span></div></div>`;
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
      : '라이더 수락 대기 중'
    : order.eta_min == null ? 'ETA 계산 중' : `약 ${Math.ceil(order.eta_min)}분`;
  const items = Array.isArray(order.menu_items) ? order.menu_items : [];
  const map = Yogiyo.mapData.fromCustomerOrder(order);

  Yogiyo.el('orderId').textContent = `내 주문번호 #${order.order_id} · ${order.store_name}`;
  Yogiyo.el('etaWindow').textContent = etaLabel;
  Yogiyo.el('currentMessage').textContent = meta.message;
  Yogiyo.el('deliveryOrder').textContent = meta.label;
  Yogiyo.el('etaUpdated').textContent = '시연 주문 API · 5초 갱신';
  Yogiyo.el('statusBadge').innerHTML = `<span class="dot"></span>${Yogiyo.escape(meta.label)}`;
  Yogiyo.el('storeName').textContent = order.store_name;
  Yogiyo.el('orderNumber').textContent = `내 주문번호 #${order.order_id}`;
  Yogiyo.el('menuSummary').textContent = menuSummary(items);
  Yogiyo.el('remainingMin').textContent = order.status === 'CANCELLED' ? '취소됨' : etaLabel;
  Yogiyo.el('packageId').textContent = assignmentConfirmed
    ? `배차 번호 ${order.package_id}`
    : hasOfferedPackage(order) ? `배차 제안 ${order.package_id} · 라이더 수락 대기`
      : order.status === 'COOKING' ? '배차 수락 대기 중'
      : order.status === 'CANCELLED' ? '배차 취소됨' : '배차 번호 배정 전';
  [...Yogiyo.el('progressTrack').children].forEach((node, index) => node.classList.toggle('active', index <= meta.progress));
  Yogiyo.el('amount').textContent = Yogiyo.money(order.amount);
  Yogiyo.el('deliveryAddress').textContent = order.delivery_address || '배달지 주소 정보 없음';
  Yogiyo.el('itemsCard').innerHTML = items.map(item => `<div class="row"><span class="label">${Yogiyo.escape(item.menu)}</span><span class="value">${item.qty}개 · ${Yogiyo.money(item.price)}</span></div>`).join('') || '<div class="subtext">메뉴 정보가 없습니다.</div>';
  Yogiyo.renderMap('customerMap', map);
  Yogiyo.el('riderStep').textContent = order.rider_id ? `담당 라이더 ${order.rider_id}` : '담당 라이더 배정 전';
  renderCustomerFutureSlot();
  renderCustomerExplanation();

  const cancelButton = Yogiyo.el('createOrderButton');
  cancelButton.disabled = true;
  cancelButton.textContent = '시연 API에서는 주문 취소를 지원하지 않습니다';
  setContentVisible(true);
  Yogiyo.clearLoadState('customerLoadState');
  setConnection(true);
}

function refreshCustomer(order) {
  renderCustomer(order);
}

async function loadCustomer({ silent = false } = {}) {
  try {
    refreshCustomer(await Yogiyo.apiClient.demo.customerOrder());
  } catch (error) {
    showCustomerFailure(error);
    if (!silent) Yogiyo.toast(error.message);
  }
}

stopPolling = Yogiyo.poll(() => Yogiyo.apiClient.demo.customerOrder(), order => {
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
}, { once: true });
