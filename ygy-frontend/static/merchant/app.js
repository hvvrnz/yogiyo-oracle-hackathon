const initialStoreId = Yogiyo.qs('storeId', Yogiyo.defaultIds.merchant);
let storeId = initialStoreId;
let storeDirectory;
let currentMerchant;

const setContentVisible = visible => { Yogiyo.el('merchantContent').hidden = !visible; };
const showMerchantFailure = (error, { action = false } = {}) => {
  setConnection(false);
  if (!currentMerchant) setContentVisible(false);
  Yogiyo.renderLoadState('merchantLoadState', {
    title: action ? '조리시간을 변경하지 못했습니다.' : error?.status === 404 ? '매장 주문을 찾을 수 없습니다.' : '매장 주문을 불러오지 못했습니다.',
    description: action ? Yogiyo.errorMessage(error, '조리시간 변경') : Yogiyo.errorMessage(error, '매장 주문'),
    onRetry: () => loadMerchant(),
  });
};

const statusLabels = Object.freeze({
  NEW: '신규 주문',
  MATCHED: '배차 완료',
  PICKED_UP: '픽업 완료',
  DELIVERED: '배달 완료',
  COMPLETED: '배달 완료',
  CANCELLED: '취소됨',
});

const statusTones = Object.freeze({
  NEW: 'info',
  MATCHED: 'brand',
  PICKED_UP: 'warn',
  DELIVERED: 'good',
  COMPLETED: 'good',
  CANCELLED: 'neutral',
});

const setConnection = online => {
  const connection = Yogiyo.el('connection');
  connection.classList.toggle('online', online);
  connection.classList.toggle('offline', !online);
  connection.querySelector('span').textContent = online ? '실시간 조회 중' : '연결 확인 필요';
};

const menuSummary = items => {
  const menus = Array.isArray(items) ? items : [];
  if (!menus.length) return '메뉴 정보 없음';
  return menus.map(item => `${item.menu} ${item.qty ? `${item.qty}개` : ''}`.trim()).join(', ');
};

const riderIdentity = order => {
  if (!order?.rider_id) return '라이더 배정 정보 없음';
  const riderName = String(order.rider_name || '').trim();
  return riderName ? `${riderName} (${order.rider_id})` : String(order.rider_id);
};

const riderSummary = order => order?.rider_id ? `배정 라이더: ${riderIdentity(order)}` : '라이더 배정 정보 없음';

const etaSummary = order => {
  if (order?.eta_min == null || order.eta_min === '') return '도착 시간 정보 없음';
  const eta = Number(order?.eta_min);
  return Number.isFinite(eta) && eta >= 0 ? `도착 예상: 약 ${Math.ceil(eta)}분` : '도착 시간 정보 없음';
};

const routeSummary = route => {
  if (!Array.isArray(route) || !route.length) return '방문 순서 정보 없음';
  return route
    .slice()
    .sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0))
    .map(step => `주문 ${step.order_id ?? '-'} ${step.type === 'pickup' ? '픽업' : ['delivery', 'dropoff'].includes(step.type) ? '배달' : '경유'}`)
    .join(' → ');
};

const cookTimeControls = order => {
  const current = Number(order.owner_cook_min);
  if (!Number.isFinite(current)) return '<span class="value">조리시간 정보 없음</span>';
  const decreaseDisabled = current <= 5 ? ' disabled' : '';
  return `<div class="button-row three" aria-label="주문 ${order.order_id} 조리시간 수정"><button class="ghost-button" data-cook-time="${current - 5}" data-order="${order.order_id}"${decreaseDisabled}>-5분</button><button class="ghost-button" data-cook-time="${current + 5}" data-order="${order.order_id}">+5분</button><button class="primary-button" data-cook-edit="${order.order_id}" data-cook-current="${current}">직접 입력</button></div>`;
};

async function getStore(storeIdToFind) {
  if (!storeDirectory) {
    try {
      storeDirectory = (await Yogiyo.apiClient.stores.list()).stores;
    } catch {
      storeDirectory = [];
    }
  }
  return storeDirectory.find(store => String(store.store_id) === String(storeIdToFind));
}

function renderMerchant(view, store) {
  currentMerchant = view;
  const orders = Array.isArray(view.orders) ? view.orders : [];
  const counts = orders.reduce((result, order) => {
    result[order.status] = (result[order.status] || 0) + 1;
    return result;
  }, {});
  const activeOrder = orders.find(order => order.package_id || order.rider_id) || orders[0];
  const route = activeOrder?.route_detail || [];
  const packageId = activeOrder?.package_id;
  const riderId = activeOrder?.rider_id;

  Yogiyo.el('merchantStoreName').textContent = store?.name || `매장 ${storeId}`;
  Yogiyo.el('merchantStoreMeta').textContent = [store?.category, store?.region].filter(Boolean).join(' · ') || `매장 ${storeId} · 주문 API 기준`;
  Yogiyo.el('newCount').textContent = counts.NEW || 0;
  Yogiyo.el('cookingCount').textContent = counts.MATCHED || 0;
  Yogiyo.el('readyCount').textContent = counts.CANCELLED || 0;
  Yogiyo.el('orderCountLabel').textContent = `${orders.length}건`;

  if (orders.length) Yogiyo.clearLoadState('merchantLoadState');
  else Yogiyo.renderLoadState('merchantLoadState', {
    tone: 'empty',
    title: '조회 가능한 주문이 없습니다.',
    description: '이 매장에는 현재 표시할 주문이 없습니다. 다른 매장 ID를 입력하거나 다시 조회해 주세요.',
    onRetry: () => loadMerchant(),
  });
  setContentVisible(true);
  Yogiyo.el('merchantOrders').innerHTML = orders.map(order => {
    const status = statusLabels[order.status] || order.status || '상태 정보 없음';
    const statusTone = statusTones[order.status] || 'neutral';
    const predicted = Number.isFinite(Number(order.predicted_cook_min)) ? `시스템 예측 조리시간 ${order.predicted_cook_min}분` : '시스템 예측 조리시간 미제공';
    const packageText = order.package_id ? `패키지 ${order.package_id}` : '아직 패키지 정보 없음';
    return `<article class="card order-card"><div class="row"><div><span class="badge ${statusTone}">${Yogiyo.escape(status)}</span><div class="order-menu">${Yogiyo.escape(menuSummary(order.menu_items))}</div><div class="order-id">주문 ${Yogiyo.escape(order.order_id)}</div></div><strong>${Yogiyo.money(order.amount || 0)}</strong></div><div class="notice info" style="margin-top:14px"><span>🍳</span><div><strong>사장님 설정 조리시간 ${Yogiyo.escape(order.owner_cook_min ?? '-')}분</strong><span>${Yogiyo.escape(predicted)} · ${Yogiyo.escape(packageText)} · ${Yogiyo.escape(riderSummary(order))} · ${Yogiyo.escape(etaSummary(order))}</span></div></div><div style="margin-top:14px">${cookTimeControls(order)}</div></article>`;
  }).join('') || '<div class="card">이 매장에 조회 가능한 주문이 없습니다.</div>';

  Yogiyo.el('merchantOrders').querySelectorAll('[data-cook-time]').forEach(button => {
    button.addEventListener('click', event => updateCookTime(event.currentTarget.dataset.order, Number(event.currentTarget.dataset.cookTime), event.currentTarget));
  });
  Yogiyo.el('merchantOrders').querySelectorAll('[data-cook-edit]').forEach(button => {
    button.addEventListener('click', event => {
      const orderId = event.currentTarget.dataset.cookEdit;
      const current = Number(event.currentTarget.dataset.cookCurrent);
      const value = window.prompt('조리시간을 5분 단위로 입력해 주세요. (5~100분)', Number.isFinite(current) ? String(current) : '20');
      if (value !== null) updateCookTime(orderId, Number(value), event.currentTarget);
    });
  });

  Yogiyo.el('riderAssignedBadge').textContent = riderId ? '배정 완료' : '배정 전';
  Yogiyo.el('assignedRiderId').textContent = riderIdentity(activeOrder);
  Yogiyo.el('packageStatus').textContent = packageId ? `패키지 ${packageId}` : '배차 전';
  Yogiyo.el('packageSize').textContent = packageId ? `${orders.filter(order => String(order.package_id) === String(packageId)).length}건` : '0건';
  Yogiyo.el('packageStrategy').textContent = routeSummary(route);
  Yogiyo.el('packageReason').textContent = '주문 API가 제공하는 패키지·라이더·방문 순서 정보입니다.';
}

async function loadMerchant() {
  try {
    const [view, store] = await Promise.all([Yogiyo.apiClient.merchants.get(storeId), getStore(storeId)]);
    renderMerchant(view, store);
    setConnection(true);
  } catch (error) {
    showMerchantFailure(error);
    Yogiyo.toast(error.message);
  }
}

async function updateCookTime(orderId, nextCookMin, button) {
  if (!Number.isInteger(nextCookMin) || nextCookMin < 5 || nextCookMin > 100 || nextCookMin % 5 !== 0) {
    Yogiyo.toast('조리시간은 5~100분 사이의 5분 단위로 입력해 주세요.');
    return;
  }
  await Yogiyo.withPending(button, async () => {
    try {
      await Yogiyo.apiClient.merchants.updateCookTime(orderId, nextCookMin);
      Yogiyo.toast(`주문 ${orderId}의 조리시간을 ${nextCookMin}분으로 변경했습니다.`);
      await loadMerchant();
    } catch (error) {
      showMerchantFailure(error, { action: true });
      Yogiyo.toast(error.message);
    }
  });
}

function bindStoreLookup() {
  const storeInput = Yogiyo.el('storeIdInput');
  const dispatchButton = Yogiyo.el('merchantDispatchButton');
  storeInput.value = storeId;
  const reload = () => {
    const nextStoreId = storeInput.value.trim();
    if (!/^\d+$/.test(nextStoreId)) {
      Yogiyo.toast('숫자로 된 매장 ID를 입력해 주세요.');
      return;
    }
    storeId = nextStoreId;
    currentMerchant = undefined;
    storeDirectory = undefined;
    loadMerchant();
  };
  dispatchButton.addEventListener('click', reload);
  storeInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') reload();
  });
}

bindStoreLookup();
Yogiyo.poll(() => Yogiyo.apiClient.merchants.get(storeId), async view => {
  renderMerchant(view, await getStore(storeId));
  setConnection(true);
}, { intervalMs: 5000, onError: error => {
  setConnection(false);
  if (!currentMerchant) showMerchantFailure(error);
  console.warn('merchant polling failed', error);
} });
