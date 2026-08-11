const customerId = Yogiyo.qs('customerId', Yogiyo.defaultIds.customer);
const storeForCustomer = {'C-001':'S-001','C-002':'S-002','C-003':'S-003'};
let currentView;
let previousRouteSignature;

async function loadCustomer() {
  try { currentView = await Yogiyo.apiClient.customer.get(customerId); renderCustomer(currentView); }
  catch (error) { Yogiyo.toast(error.message); }
}

function renderCustomer(view) {
  const {order, store, package: pkg, rider, weather, route} = view;
  Yogiyo.el('orderId').textContent = `${order.order_id} · ${store?.name || '주문 생성 대기'}`;
  Yogiyo.el('etaWindow').textContent = order.eta_window;
  Yogiyo.el('currentMessage').textContent = order.current_message;
  Yogiyo.el('deliveryOrder').textContent = `내 배달 순서 ${order.delivery_sequence}번째`;
  Yogiyo.el('etaUpdated').textContent = order.eta_updated_label;
  Yogiyo.el('statusBadge').innerHTML = `<span class="dot"></span>${Yogiyo.escape(order.status_label)}`;
  Yogiyo.el('storeName').textContent = store?.name || '매장을 선택해 주문하세요';
  Yogiyo.el('menuSummary').textContent = order.menu_summary;
  Yogiyo.el('remainingMin').textContent = order.status === 'DELIVERED' ? '완료' : `약 ${order.remaining_min}분`;
  [...Yogiyo.el('progressTrack').children].forEach((node, index) => node.classList.toggle('active', index <= order.progress_index));
  Yogiyo.el('deliveryPreference').textContent = `고객 선택 · ${order.delivery_preference_label}`;
  Yogiyo.el('resolvedDelivery').textContent = order.resolved_delivery_label ? `실제 배차 · ${order.resolved_delivery_label}` : '실제 배차 · AI 배차 계산 대기';
  Yogiyo.el('assignedRider').textContent = rider.assigned ? `배정 라이더 · ${rider.display_name}` : '배정 라이더 · 탐색 중';
  Yogiyo.el('readyGap').textContent = `${pkg.ready_gap_min || 0}분`;
  Yogiyo.el('routeOverlap').textContent = String(pkg.delivery_type || '').startsWith('AI_BUNDLE_') ? `${pkg.route_saving_pct || 0}%` : '-';
  Yogiyo.el('bagTime').textContent = `${order.bag_time_min}분`; Yogiyo.el('bagLimit').textContent = `제한 ${order.bag_time_limit_min}분`;
  Yogiyo.el('routeStrategyLabel').textContent = `현재 방식 · ${pkg.route_strategy_label}`;
  Yogiyo.el('routeStrategyDescription').textContent = pkg.route_strategy_description;
  Yogiyo.el('riderStep').textContent = rider.current_step_label;
  Yogiyo.el('qualityBag').textContent = `${order.bag_time_min}분`; Yogiyo.el('qualityLimit').textContent = `${order.bag_time_limit_min}분`; Yogiyo.el('qualityMargin').textContent = `${order.quality_margin_min}분`;
  const qualityPassed = Boolean(order.quality_guard_passed);
  const qualityBadge=Yogiyo.el('qualityBadge'); qualityBadge.textContent=qualityPassed?'기준 통과':'품질 주의'; qualityBadge.className=`badge ${qualityPassed?'good':'warn'}`;
  const qualityNotice=Yogiyo.el('qualityNotice'); qualityNotice.className=`notice ${qualityPassed?'good':'warn'}`;
  Yogiyo.el('qualityNoticeIcon').textContent=qualityPassed?'✓':'!';
  Yogiyo.el('qualityNoticeTitle').textContent=qualityPassed?'품질 가드레일을 통과했어요':'품질 기준을 다시 확인해 주세요';
  Yogiyo.el('qualityNoticeDescription').textContent=qualityPassed
    ? '현재 경로의 예상 가방 체류시간이 음식별 제한 안에 있습니다.'
    : `예상 가방 체류시간이 제한을 ${Math.abs(Math.min(0, order.quality_margin_min))}분 넘습니다. 경로 조정 또는 개별 배달을 검토해야 합니다.`;
  const routeSignature=`${pkg.package_id||'none'}:${pkg.route_strategy_label||'-'}:${route.map(step=>`${step.order_id}-${step.type}-${step.sequence}`).join('|')}`;
  const routeChanged=Boolean(previousRouteSignature&&previousRouteSignature!==routeSignature); Yogiyo.el('routeChangeSection').hidden=!routeChanged; Yogiyo.el('routeChangeNote').textContent=routeChanged?`${pkg.route_strategy_label} 기준으로 ETA와 배달 순서를 다시 계산했습니다.`:''; previousRouteSignature=routeSignature;
  Yogiyo.el('weatherIcon').textContent = weather.condition === 'RAIN' ? '🌧️' : '☀️'; Yogiyo.el('weatherTitle').textContent = `${weather.label} · ${weather.temperature_c}℃`; Yogiyo.el('weatherAdvisory').textContent = weather.advisory; Yogiyo.el('temperature').textContent = `${weather.temperature_c}°`;
  Yogiyo.el('amount').textContent = Yogiyo.money(order.amount); Yogiyo.el('itemsCard').innerHTML = order.items.map(item => `<div class="row"><span class="label">${Yogiyo.escape(item.name)}</span><span class="value">${item.quantity}개</span></div>`).join('') || '<div class="subtext">주문 생성 후 메뉴가 표시됩니다.</div>';
  Yogiyo.renderRouteMap('customerMap', route, rider.assigned ? rider : null);
  const hasActive = order.order_id !== '새 주문 없음' && order.status !== 'DELIVERED'; Yogiyo.el('createOrderButton').disabled = hasActive; Yogiyo.el('createOrderButton').textContent = hasActive ? '진행 중인 주문이 있습니다' : '주문하기';
}

async function createOrder() {
  const preference = document.querySelector('input[name="deliveryPreference"]:checked')?.value || 'AI_RECOMMENDED';
  try { const result = await Yogiyo.apiClient.orders.create({customer_id:customerId,store_id:storeForCustomer[customerId] || 'S-001',delivery_preference:preference}); Yogiyo.toast(result.message); await loadCustomer(); }
  catch (error) { Yogiyo.toast(error.message); }
}

Yogiyo.el('createOrderButton').addEventListener('click', event => Yogiyo.withPending(event.currentTarget, createOrder));
Yogiyo.el('customerSwitcher').querySelectorAll('[data-customer-id]').forEach(button => {
  button.className = button.dataset.customerId === customerId ? 'primary-button' : 'ghost-button';
  button.addEventListener('click', () => { location.href = `/customer?customerId=${encodeURIComponent(button.dataset.customerId)}`; });
});
async function showCustomerExplanation(){try{Yogiyo.openSheet();const info=await Yogiyo.apiClient.explanation('customer',customerId);Yogiyo.el('sheetHeadline').textContent=info.headline;Yogiyo.el('sheetSummary').textContent=info.summary;Yogiyo.el('sheetReasons').innerHTML=info.reasons.map(reason=>`<div class="reason-item"><div class="reason-copy"><h3>${Yogiyo.escape(reason.title)}</h3><p>${Yogiyo.escape(reason.description)}</p></div><div class="reason-metric">${Yogiyo.escape(reason.metric)}</div></div>`).join('');Yogiyo.el('sheetNote').textContent=info.note;}catch(error){Yogiyo.closeSheet();Yogiyo.toast(error.message);}}
Yogiyo.el('whyButton').addEventListener('click', showCustomerExplanation);
Yogiyo.bindSheet(); Yogiyo.websocket('customer',customerId,loadCustomer); loadCustomer();
