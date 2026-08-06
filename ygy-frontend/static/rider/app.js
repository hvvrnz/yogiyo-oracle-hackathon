const riderId = Yogiyo.qs('riderId', Yogiyo.defaultIds.rider);
let currentView = null;

async function loadRider() {
  try { currentView = await Yogiyo.apiClient.rider.get(riderId); renderRider(currentView); }
  catch (error) { Yogiyo.toast(error.message); }
}

function statusClass(status) {
  if (status === 'READY') return 'good';
  if (status === 'DELAYED') return 'warn';
  if (['PICKED_UP','DELIVERED'].includes(status)) return 'info';
  return 'brand';
}

function renderRider(view) {
  const {rider, package: pkg, steps, store_readiness, weather} = view;
  Yogiyo.el('riderMeta').textContent = `${rider.display_name} · ${rider.vehicle} · ${rider.status_label}`;
  const offerTarget = pkg.offered_rider_name ? ` · 제안 ${pkg.offer_attempt}차 ${pkg.offered_rider_name}` : '';
  Yogiyo.el('packageState').textContent = `${pkg.status_label} · ${pkg.bundle_size}건${offerTarget}`;
  Yogiyo.el('hourlyRevenue').textContent = `시간당 ${Yogiyo.money(pkg.hourly_revenue)}`;
  Yogiyo.el('packageSummary').textContent = pkg.efficiency_reason[2];
  Yogiyo.el('packageRevenue').textContent = `총 ${Yogiyo.money(pkg.package_revenue)}`;
  Yogiyo.el('durationChip').textContent = `약 ${pkg.estimated_duration_min}분`;
  Yogiyo.el('distanceChip').textContent = `${pkg.total_distance_km}km`;
  Yogiyo.el('waitMetric').textContent = `${pkg.total_wait_min}분`;
  Yogiyo.el('overlapMetric').textContent = `${pkg.route_overlap_pct}%`;
  Yogiyo.el('extraMetric').textContent = `${pkg.extra_distance_km}km`;
  Yogiyo.el('routeStrategyBadge').textContent = `현재 방식 · ${pkg.route_strategy_label}`;
  Yogiyo.el('routeStrategyDescription').textContent = pkg.route_strategy_description;
  Yogiyo.el('riderReassignment').hidden = !(pkg.offer_attempt > 1 || pkg.was_rejected || pkg.fallback_triggered);
  Yogiyo.el('riderReassignmentNote').textContent = pkg.reassignment_note || '';
  Yogiyo.el('riderRouteChange').hidden = !pkg.route_changed;
  Yogiyo.el('riderRouteNote').textContent = pkg.route_change_note || '';
  Yogiyo.el('currentStepLabel').textContent = pkg.current_step && pkg.accepted
    ? pkg.current_step.label
    : pkg.can_accept
      ? '새 배차 제안을 확인해 주세요'
      : pkg.was_rejected
        ? '거절 완료 · 다음 라이더 자동 탐색'
        : pkg.status === 'COMPLETED'
          ? '모든 단계 완료'
          : '현재 제안 대상이 아닙니다';
  Yogiyo.el('routeCount').textContent = `${steps.length}단계`;
  Yogiyo.el('storeReadiness').innerHTML = store_readiness.map(store => `<div class="row"><div><span class="badge ${statusClass(store.status)}">${Yogiyo.escape(store.status_label)}</span><div class="order-menu" style="font-size:13px;margin-top:6px">${Yogiyo.escape(store.store_name)}</div></div><div class="value">${store.status === 'READY' ? '준비됨' : `${store.remaining_min}분 후`}<div class="subtext">${store.ready_at}</div></div></div>`).join('');
  Yogiyo.el('routeTimeline').innerHTML = steps.map(step => `<div class="timeline-item ${step.status === 'COMPLETED' ? 'done' : step.is_current ? 'current' : ''}"><div class="timeline-dot">${step.status === 'COMPLETED' ? '✓' : step.sequence}</div><div class="timeline-copy"><h3>${Yogiyo.escape(step.destination)}</h3><p>${Yogiyo.escape(step.address)} · ${step.distance_km}km · ${step.duration_min}분</p></div><span class="timeline-time">${step.eta_label}</span></div>`).join('');
  Yogiyo.el('riderWeatherIcon').textContent = weather.condition === 'RAIN' ? '🌧️' : '☀️';
  Yogiyo.el('riderWeatherTitle').textContent = `${weather.label} · 이동 보정 +${weather.travel_delay_min}분`;
  Yogiyo.el('riderWeatherAdvisory').textContent = weather.condition === 'RAIN' ? `${weather.advisory} 노면 미끄럼에 주의하세요.` : weather.advisory;
  Yogiyo.renderRouteMap('riderMap', steps.map(step => ({...step, is_own:false})), rider);
  renderActions(pkg);
}

function renderActions(pkg) {
  const root = Yogiyo.el('riderActions');
  if (pkg.can_accept) {
    root.className = 'button-row';
    root.innerHTML = '<button class="danger-button" data-rider-action="reject">거절</button><button class="primary-button" data-rider-action="accept">3건 묶음 수락</button>';
  } else if (pkg.accepted && ['ASSIGNED','IN_PROGRESS'].includes(pkg.status)) {
    root.className = '';
    root.innerHTML = `<button class="primary-button full" data-rider-action="complete_step">${pkg.current_step ? `${Yogiyo.escape(pkg.current_step.label)} 완료` : '다음 단계 완료'}</button>`;
  } else if (pkg.status === 'COMPLETED' && pkg.accepted) {
    root.className = '';
    root.innerHTML = '<button class="secondary-button full" disabled>3건 배달 완료</button>';
  } else if (pkg.was_rejected && pkg.offered_rider_id) {
    root.className = '';
    root.innerHTML = `<a class="ghost-button full" href="/rider?riderId=${encodeURIComponent(pkg.offered_rider_id)}">${Yogiyo.escape(pkg.offered_rider_name)} 재배차 화면 보기</a>`;
  } else if (pkg.status === 'NO_RIDER_AVAILABLE') {
    root.className = '';
    root.innerHTML = '<button class="ghost-button full" disabled>후보 소진 · 탐색 반경 확대 필요</button>';
  } else if (pkg.offered_rider_name) {
    root.className = '';
    root.innerHTML = `<button class="ghost-button full" disabled>${Yogiyo.escape(pkg.offered_rider_name)}에게 제안 중</button>`;
  } else {
    root.className = '';
    root.innerHTML = '<button class="ghost-button full" disabled>다른 배차를 찾고 있어요</button>';
  }
  root.querySelectorAll('[data-rider-action]').forEach(button => button.addEventListener('click', handleRiderAction));
}

async function handleRiderAction(event) {
  const button = event.currentTarget; button.disabled = true;
  try {
    const result = await Yogiyo.apiClient.rider.action(riderId, {action:button.dataset.riderAction});
    Yogiyo.toast(result.message); await loadRider();
  } catch (error) { Yogiyo.toast(error.message); }
  finally { button.disabled = false; }
}

async function showExplanation() {
  Yogiyo.openSheet(); Yogiyo.el('sheetReasons').innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  try {
    const explanation = await Yogiyo.apiClient.explanation('rider', riderId);
    Yogiyo.el('sheetHeadline').textContent = explanation.headline;
    Yogiyo.el('sheetSummary').textContent = explanation.summary;
    const icons = ['⏳','🛣️','₩'];
    Yogiyo.el('sheetReasons').innerHTML = explanation.reasons.map((reason,index) => `<div class="reason-item"><div class="reason-icon">${icons[index]}</div><div class="reason-copy"><h3>${Yogiyo.escape(reason.title)}</h3><p>${Yogiyo.escape(reason.description)}</p></div><div class="reason-metric">${Yogiyo.escape(reason.metric)}</div></div>`).join('');
    Yogiyo.el('sheetNote').textContent = explanation.note;
  } catch (error) { Yogiyo.toast(error.message); }
}

Yogiyo.el('riderWhyButton').addEventListener('click', showExplanation);
Yogiyo.el('sheetClose').addEventListener('click', Yogiyo.closeSheet);
Yogiyo.el('sheetBackdrop').addEventListener('click', Yogiyo.closeSheet);
Yogiyo.websocket('rider', riderId, () => loadRider());
loadRider();
