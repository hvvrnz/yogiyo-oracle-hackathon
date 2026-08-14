const initialStoreId = Yogiyo.qs('storeId', Yogiyo.defaultIds.merchant);
let storeId = initialStoreId;
let storeDirectory;

const statusLabels = Object.freeze({
  NEW: '신규 주문',
  MATCHED: '배차 완료',
  CANCELLED: '취소됨',
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

const routeSummary = route => {
  if (!Array.isArray(route) || !route.length) return '방문 순서 정보 없음';
  return route
    .slice()
    .sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0))
    .map(step => `주문 ${step.order_id ?? '-'} ${step.type === 'pickup' ? '픽업' : step.type === 'delivery' ? '배달' : '경유'}`)
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
  Yogiyo.el('merchantStoreMeta').textContent = [store?.category, store?.region].filter(Boolean).join(' · ') || '매장 기본 정보는 주문 API에 포함되지 않습니다.';
  Yogiyo.el('congestion').textContent = '매장 혼잡도는 현재 API에서 제공하지 않습니다.';
  Yogiyo.el('newCount').textContent = counts.NEW || 0;
  Yogiyo.el('cookingCount').textContent = counts.MATCHED || 0;
  Yogiyo.el('readyCount').textContent = counts.CANCELLED || 0;
  Yogiyo.el('orderCountLabel').textContent = `${orders.length}건`;

  Yogiyo.el('merchantOrders').innerHTML = orders.map(order => {
    const status = statusLabels[order.status] || order.status || '상태 정보 없음';
    const predicted = Number.isFinite(Number(order.predicted_cook_min)) ? `시스템 예측 조리시간 ${order.predicted_cook_min}분` : '시스템 예측 조리시간 미제공';
    const packageText = order.package_id ? `패키지 ${order.package_id}` : '아직 패키지 정보 없음';
    const riderText = order.rider_id ? `배정 라이더 ${order.rider_id}` : '라이더 배정 정보 없음';
    return `<article class="card order-card"><div class="row"><div><span class="badge brand">${Yogiyo.escape(status)}</span><div class="order-menu">${Yogiyo.escape(menuSummary(order.menu_items))}</div><div class="order-id">주문 ${Yogiyo.escape(order.order_id)}</div></div><strong>${Yogiyo.money(order.amount || 0)}</strong></div><div class="notice info" style="margin-top:14px"><span>🍳</span><div><strong>사장님 설정 조리시간 ${Yogiyo.escape(order.owner_cook_min ?? '-')}분</strong><span>${Yogiyo.escape(predicted)} · ${Yogiyo.escape(packageText)} · ${Yogiyo.escape(riderText)}</span></div></div><div style="margin-top:14px">${cookTimeControls(order)}</div></article>`;
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
  Yogiyo.el('riderArrival').textContent = 'API 미제공';
  Yogiyo.el('riderRemaining').textContent = 'API 미제공';
  Yogiyo.el('riderDistance').textContent = 'API 미제공';
  Yogiyo.el('riderContext').textContent = riderId ? `배정 라이더: ${riderId}. 위치·도착 ETA는 현재 사장님 API에 없습니다.` : '라이더 배정 정보를 확인하고 있습니다.';

  Yogiyo.el('packageStatus').textContent = packageId ? `패키지 ${packageId}` : '배차 전';
  Yogiyo.el('packageSize').textContent = packageId ? `${orders.filter(order => String(order.package_id) === String(packageId)).length}건` : '0건';
  Yogiyo.el('packageStrategy').textContent = routeSummary(route);
  Yogiyo.el('packageGap').textContent = Number.isFinite(Number(activeOrder?.predicted_cook_min)) ? `${activeOrder.predicted_cook_min}분` : 'API 미제공';
  Yogiyo.el('packageWait').textContent = 'API 미제공';
  Yogiyo.el('packageReason').textContent = '방문 순서와 패키지 ID는 주문 조회 응답의 배차 정보를 사용합니다.';
  Yogiyo.el('merchantRouteChange').hidden = true;
  Yogiyo.el('merchantWeatherIcon').textContent = 'ⓘ';
  Yogiyo.el('merchantWeatherTitle').textContent = '데이터 제공 범위';
  Yogiyo.el('merchantWeatherAdvisory').textContent = '날씨·라이더 도착 ETA는 현재 사장님 API에서 제공하지 않습니다.';
}

async function loadMerchant() {
  try {
    const [view, store] = await Promise.all([Yogiyo.apiClient.merchants.get(storeId), getStore(storeId)]);
    renderMerchant(view, store);
    setConnection(true);
  } catch (error) {
    setConnection(false);
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
      Yogiyo.toast(error.message);
    }
  });
}

function bindStoreLookup() {
  const dispatchButton = Yogiyo.el('merchantDispatchButton');
  dispatchButton.textContent = '매장 다시 조회';
  dispatchButton.addEventListener('click', loadMerchant);

  const storeInput = document.createElement('input');
  storeInput.className = 'text-input';
  storeInput.inputMode = 'numeric';
  storeInput.value = storeId;
  storeInput.setAttribute('aria-label', '매장 ID');
  storeInput.style.cssText = 'width:100%;margin-bottom:10px';
  dispatchButton.parentElement.prepend(storeInput);
  storeInput.addEventListener('change', () => {
    const nextStoreId = storeInput.value.trim();
    if (!nextStoreId) return;
    storeId = nextStoreId;
    storeDirectory = undefined;
    loadMerchant();
  });
}

bindStoreLookup();
Yogiyo.poll(() => Yogiyo.apiClient.merchants.get(storeId), async view => {
  renderMerchant(view, await getStore(storeId));
  setConnection(true);
}, { intervalMs: 5000, onError: error => { setConnection(false); Yogiyo.toast(error.message); } });
