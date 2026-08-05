let storeId = Yogiyo.qs('storeId', 'S-001');
let currentView = null;
let explanation = null;

async function loadMerchant(silent=false) {
  try {
    currentView = await Yogiyo.api(`/api/merchant/${storeId}`);
    renderMerchant(currentView);
    if (!silent) explanation = null;
  } catch (error) { Yogiyo.toast(error.message); }
}

function actionButtons(order) {
  if (order.status === 'NEW') return `<button class="primary-button full" data-action="accept" data-order="${order.order_id}">주문 수락</button>`;
  if (order.status === 'ACCEPTED') return `<button class="primary-button full" data-action="start" data-order="${order.order_id}">조리 시작</button>`;
  if (['COOKING','DELAYED'].includes(order.status)) return `<div class="button-row three"><button class="ghost-button" data-action="delay" data-delay="5" data-order="${order.order_id}">+5분</button><button class="ghost-button" data-action="delay" data-delay="10" data-order="${order.order_id}">+10분</button><button class="primary-button" data-action="ready" data-order="${order.order_id}">조리 완료</button></div>`;
  if (order.status === 'READY') return `<button class="secondary-button full" disabled>라이더 픽업 대기 중</button>`;
  if (order.status === 'PICKED_UP') return `<button class="ghost-button full" disabled>픽업 완료</button>`;
  if (order.status === 'DELIVERED') return `<button class="ghost-button full" disabled>배달 완료</button>`;
  return '';
}

function renderOrders(orders) {
  const root = Yogiyo.el('merchantOrders');
  root.innerHTML = orders.map(order => {
    const cardClass = order.status === 'READY' ? 'ready' : order.status === 'DELAYED' ? 'delayed' : '';
    const statusClass = order.status === 'READY' ? 'good' : order.status === 'DELAYED' ? 'warn' : 'brand';
    return `<article class="card order-card ${cardClass}">
      <div class="row"><div><span class="badge ${statusClass}">${Yogiyo.escape(order.status_label)}</span><div class="order-menu">${Yogiyo.escape(order.menu_summary)}</div><div class="order-id">${order.order_id} · 접수 ${Yogiyo.fmtTime(order.created_at)}</div></div><strong>${Yogiyo.money(order.amount)}</strong></div>
      <div class="notice ${order.status === 'DELAYED' ? 'warn' : 'info'}" style="margin-top:14px"><span>⏱️</span><div><strong>${Yogiyo.escape(order.start_recommendation)}</strong><span>조리 완료 목표 ${order.target_ready_label} · 예측 신뢰도 ${order.prediction_confidence_pct}%</span></div></div>
      <div style="margin-top:14px"><div class="row"><span class="label">AI 예상 조리시간</span><span class="value">${order.predicted_cooking_min}분</span></div><div class="row"><span class="label">라이더 예상 대기</span><span class="value">약 ${order.expected_rider_wait_min}분</span></div><div class="row"><span class="label">배달 요청</span><span class="value">${Yogiyo.escape(order.request_note)}</span></div></div>
      <div style="margin-top:14px">${actionButtons(order)}</div>
    </article>`;
  }).join('');
  root.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', handleOrderAction));
}

function renderMerchant(view) {
  const {store, summary, orders, rider, package: pkg, weather} = view;
  Yogiyo.el('merchantStoreName').textContent = store.name;
  Yogiyo.el('merchantStoreMeta').textContent = `${store.category} · 예측 정확도 ${store.prediction_accuracy_pct}%`;
  Yogiyo.el('congestion').textContent = `현재 혼잡도 ${store.congestion} · 기본 조리 ${store.base_cooking_min}분`;
  Yogiyo.el('newCount').textContent = summary.new_count;
  Yogiyo.el('cookingCount').textContent = summary.cooking_count;
  Yogiyo.el('readyCount').textContent = summary.ready_count;
  Yogiyo.el('orderCountLabel').textContent = `${orders.length}건`;
  renderOrders(orders);
  Yogiyo.el('riderAssignedBadge').textContent = rider.assigned ? '배정 완료' : '배정 전';
  Yogiyo.el('riderAssignedBadge').className = `badge ${rider.assigned ? 'good' : 'neutral'}`;
  Yogiyo.el('riderArrival').textContent = rider.arrival_label;
  Yogiyo.el('riderRemaining').textContent = rider.remaining_min == null ? '-' : `약 ${rider.remaining_min}분`;
  Yogiyo.el('riderDistance').textContent = rider.distance_km == null ? '-' : `${rider.distance_km}km`;
  Yogiyo.el('riderContext').textContent = rider.context;
  Yogiyo.el('packageStatus').textContent = pkg.status_label;
  Yogiyo.el('packageSize').textContent = `${pkg.bundle_size}건`;
  Yogiyo.el('packageStrategy').textContent = pkg.route_strategy_label;
  Yogiyo.el('packageGap').textContent = `${pkg.ready_gap_min}분`;
  Yogiyo.el('packageWait').textContent = `${pkg.total_wait_min}분`;
  Yogiyo.el('packageReason').textContent = pkg.selected_route_reason;
  Yogiyo.el('merchantRouteChange').hidden = !(pkg.route_changed || pkg.offer_attempt > 1);
  Yogiyo.el('merchantRouteNote').textContent = pkg.route_change_note || pkg.reassignment_note || '';
  Yogiyo.el('merchantWeatherIcon').textContent = weather.condition === 'RAIN' ? '🌧️' : '☀️';
  Yogiyo.el('merchantWeatherTitle').textContent = `${weather.label} · ${weather.temperature_c}℃`;
  Yogiyo.el('merchantWeatherAdvisory').textContent = weather.advisory;
  document.querySelectorAll('#storeSelector button').forEach(button => button.classList.toggle('active', button.dataset.store === storeId));
}

async function handleOrderAction(event) {
  const button = event.currentTarget;
  const body = {action: button.dataset.action, delay_min: Number(button.dataset.delay || 0)};
  button.disabled = true;
  try {
    const result = await Yogiyo.api(`/api/merchant/orders/${button.dataset.order}/action`, {method:'POST', body:JSON.stringify(body)});
    Yogiyo.toast(result.message);
    await loadMerchant(true);
  } catch (error) { Yogiyo.toast(error.message); }
  finally { button.disabled = false; }
}

async function showExplanation() {
  Yogiyo.openSheet();
  Yogiyo.el('sheetReasons').innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  try { explanation = await Yogiyo.api(`/api/explanations/merchant/${storeId}`); }
  catch (error) { Yogiyo.toast(error.message); return; }
  Yogiyo.el('sheetHeadline').textContent = explanation.headline;
  Yogiyo.el('sheetSummary').textContent = explanation.summary;
  const icons = ['🍳','🛵','🔗'];
  Yogiyo.el('sheetReasons').innerHTML = explanation.reasons.map((reason,index) => `<div class="reason-item"><div class="reason-icon">${icons[index]}</div><div class="reason-copy"><h3>${Yogiyo.escape(reason.title)}</h3><p>${Yogiyo.escape(reason.description)}</p></div><div class="reason-metric">${Yogiyo.escape(reason.metric)}</div></div>`).join('');
  Yogiyo.el('sheetNote').textContent = explanation.note;
}

document.querySelectorAll('#storeSelector button').forEach(button => button.addEventListener('click', () => {storeId = button.dataset.store; history.replaceState(null,'',`?storeId=${storeId}`); explanation=null; loadMerchant();}));
Yogiyo.el('merchantWhyButton').addEventListener('click', showExplanation);
Yogiyo.el('sheetClose').addEventListener('click', Yogiyo.closeSheet);
Yogiyo.el('sheetBackdrop').addEventListener('click', Yogiyo.closeSheet);
Yogiyo.websocket('merchant', storeId, () => loadMerchant(true));
loadMerchant();
