const storeId = Yogiyo.qs('storeId', Yogiyo.defaultIds.merchant);
const demoStoreIds = Object.freeze(['889', '894', '884']);
const demoCookTime = 20;
let storeDirectory;
let currentMerchant;

const setContentVisible = visible => { Yogiyo.el('merchantContent').hidden = !visible; };
const showMerchantFailure = (error, { action = false } = {}) => {
  setConnection(false);
  if (!currentMerchant) setContentVisible(false);
  Yogiyo.renderLoadState('merchantLoadState', {
    title: action ? '조리를 시작하지 못했습니다.' : error?.status === 404 ? '매장 주문을 찾을 수 없습니다.' : '매장 주문을 불러오지 못했습니다.',
    description: action ? Yogiyo.errorMessage(error, '조리 시작') : Yogiyo.errorMessage(error, '매장 주문'),
    onRetry: () => loadMerchant(),
  });
};

const statusLabels = Object.freeze({
  NEW: '신규 주문',
  COOKING: '조리 중',
  MATCHED: '배차 완료',
  PICKED_UP: '픽업 완료',
  DELIVERED: '배달 완료',
  COMPLETED: '배달 완료',
  CANCELLED: '취소됨',
});

const statusTones = Object.freeze({
  NEW: 'info',
  COOKING: 'warn',
  MATCHED: 'brand',
  PICKED_UP: 'warn',
  DELIVERED: 'good',
  COMPLETED: 'good',
  CANCELLED: 'neutral',
});

const hasOfferedPackage = order => order?.status === 'COOKING' && order?.package_id != null && order?.package_id !== '';
const merchantOrderStatus = order => {
  if (hasOfferedPackage(order)) return { label: '배차 제안됨 · 수락 대기', tone: 'warn' };
  if (order?.status === 'MATCHED') return { label: '라이더 수락 완료 · 배차 완료', tone: 'brand' };
  return { label: statusLabels[order?.status] || order?.status || '상태 정보 없음', tone: statusTones[order?.status] || 'neutral' };
};

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
  if (order.status === 'NEW') {
    return `<button class="primary-button full" data-cook-start="${order.order_id}" aria-label="주문 ${order.order_id} 조리 시작 및 조리시간 입력">조리 시작 · 조리시간 입력</button>`;
  }
  if (hasOfferedPackage(order)) {
    return '<button class="ghost-button full" disabled>배차 제안됨 · 라이더 수락 대기</button>';
  }
  if (order.status === 'COOKING') {
    return '<button class="ghost-button full" disabled>조리 중 · 배차 제안 생성 대기</button>';
  }
  if (order.status === 'MATCHED') {
    return '<button class="ghost-button full" disabled>라이더 수락 완료 · 배차 완료</button>';
  }
  if (order.status === 'CANCELLED') {
    return '<button class="ghost-button full" disabled>취소된 주문</button>';
  }
  return '<button class="ghost-button full" disabled>조리 시작 완료</button>';
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
  const offeredCount = orders.filter(hasOfferedPackage).length;
  const activeOrder = orders.find(order => order.rider_id) || orders.find(hasOfferedPackage) || orders[0];
  const route = activeOrder?.route_detail || [];
  const packageId = activeOrder?.package_id;
  const riderId = activeOrder?.rider_id;
  const offeredPackage = hasOfferedPackage(activeOrder);

  Yogiyo.el('merchantStoreName').textContent = store?.name || `매장 ${storeId}`;
  Yogiyo.el('merchantStoreMeta').textContent = [store?.category, store?.region].filter(Boolean).join(' · ') || `매장 ${storeId} · 주문 API 기준`;
  Yogiyo.el('newCount').textContent = counts.NEW || 0;
  Yogiyo.el('cookingCount').textContent = Math.max(0, (counts.COOKING || 0) - offeredCount);
  Yogiyo.el('offeredCount').textContent = offeredCount;
  Yogiyo.el('readyCount').textContent = counts.MATCHED || 0;
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
    const { label: status, tone: statusTone } = merchantOrderStatus(order);
    const predicted = order.predicted_cook_min != null && order.predicted_cook_min !== '' && Number.isFinite(Number(order.predicted_cook_min)) ? `시스템 예측 조리시간 ${order.predicted_cook_min}분` : '시스템 예측 조리시간 미제공';
    const ownerCookTime = order.owner_cook_min != null && order.owner_cook_min !== '' && Number.isFinite(Number(order.owner_cook_min)) ? `사장님 설정 조리시간 ${order.owner_cook_min}분` : '조리시간 미입력';
    const packageText = order.package_id ? `패키지 ${order.package_id}` : '아직 패키지 정보 없음';
    return `<article class="card order-card"><div class="row"><div><span class="badge ${statusTone}">${Yogiyo.escape(status)}</span><div class="order-menu">${Yogiyo.escape(menuSummary(order.menu_items))}</div><div class="order-id">주문 ${Yogiyo.escape(order.order_id)}</div></div><strong>${Yogiyo.money(order.amount || 0)}</strong></div><div class="notice info" style="margin-top:14px"><span>🍳</span><div><strong>${Yogiyo.escape(ownerCookTime)}</strong><span>${Yogiyo.escape(predicted)} · ${Yogiyo.escape(packageText)} · ${Yogiyo.escape(riderSummary(order))} · ${Yogiyo.escape(etaSummary(order))}</span></div></div><div style="margin-top:14px">${cookTimeControls(order)}</div></article>`;
  }).join('') || '<div class="card">이 매장에 조회 가능한 주문이 없습니다.</div>';

  Yogiyo.el('merchantOrders').querySelectorAll('[data-cook-start]').forEach(button => {
    button.addEventListener('click', event => {
      const orderId = event.currentTarget.dataset.cookStart;
      const value = window.prompt('예상 조리시간을 5분 단위로 입력해 주세요. (5~100분)', '20');
      if (value !== null) startCooking(orderId, Number(value), event.currentTarget);
    });
  });

  Yogiyo.el('riderAssignedBadge').textContent = riderId ? '라이더 수락 완료' : offeredPackage ? '라이더 수락 대기' : '배정 전';
  Yogiyo.el('assignedRiderId').textContent = riderId ? riderIdentity(activeOrder) : offeredPackage ? '라이더 제안 발송 완료' : riderIdentity(activeOrder);
  Yogiyo.el('packageStatus').textContent = packageId ? `${offeredPackage ? '제안 패키지' : '패키지'} ${packageId}` : '배차 전';
  Yogiyo.el('packageSize').textContent = packageId ? `${orders.filter(order => String(order.package_id) === String(packageId)).length}건` : '0건';
  Yogiyo.el('packageStrategy').textContent = routeSummary(route);
  Yogiyo.el('packageReason').textContent = riderId
    ? '라이더가 제안을 수락했습니다. 주문 API가 제공하는 패키지·라이더·방문 순서 정보입니다.'
    : offeredPackage
      ? '클러스터링이 패키지를 생성했습니다. 라이더 수락 뒤 배차 완료로 전환됩니다.'
    : counts.COOKING
      ? '조리 중 주문을 30초 단위로 클러스터링해 라이더에게 배차 제안을 생성합니다.'
      : '조리 시작 후 배차 제안이 생성되면 패키지와 라이더 정보가 표시됩니다.';
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

async function startCooking(orderId, cookMin, button) {
  if (!Number.isInteger(cookMin) || cookMin < 5 || cookMin > 100 || cookMin % 5 !== 0) {
    Yogiyo.toast('조리시간은 5~100분 사이의 5분 단위로 입력해 주세요.');
    return;
  }
  await Yogiyo.withPending(button, async () => {
    try {
      await Yogiyo.apiClient.merchants.updateCookTime(orderId, cookMin);
      Yogiyo.toast(`주문 ${orderId}의 조리를 시작했습니다. (${cookMin}분)`);
      await loadMerchant();
    } catch (error) {
      showMerchantFailure(error, { action: true });
      Yogiyo.toast(error.message);
    }
  });
}

async function startDemoOrders(button) {
  if (!window.confirm(`시연 매장 ${demoStoreIds.join('·')}의 신규 주문을 모두 ${demoCookTime}분 조리로 시작할까요?\n실제 API 모드에서는 DB 상태가 변경됩니다.`)) return;
  await Yogiyo.withPending(button, async () => {
    try {
      const views = await Promise.all(demoStoreIds.map(async demoStoreId => {
        try { return await Yogiyo.apiClient.merchants.get(demoStoreId); }
        catch (error) {
          if (error?.status === 404) return undefined;
          throw error;
        }
      }));
      const newOrders = views.flatMap(view => (view?.orders || []).filter(order => order.status === 'NEW'));
      if (!newOrders.length) {
        Yogiyo.toast('시연 매장에 조리 시작할 신규 주문이 없습니다.');
        return;
      }
      const results = await Promise.allSettled(newOrders.map(order => (
        Yogiyo.apiClient.merchants.updateCookTime(order.order_id, demoCookTime)
      )));
      const failedCount = results.filter(result => result.status === 'rejected').length;
      const startedCount = results.length - failedCount;
      Yogiyo.toast(failedCount
        ? `${startedCount}건 조리 시작 · ${failedCount}건 실패했습니다.`
        : `시연 주문 ${startedCount}건을 ${demoCookTime}분 조리로 시작했습니다.`);
      await loadMerchant();
    } catch (error) {
      showMerchantFailure(error, { action: true });
      Yogiyo.toast(error.message);
    }
  });
}

Yogiyo.el('demoBulkCookStartButton').addEventListener('click', event => startDemoOrders(event.currentTarget));

Yogiyo.poll(() => Yogiyo.apiClient.merchants.get(storeId), async view => {
  renderMerchant(view, await getStore(storeId));
  setConnection(true);
}, { intervalMs: 5000, onError: error => {
  setConnection(false);
  if (!currentMerchant) showMerchantFailure(error);
  console.warn('merchant polling failed', error);
} });
