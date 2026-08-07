const customerId = Yogiyo.qs('customerId', Yogiyo.defaultIds.customer);
let currentView = null;
let explanation = null;

async function loadCustomer(silent=false) {
  try {
    currentView = await Yogiyo.apiClient.customer.get(customerId);
    renderCustomer(currentView);
    if (!silent && explanation) explanation = null;
  } catch (error) {
    Yogiyo.toast(error.message);
  }
}

function renderCustomer(view) {
  const {order, store, package: pkg, rider, weather, route} = view;
  Yogiyo.el('orderId').textContent = `${order.order_id} · ${store.name}`;
  Yogiyo.el('etaWindow').textContent = order.eta_window;
  Yogiyo.el('currentMessage').textContent = order.current_message;
  Yogiyo.el('deliveryOrder').textContent = `내 배달 순서 ${order.delivery_sequence}번째`;
  Yogiyo.el('etaUpdated').textContent = order.eta_updated_label;
  Yogiyo.el('statusBadge').innerHTML = `<span class="dot"></span>${Yogiyo.escape(order.status_label)}`;
  Yogiyo.el('storeName').textContent = store.name;
  Yogiyo.el('menuSummary').textContent = order.menu_summary;
  Yogiyo.el('remainingMin').textContent = order.status === 'DELIVERED' ? '완료' : `약 ${order.remaining_min}분`;
  [...Yogiyo.el('progressTrack').children].forEach((node, index) => node.classList.toggle('active', index <= order.progress_index));
  Yogiyo.el('readyGap').textContent = `${pkg.ready_gap_min}분`;
  Yogiyo.el('routeOverlap').textContent = `${pkg.route_overlap_pct}%`;
  Yogiyo.el('bagTime').textContent = `${order.bag_time_min}분`;
  Yogiyo.el('bagLimit').textContent = `제한 ${order.bag_time_limit_min}분`;
  Yogiyo.el('routeStrategyLabel').textContent = `현재 방식 · ${pkg.route_strategy_label}`;
  Yogiyo.el('routeStrategyDescription').textContent = pkg.route_strategy_description;
  Yogiyo.el('riderStep').textContent = rider.current_step_label;
  Yogiyo.el('qualityBag').textContent = `${order.bag_time_min}분`;
  Yogiyo.el('qualityLimit').textContent = `${order.bag_time_limit_min}분`;
  Yogiyo.el('qualityMargin').textContent = `${order.quality_margin_min}분`;
  Yogiyo.el('qualityBadge').textContent = order.quality_guard_passed ? '기준 통과' : '재배차 필요';
  Yogiyo.el('qualityBadge').className = `badge ${order.quality_guard_passed ? 'good' : 'warn'}`;
  Yogiyo.el('routeChangeSection').hidden = !(pkg.route_changed || pkg.offer_attempt > 1);
  Yogiyo.el('routeChangeNote').textContent = pkg.route_change_note || pkg.reassignment_note || '';
  Yogiyo.el('weatherIcon').textContent = weather.condition === 'RAIN' ? '🌧️' : '☀️';
  Yogiyo.el('weatherTitle').textContent = `${weather.label} · ${weather.temperature_c}℃`;
  Yogiyo.el('weatherAdvisory').textContent = weather.advisory;
  Yogiyo.el('temperature').textContent = `${weather.temperature_c}°`;
  Yogiyo.el('amount').textContent = Yogiyo.money(order.amount);
  Yogiyo.el('itemsCard').innerHTML = order.items.map(item => `<div class="row"><span class="label">${Yogiyo.escape(item.name)}</span><span class="value">${item.quantity}개</span></div>`).join('') + `<div class="row"><span class="label">배달 요청</span><span class="value">${Yogiyo.escape(order.request_note)}</span></div>`;
  Yogiyo.renderRouteMap('customerMap', route, rider.assigned ? rider : null);
  const button = Yogiyo.el('createOrderButton');
  button.disabled = !['DELIVERED'].includes(order.status) && order.status !== 'NEW';
  button.textContent = button.disabled ? '진행 중인 주문이 있습니다' : '치킨 주문하기';
}

async function createOrder() {
  try {
    const result = await Yogiyo.apiClient.orders.create({customer_id:customerId, store_id:'S-001', items:[{name:'반반치킨',quantity:1}]});
    Yogiyo.toast(result.message); await loadCustomer(true);
  } catch (error) { Yogiyo.toast(error.message); }
}

async function showExplanation() {
  Yogiyo.openSheet();
  Yogiyo.el('sheetHeadline').textContent = '추천 사유를 준비하고 있어요';
  Yogiyo.el('sheetSummary').textContent = '';
  Yogiyo.el('sheetReasons').innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  if (!explanation) {
    try { explanation = await Yogiyo.apiClient.explanation('customer', customerId); }
    catch (error) { Yogiyo.toast(error.message); return; }
  }
  Yogiyo.el('sheetHeadline').textContent = explanation.headline;
  Yogiyo.el('sheetSummary').textContent = explanation.summary;
  const icons = ['⏱️','🛣️','🌡️'];
  Yogiyo.el('sheetReasons').innerHTML = explanation.reasons.map((reason,index) => `<div class="reason-item"><div class="reason-icon">${icons[index] || '✓'}</div><div class="reason-copy"><h3>${Yogiyo.escape(reason.title)}</h3><p>${Yogiyo.escape(reason.description)}</p></div><div class="reason-metric">${Yogiyo.escape(reason.metric)}</div></div>`).join('');
  Yogiyo.el('sheetNote').textContent = `${explanation.note} · ${explanation.source === 'oci' ? 'OCI GenAI' : '규칙 기반 fallback'}`;
}

Yogiyo.el('whyButton').addEventListener('click', showExplanation);
Yogiyo.el('createOrderButton').addEventListener('click', createOrder);
Yogiyo.el('sheetClose').addEventListener('click', Yogiyo.closeSheet);
Yogiyo.el('sheetBackdrop').addEventListener('click', Yogiyo.closeSheet);
Yogiyo.websocket('customer', customerId, () => loadCustomer(true));
loadCustomer();
