const orderId = Yogiyo.qs('orderId', Yogiyo.defaultIds.customer);
let currentOrder;
let stopPolling;

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

function renderUnavailableMetrics() {
  Yogiyo.el('deliveryPreference').textContent = '고객 선택 정보는 현재 API에서 제공되지 않아요';
  Yogiyo.el('resolvedDelivery').textContent = '패키지 상세 정보는 라이더 화면에서 확인할 수 있어요';
  Yogiyo.el('assignedRider').textContent = '라이더 정보는 현재 고객 API에서 제공되지 않아요';
  Yogiyo.el('readyGap').textContent = '-';
  Yogiyo.el('routeOverlap').textContent = '-';
  Yogiyo.el('bagTime').textContent = '-';
  Yogiyo.el('bagLimit').textContent = 'API 미제공';
  Yogiyo.el('routeStrategyLabel').textContent = '방문 순서는 라이더 화면에서 확인할 수 있어요';
  Yogiyo.el('routeStrategyDescription').textContent = '고객 API는 주문 ETA와 매장·배달지 좌표를 제공합니다.';
  Yogiyo.el('riderStep').textContent = '라이더 정보 미제공';
  Yogiyo.el('qualityBag').textContent = '-';
  Yogiyo.el('qualityLimit').textContent = '-';
  Yogiyo.el('qualityMargin').textContent = '-';
  Yogiyo.el('qualityBadge').textContent = '정보 미제공';
  Yogiyo.el('qualityBadge').className = 'badge info';
  Yogiyo.el('qualityNotice').className = 'notice info';
  Yogiyo.el('qualityNoticeIcon').textContent = 'ⓘ';
  Yogiyo.el('qualityNoticeTitle').textContent = '품질 지표는 현재 제공되지 않아요';
  Yogiyo.el('qualityNoticeDescription').textContent = '가방 체류시간과 품질 제한은 패키지 상세 API가 추가되면 표시할 수 있습니다.';
  Yogiyo.el('weatherIcon').textContent = '—';
  Yogiyo.el('weatherTitle').textContent = '날씨 데이터 미연동';
  Yogiyo.el('weatherAdvisory').textContent = '현재 백엔드 API는 날씨 정보를 제공하지 않습니다.';
  Yogiyo.el('temperature').textContent = '-';
  Yogiyo.el('whyButton').disabled = true;
  Yogiyo.el('whyButton').textContent = '패키지 ID가 제공되면 설명을 조회할 수 있어요';
}

function renderCustomer(order) {
  currentOrder = order;
  const meta = statusMeta[order.status] || { label: order.status || '상태 확인 중', progress: 0, message: '주문 상태를 확인하고 있어요.' };
  const etaLabel = order.eta_min == null ? 'ETA 계산 중' : `약 ${Math.ceil(order.eta_min)}분`;
  const items = Array.isArray(order.menu_items) ? order.menu_items : [];
  const map = Yogiyo.mapData.fromCustomerOrder(order);

  Yogiyo.el('orderId').textContent = `주문 ${order.order_id} · ${order.store_name}`;
  Yogiyo.el('etaWindow').textContent = etaLabel;
  Yogiyo.el('currentMessage').textContent = meta.message;
  Yogiyo.el('deliveryOrder').textContent = order.status === 'MATCHED' ? '패키지 배차 완료' : meta.label;
  Yogiyo.el('etaUpdated').textContent = '서버 조회 기준';
  Yogiyo.el('statusBadge').innerHTML = `<span class="dot"></span>${Yogiyo.escape(meta.label)}`;
  Yogiyo.el('storeName').textContent = order.store_name;
  Yogiyo.el('menuSummary').textContent = menuSummary(items);
  Yogiyo.el('remainingMin').textContent = order.status === 'CANCELLED' ? '취소됨' : etaLabel;
  [...Yogiyo.el('progressTrack').children].forEach((node, index) => node.classList.toggle('active', index <= meta.progress));
  Yogiyo.el('amount').textContent = Yogiyo.money(order.amount);
  Yogiyo.el('itemsCard').innerHTML = items.map(item => `<div class="row"><span class="label">${Yogiyo.escape(item.menu)}</span><span class="value">${item.qty}개 · ${Yogiyo.money(item.price)}</span></div>`).join('') || '<div class="subtext">메뉴 정보가 없습니다.</div>';
  Yogiyo.renderMap('customerMap', map);
  renderUnavailableMetrics();

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

Yogiyo.el('createOrderButton').addEventListener('click', event => Yogiyo.withPending(event.currentTarget, cancelOrder));
Yogiyo.el('customerSwitcher').querySelectorAll('[data-order-id]').forEach(button => {
  button.className = button.dataset.orderId === orderId ? 'primary-button' : 'ghost-button';
  button.addEventListener('click', () => switchOrder(button.dataset.orderId));
});
Yogiyo.el('loadOrderButton')?.addEventListener('click', () => {
  const nextOrderId = Yogiyo.el('orderIdInput').value.trim();
  if (!/^\d+$/.test(nextOrderId)) { Yogiyo.toast('숫자로 된 주문 번호를 입력해 주세요.'); return; }
  switchOrder(nextOrderId);
});
Yogiyo.el('orderIdInput')?.addEventListener('keydown', event => {
  if (event.key === 'Enter') Yogiyo.el('loadOrderButton').click();
});
Yogiyo.el('whyButton').addEventListener('click', () => Yogiyo.toast('현재 고객 API에는 패키지 ID가 없습니다.'));
Yogiyo.bindSheet();
stopPolling = Yogiyo.poll(() => Yogiyo.apiClient.customers.get(orderId), renderCustomer, {
  intervalMs: 5000,
  onError: error => {
    setConnection(false);
    if (!currentOrder) showCustomerFailure(error);
    console.warn('customer polling failed', error);
  },
});
window.addEventListener('beforeunload', () => stopPolling?.(), { once: true });
