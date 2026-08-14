const orderId = Yogiyo.qs('orderId', Yogiyo.defaultIds.customer);
let currentOrder;
let stopPolling;
let stopRiderPolling;
let riderLocations = [];

const cancelBlockedStatuses = new Set(['PICKED_UP', 'COMPLETED', 'CANCELLED']);
const setContentVisible = visible => { Yogiyo.el('customerContent').hidden = !visible; };
const showCustomerFailure = (error, { action = false } = {}) => {
  setConnection(false);
  if (!currentOrder) setContentVisible(false);
  Yogiyo.renderLoadState('customerLoadState', {
    title: action ? '주문을 취소하지 못했습니다.' : error?.status === 404 ? '주문을 찾을 수 없습니다.' : '주문 정보를 불러오지 못했습니다.',
    description: action ? Yogiyo.errorMessage(error, '주문 취소') : Yogiyo.errorMessage(error, '주문'),
    onRetry: () => loadCustomer(),
  });
};

const statusMeta = {
  NEW: { label: '신규 주문', progress: 0, message: '주문이 접수되어 배차를 기다리고 있어요.' },
  MATCHED: { label: '배차 완료', progress: 3, message: '배차가 완료되었습니다. 라이더가 픽업을 준비하고 있어요.' },
  PICKED_UP: { label: '픽업 완료', progress: 5, message: '라이더가 음식을 픽업해 배달 중이에요.' },
  COMPLETED: { label: '배달 완료', progress: 6, message: '배달이 완료되었습니다.' },
  CANCELLED: { label: '주문 취소', progress: 0, message: '이 주문은 취소되었습니다.' },
};

function setConnection(online) {
  const root = Yogiyo.el('connection');
  if (!root) return;
  root.classList.toggle('online', online);
  const label = root.querySelector('span');
  if (label) label.textContent = online ? '서버 연결됨' : '재연결 필요';
}

function menuSummary(items) {
  return items.map(item => `${item.menu}${item.qty > 1 ? ` ${item.qty}개` : ''}`).join(' · ') || '메뉴 정보 없음';
}

function renderCustomer(order) {
  currentOrder = order;
  const meta = statusMeta[order.status] || { label: order.status || '상태 확인 중', progress: 0, message: '주문 상태를 확인하고 있어요.' };
  const etaLabel = order.eta_min == null ? 'ETA 계산 중' : `약 ${Math.ceil(order.eta_min)}분`;
  const items = Array.isArray(order.menu_items) ? order.menu_items : [];
  const map = Yogiyo.mapData.combine(
    Yogiyo.mapData.fromCustomerOrder(order),
    Yogiyo.mapData.fromRiders(riderLocations),
  );

  Yogiyo.el('orderId').textContent = `주문 ${order.order_id} · ${order.store_name}`;
  Yogiyo.el('etaWindow').textContent = etaLabel;
  Yogiyo.el('currentMessage').textContent = meta.message;
  Yogiyo.el('deliveryOrder').textContent = meta.label;
  Yogiyo.el('etaUpdated').textContent = '주문 API 기준';
  Yogiyo.el('statusBadge').innerHTML = `<span class="dot"></span>${Yogiyo.escape(meta.label)}`;
  Yogiyo.el('storeName').textContent = order.store_name;
  Yogiyo.el('menuSummary').textContent = menuSummary(items);
  Yogiyo.el('remainingMin').textContent = order.status === 'CANCELLED' ? '취소됨' : etaLabel;
  [...Yogiyo.el('progressTrack').children].forEach((node, index) => node.classList.toggle('active', index <= meta.progress));
  Yogiyo.el('amount').textContent = Yogiyo.money(order.amount);
  Yogiyo.el('itemsCard').innerHTML = items.map(item => `<div class="row"><span class="label">${Yogiyo.escape(item.menu)}</span><span class="value">${item.qty}개 · ${Yogiyo.money(item.price)}</span></div>`).join('') || '<div class="subtext">메뉴 정보가 없습니다.</div>';
  Yogiyo.renderMap('customerMap', map);
  Yogiyo.el('riderStep').textContent = riderLocations.length ? `전체 라이더 ${riderLocations.length}명 위치 · 5초 갱신` : '라이더 위치 조회 중';

  const cancelButton = Yogiyo.el('createOrderButton');
  const cancelBlocked = cancelBlockedStatuses.has(order.status);
  const cancelLabel = order.status === 'CANCELLED' ? '취소된 주문입니다'
    : order.status === 'PICKED_UP' ? '픽업 완료 후에는 취소할 수 없습니다'
      : order.status === 'COMPLETED' ? '배달 완료된 주문입니다' : '주문 취소';
  cancelButton.disabled = cancelBlocked;
  cancelButton.textContent = cancelLabel;
  setContentVisible(true);
  Yogiyo.clearLoadState('customerLoadState');
  setConnection(true);
}

async function loadCustomer({ silent = false } = {}) {
  try {
    renderCustomer(await Yogiyo.apiClient.customers.get(orderId));
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

function switchOrder(nextOrderId) {
  location.href = `/customer?orderId=${encodeURIComponent(nextOrderId)}`;
}

Yogiyo.el('orderIdInput').value = orderId;
Yogiyo.el('createOrderButton').addEventListener('click', event => Yogiyo.withPending(event.currentTarget, cancelOrder));
Yogiyo.el('loadOrderButton')?.addEventListener('click', () => {
  const nextOrderId = Yogiyo.el('orderIdInput').value.trim();
  if (!/^\d+$/.test(nextOrderId)) { Yogiyo.toast('숫자로 된 주문 번호를 입력해 주세요.'); return; }
  switchOrder(nextOrderId);
});
Yogiyo.el('orderIdInput')?.addEventListener('keydown', event => {
  if (event.key === 'Enter') Yogiyo.el('loadOrderButton').click();
});

const updateRiderLocations = response => {
  riderLocations = Array.isArray(response?.riders) ? response.riders : [];
  if (currentOrder) renderCustomer(currentOrder);
};
stopRiderPolling = Yogiyo.pollRiders(updateRiderLocations, {
  intervalMs: 5000,
  onError: error => {
    console.warn('customer rider-location polling failed', error);
    if (currentOrder) Yogiyo.el('riderStep').textContent = '라이더 위치 갱신 실패 · 다시 시도 중';
  },
});
stopPolling = Yogiyo.poll(() => Yogiyo.apiClient.customers.get(orderId), renderCustomer, {
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
