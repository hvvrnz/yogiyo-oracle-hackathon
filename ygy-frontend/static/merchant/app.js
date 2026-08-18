const storeId = Yogiyo.qs('storeId', Yogiyo.defaultIds.merchant);
let currentMerchant;
let selectedOrderId;
let activeTab = 'processing';
let storeDirectory;

const completedStatuses = new Set(['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED']);
const statusLabels = Object.freeze({ NEW: '신규 주문', COOKING: '조리 중', MATCHED: '배차 완료', PICKED_UP: '픽업 완료', COMPLETED: '조리 완료', DELIVERED: '배달 완료' });
const statusTone = status => status === 'NEW' ? 'info' : completedStatuses.has(status) ? 'good' : status === 'COOKING' ? 'warn' : 'brand';
const setConnection = online => { const node = Yogiyo.el('connection'); node.classList.toggle('online', online); node.classList.toggle('offline', !online); node.querySelector('span').textContent = online ? '영업중' : '연결 확인 필요'; };
const menuSummary = items => (Array.isArray(items) ? items : []).map(item => `${item.menu}${item.qty > 1 ? ` ${item.qty}개` : ''}`).join(' · ') || '메뉴 정보 없음';
const routeSummary = route => (Array.isArray(route) ? route : []).slice().sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0)).map(step => `#${step.order_id} ${step.type === 'pickup' ? '픽업' : '배달'}`).join(' → ') || '배차 전';

async function getStore() {
  if (storeDirectory) return storeDirectory.find(store => String(store.store_id) === String(storeId));
  try { storeDirectory = (await Yogiyo.apiClient.demo.stores()).stores; } catch { storeDirectory = []; }
  return storeDirectory.find(store => String(store.store_id) === String(storeId));
}

function showFailure(error) {
  setConnection(false);
  Yogiyo.renderLoadState('merchantLoadState', { title: '주문 정보를 불러오지 못했습니다.', description: Yogiyo.errorMessage(error, '매장 주문'), onRetry: loadMerchant });
}

function orderListCard(order) {
  const selected = String(order.order_id) === String(selectedOrderId);
  return `<button type="button" class="merchant-order-item${selected ? ' selected' : ''}" data-order-select="${order.order_id}"><span class="badge ${statusTone(order.status)}">${Yogiyo.escape(statusLabels[order.status] || order.status)}</span><strong>${Yogiyo.escape(menuSummary(order.menu_items))}</strong><span>주문 #${Yogiyo.escape(order.order_id)} · ${Yogiyo.money(order.amount)}</span></button>`;
}

function renderDetail(order) {
  const root = Yogiyo.el('merchantOrderDetail');
  if (!order) {
    root.innerHTML = '<div class="state-card empty"><div class="state-icon">⌕</div><div><strong>주문을 선택해 주세요.</strong><p>좌측 주문 목록에서 상세 정보를 확인할 주문을 선택하세요.</p></div></div>';
    return;
  }
  const isNew = order.status === 'NEW';
  const isCompleted = completedStatuses.has(order.status);
  const items = Array.isArray(order.menu_items) ? order.menu_items : [];
  const actionButtons = isNew
  ? `<div class="merchant-decision-actions">
      <button
        class="primary-button"
        type="button"
        data-order-accept="${order.order_id}">
        수락하고 조리 시작
      </button>
    </div>`
  : '';
  const finishButton = !isNew && !isCompleted
    ? `<button class="primary-button full merchant-complete-button" type="button" data-order-complete="${order.order_id}">조리 완료</button>`
    : isCompleted ? '<button class="ghost-button full" disabled>처리 완료된 주문입니다</button>' : '';
  root.innerHTML = `<div class="merchant-detail-head"><div><span class="badge ${statusTone(order.status)}">${Yogiyo.escape(statusLabels[order.status] || order.status)}</span><h2>주문 #${Yogiyo.escape(order.order_id)}</h2><p>${Yogiyo.escape(order.store_name || '매장 주문')}</p></div><strong>${Yogiyo.money(order.amount)}</strong></div>${actionButtons}<div class="merchant-detail-scroll"><section class="card"><div class="section-title-row"><h2>배달지</h2></div><p class="merchant-address">${Yogiyo.escape(order.delivery_address || '배달지 주소 정보 없음')}</p></section><section class="card"><div class="section-title-row"><h2>주문 내역</h2><span>총 ${Yogiyo.money(order.amount)}</span></div>${items.map(item => `<div class="row"><span class="label">${Yogiyo.escape(item.menu)}</span><span class="value">${item.qty}개 · ${Yogiyo.money(item.price)}</span></div>`).join('') || '<p class="subtext">메뉴 정보가 없습니다.</p>'}</section><section class="card"><div class="section-title-row"><h2>조리·배차 정보</h2></div><div class="row"><span class="label">예상 조리시간</span><span class="value">${order.owner_cook_min ? `${order.owner_cook_min}분` : '수락 후 입력'}</span></div><div class="row"><span class="label">AI 예측 조리시간</span><span class="value">${order.predicted_cook_min ? `${order.predicted_cook_min}분` : '정보 없음'}</span></div><div class="route-strategy-box"><strong>방문 순서</strong><span>${Yogiyo.escape(routeSummary(order.route_detail))}</span></div></section>${order.merchant_text ? `<section class="notice llm-guidance"><span>✦</span><div><strong>AI 조리 안내</strong><span>${Yogiyo.escape(order.merchant_text)}</span></div></section>` : ''}</div><div class="merchant-detail-footer">${finishButton}</div>`;
  root.querySelector('[data-order-accept]')?.addEventListener('click', event => acceptOrder(Number(event.currentTarget.dataset.orderAccept), event.currentTarget));
  root.querySelector('[data-order-complete]')?.addEventListener('click', event => completeOrder(Number(event.currentTarget.dataset.orderComplete), event.currentTarget));
}

function renderMerchant(view, store) {
  currentMerchant = view;
  const orders = Array.isArray(view.orders) ? view.orders : [];
  const processing = orders.filter(order => !completedStatuses.has(order.status));
  const completed = orders.filter(order => completedStatuses.has(order.status));
  const newOrders = processing.filter(order => order.status === 'NEW');
  const progressOrders = processing.filter(order => order.status !== 'NEW');
  const visibleOrders = activeTab === 'processing' ? processing : completed;
  if (!visibleOrders.some(order => String(order.order_id) === String(selectedOrderId))) selectedOrderId = visibleOrders[0]?.order_id;
  Yogiyo.el('merchantStoreName').textContent = store?.name || `매장 ${storeId}`;
  Yogiyo.el('merchantStoreMeta').textContent = [store?.category, store?.region].filter(Boolean).join(' · ') || '주문 처리 현황';
  Yogiyo.el('processingCount').textContent = processing.length;
  Yogiyo.el('completedCount').textContent = completed.length;
  Yogiyo.el('newOrderCount').textContent = `${newOrders.length}건`;
  Yogiyo.el('progressOrderCount').textContent = `${progressOrders.length}건`;
  Yogiyo.el('completedOrderListCount').textContent = `${completed.length}건`;
  Yogiyo.el('newOrderList').innerHTML = newOrders.map(orderListCard).join('') || '<p class="merchant-empty-copy">신규 주문이 없습니다.</p>';
  Yogiyo.el('progressOrderList').innerHTML = progressOrders.map(orderListCard).join('') || '<p class="merchant-empty-copy">진행 중인 주문이 없습니다.</p>';
  Yogiyo.el('completedOrderList').innerHTML = completed.map(orderListCard).join('') || '<p class="merchant-empty-copy">완료 주문이 없습니다.</p>';
  Yogiyo.el('merchantProcessingList').hidden = activeTab !== 'processing';
  Yogiyo.el('merchantCompletedList').hidden = activeTab !== 'completed';
  document.querySelectorAll('[data-order-select]').forEach(button => button.addEventListener('click', () => { selectedOrderId = Number(button.dataset.orderSelect); renderMerchant(currentMerchant, store); }));
  renderDetail(orders.find(order => String(order.order_id) === String(selectedOrderId)));
  Yogiyo.clearLoadState('merchantLoadState');
}

async function loadMerchant() {
  try { const [view, store] = await Promise.all([Yogiyo.apiClient.demo.merchantOrders(), getStore()]); renderMerchant(view, store); setConnection(true); }
  catch (error) { showFailure(error); Yogiyo.toast(error.message); }
}

async function acceptOrder(orderId, button) {
  const value = window.prompt('예상 조리시간을 5분 단위로 입력해 주세요. (5~100분)', '20');
  if (value === null) return;
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 100 || minutes % 5 !== 0) { Yogiyo.toast('조리시간은 5~100분 사이의 5분 단위로 입력해 주세요.'); return; }
  await Yogiyo.withPending(button, async () => { try { await Yogiyo.apiClient.demo.merchantCookStart(minutes); Yogiyo.toast(`주문 #${orderId}을 수락하고 조리를 시작했습니다.`); await loadMerchant(); } catch (error) { Yogiyo.toast(error.message); } });
}

async function rejectOrder(orderId, button) {
  await Yogiyo.withPending(button, async () => { try { await Yogiyo.apiClient.demo.rejectMerchantOrder(orderId); selectedOrderId = undefined; Yogiyo.toast(`주문 #${orderId}을 거절했습니다.`); await loadMerchant(); } catch (error) { Yogiyo.toast(error.message); } });
}

async function completeOrder(orderId, button) {
  await Yogiyo.withPending(button, async () => { try { await Yogiyo.apiClient.demo.completeMerchantOrder(orderId); activeTab = 'completed'; selectedOrderId = orderId; Yogiyo.toast(`주문 #${orderId} 조리가 완료되었습니다.`); await loadMerchant(); } catch (error) { Yogiyo.toast(error.message); } });
}

document.querySelectorAll('[data-merchant-tab]').forEach(button => button.addEventListener('click', () => { activeTab = button.dataset.merchantTab; document.querySelectorAll('[data-merchant-tab]').forEach(tab => { const active = tab === button; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); }); if (currentMerchant) getStore().then(store => renderMerchant(currentMerchant, store)); }));
Yogiyo.poll(() => Yogiyo.apiClient.demo.merchantOrders(), async view => { renderMerchant(view, await getStore()); setConnection(true); }, { intervalMs: 5000, onError: showFailure });
