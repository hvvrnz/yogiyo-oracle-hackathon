const riderId = Yogiyo.qs('riderId', Yogiyo.defaultIds.rider);
const futureSlotDemo = Yogiyo.qs('futureSlot') === 'demo';
let currentRider;
let stopRiderViewPolling;
let packageDetailRequestId = 0;
let packageDetailTrigger;
let offerSort = 'score';
let recentlyAcceptedPackageId;
let recentlyAcceptedTimer;
const declinedOfferKeysByRider = new Map();
const completedRouteStepsByPackage = new Map();
// A package acceptance must immediately hide competing offers containing the
// same orders, even before the next server poll reflects the state change.
const acceptedOfferOrderIds = new Set();

const setContentVisible = visible => { Yogiyo.el('riderContent').hidden = !visible; };
const showRiderFailure = (error, { action = false } = {}) => {
  setConnection(false);
  if (!currentRider) setContentVisible(false);
  Yogiyo.renderLoadState('riderLoadState', {
    title: action ? '패키지 상태를 변경하지 못했습니다.' : error?.status === 404 ? '라이더를 찾을 수 없습니다.' : '라이더 정보를 불러오지 못했습니다.',
    description: action ? Yogiyo.errorMessage(error, '패키지 처리') : Yogiyo.errorMessage(error, '라이더'),
    onRetry: () => loadRider(),
  });
};

const packageStatusLabels = Object.freeze({
  OFFERED: '수락 가능',
  MATCHING: '배차 진행 중',
  MATCHED: '배차 완료 · 픽업 대기',
  PICKED_UP: '픽업 완료 · 배달 진행 중',
  FUTURE_OFFERED: '다음 운행 예약 제안',
  RESERVED: '다음 운행 예약 완료',
  COMPLETED: '배달 완료',
  CANCELLED: '취소됨',
});

const setConnection = online => {
  const connection = Yogiyo.el('connection');
  connection.classList.toggle('online', online);
  connection.classList.toggle('offline', !online);
  connection.querySelector('span').textContent = online ? '실시간 조회 중' : '연결 확인 필요';
};

const packageStatus = status => packageStatusLabels[status] || status || '상태 정보 없음';

const offerKey = pkg => {
  const orderIds = Array.isArray(pkg?.order_ids) ? pkg.order_ids.map(String).sort() : [];
  return orderIds.length ? orderIds.join(',') : `package:${pkg?.package_id}`;
};

const declinedOfferKeys = () => {
  if (!declinedOfferKeysByRider.has(riderId)) declinedOfferKeysByRider.set(riderId, new Set());
  return declinedOfferKeysByRider.get(riderId);
};

const offerSortValue = pkg => {
  const value = offerSort === 'revenue' ? Number(pkg.package_revenue) : Number(pkg.score);
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
};

const coordinateLabel = profile => {
  const lat = Number(profile?.lat);
  const lng = Number(profile?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : null;
};

const routeSummary = route => {
  if (!Array.isArray(route) || !route.length) return '방문 순서 정보 없음';
  return route
    .slice()
    .sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0))
    .map(step => `주문 ${step.order_id ?? '-'} ${step.type === 'pickup' ? '픽업' : ['delivery', 'dropoff'].includes(step.type) ? '배달' : '경유'}`)
    .join(' → ');
};

const isFutureReservation = pkg => ['FUTURE_OFFERED', 'RESERVED'].includes(pkg.status);

const runStatusCard = (pkg, { reservation = false } = {}) => {
  if (!pkg) {
    const title = reservation ? '다음 운행 예약이 없습니다.' : '현재 운행 중인 패키지가 없습니다.';
    const copy = reservation
      ? '향후 예약 API가 연결되면 다음 운행 패키지가 이곳에 표시됩니다.'
      : '배차 제안을 수락하면 현재 운행 정보가 이곳에 표시됩니다.';
    return `<div class="run-status-card empty"><strong>${title}</strong><span>${copy}</span></div>`;
  }
  const revenue = Number.isFinite(Number(pkg.package_revenue)) ? Yogiyo.money(pkg.package_revenue) : '수익 정보 없음';
  return `<div class="run-status-card${reservation ? ' reservation' : ''}"><div><strong>패키지 ${Yogiyo.escape(pkg.package_id)}</strong><span class="badge ${reservation ? 'neutral' : 'brand'}">${Yogiyo.escape(packageStatus(pkg.status))}</span></div><span>${Yogiyo.escape(routeSummary(pkg.route_detail))}</span><small>예상 수익 ${Yogiyo.escape(revenue)}</small></div>`;
};

const nextStopCard = (stop, { actionable = false } = {}) => {
  if (!stop?.type) {
    return '<div class="run-status-card empty"><strong>현재 진행할 작업이 없습니다.</strong><span>배차를 수락하면 다음 픽업 또는 배달 작업이 표시됩니다.</span></div>';
  }
  const action = stop.type === 'pickup' ? '픽업하세요' : '배달하세요';
  const kind = stop.type === 'pickup' ? '픽업' : '배달';
  return `<div class="run-status-card"><div><strong>${Yogiyo.escape(stop.label || '장소 정보 없음')}</strong><span class="badge brand">${kind}</span></div><span>주문 ${Yogiyo.escape(stop.order_id ?? '-')} · ${action}</span>${actionable ? '<button type="button" class="primary-button full" data-rider-arrive>완료</button>' : ''}</div>`;
};

const futureSlotDemoCard = () => '<div class="future-slot-card"><div class="future-slot-head"><strong>다음 운행 예약 제안</strong><span class="badge brand">Future Slot</span></div><div class="future-slot-grid"><span>현재 운행 종료 <b>18:23</b></span><span>매장 도착 예정 <b>18:27</b></span><span>음식 완료 예정 <b>18:27</b></span><span>예상 대기 <b>0분</b></span></div><div class="route-lock-badge">✓ 현재 운행 경로 변경 없음</div><p>현재 배송을 완료한 뒤 수행할 다음 운행만 미리 예약하는 시연용 제안입니다.</p></div>';

const routeSteps = pkg => (Array.isArray(pkg.route_detail) ? pkg.route_detail : [])
  .map((step, index) => ({ ...step, index }))
  .filter(step => step.type === 'pickup' || ['delivery', 'dropoff'].includes(step.type))
  .sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0));

const routeStepKey = step => `${step.sequence ?? step.index}:${step.type}:${step.order_id ?? '-'}`;
const completedRouteSteps = pkg => {
  if (!completedRouteStepsByPackage.has(String(pkg.package_id))) completedRouteStepsByPackage.set(String(pkg.package_id), new Set());
  return completedRouteStepsByPackage.get(String(pkg.package_id));
};
const isPickup = step => step.type === 'pickup';
const isStepDone = (pkg, step) => {
  if (['DELIVERED', 'COMPLETED'].includes(pkg.status)) return true;
  if (pkg.status === 'PICKED_UP' && isPickup(step)) return true;
  return completedRouteSteps(pkg).has(routeStepKey(step));
};

const routeActionControls = pkg => {
  const steps = routeSteps(pkg);
  if (!steps.length || !['MATCHING', 'MATCHED', 'PICKED_UP'].includes(pkg.status)) {
    return `<button class="ghost-button full" disabled>${Yogiyo.escape(packageStatus(pkg.status))}</button>`;
  }
  const nextStep = steps.find(step => !isStepDone(pkg, step));
  const completedCount = steps.filter(step => isStepDone(pkg, step)).length;
  const nextLabel = nextStep
    ? `다음: 주문 ${nextStep.order_id ?? '-'} ${isPickup(nextStep) ? '픽업' : '배달'}`
    : '모든 방문 완료';
  return `<div class="assigned-route-panel"><div class="assigned-route-head"><strong>방문 단계</strong><span>${completedCount}/${steps.length} 완료 · ${Yogiyo.escape(nextLabel)}</span></div><div class="route-stop-list" aria-label="패키지 ${pkg.package_id} 운행 단계">${steps.map(step => {
    const done = isStepDone(pkg, step);
    const active = !done && nextStep && routeStepKey(nextStep) === routeStepKey(step);
    const kind = isPickup(step) ? '픽업' : '배달';
    const label = `주문 ${step.order_id ?? '-'} ${kind} 완료`;
    return `<button class="${active ? 'primary-button' : 'ghost-button'} route-stop-button${done ? ' done' : ''}" ${active ? `data-route-step="${step.index}" data-package-id="${pkg.package_id}"` : 'disabled'} aria-label="패키지 ${pkg.package_id} ${label}">${done ? '✓ ' : ''}${Yogiyo.escape(label)}</button>`;
  }).join('')}</div><p class="route-stop-help">각 매장·고객 방문을 순서대로 완료하세요. 모든 픽업 완료 시에만 고객 주문을 픽업 완료로 전환합니다.</p></div>`;
};

const packageDetailRow = (label, value) => `<div class="row"><span class="label">${Yogiyo.escape(label)}</span><span class="value">${Yogiyo.escape(value)}</span></div>`;

const offerExplanationCard = pkg => {
  const text = String(pkg?.rider_text || '').trim();
  const copy = text || '수익과 추천 방문 순서를 확인한 뒤 수락해 주세요.';
  return `<div class="llm-guidance offer-ai-guidance"><strong>AI 수락 판단</strong><span class="explanation-copy">${Yogiyo.escape(copy)}</span></div>`;
};

const packageExplanationCard = pkg => {
  const text = String(pkg?.rider_text || '').trim();
  const copy = text || '패키지의 방문 순서와 시간 분석을 참고해 운행해 주세요.';
  return `<div class="card"><div class="section-title-row"><h2>배차 안내</h2><span>AI 설명</span></div><div class="notice llm-guidance"><span>✦</span><div><strong>운행 안내</strong><span class="explanation-copy">${Yogiyo.escape(copy)}</span></div></div></div>`;
};

const packageDetailTimeline = timeline => {
  if (!Array.isArray(timeline) || !timeline.length) return '<p class="subtext">상세 운행 시간 정보가 없습니다.</p>';
  return `<div class="timeline">${timeline.map(step => {
    const type = step.type === 'pickup' ? '픽업' : ['delivery', 'dropoff'].includes(step.type) ? '배달' : '경유';
    const arrival = Number.isFinite(Number(step.arrival_time_min)) ? `도착 ${Number(step.arrival_time_min).toFixed(1)}분` : '도착 시간 정보 없음';
    const move = Number.isFinite(Number(step.move_time_min)) ? `이동 ${Number(step.move_time_min).toFixed(1)}분` : '이동 시간 정보 없음';
    return `<div class="timeline-item"><div class="timeline-dot">${step.type === 'pickup' ? 'P' : 'D'}</div><div class="timeline-copy"><h3>주문 ${Yogiyo.escape(step.order_id ?? '-')} ${type}</h3><p>${Yogiyo.escape(move)}</p></div><span class="timeline-time">${Yogiyo.escape(arrival)}</span></div>`;
  }).join('')}</div>`;
};

const noHarmMinutes = value => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}분` : '정보 없음';
const noHarmMoney = value => Number.isFinite(Number(value)) ? Yogiyo.money(value) : '정보 없음';

const noHarmGuaranteeCard = pkg => {
  const guarantee = pkg?.score_detail?.no_harm;
  const hasComparison = guarantee && [
    guarantee.single_eta_min,
    guarantee.bundle_eta_min,
    guarantee.single_food_sitting_min,
    guarantee.bundle_food_sitting_min,
    guarantee.single_hourly_revenue,
    guarantee.bundle_hourly_revenue,
  ].some(value => Number.isFinite(Number(value)));
  if (!hasComparison) {
    return '<div class="card"><div class="section-title-row"><h2>No-Harm 품질 보증서</h2><span class="badge neutral">비교 데이터 준비 중</span></div><p class="subtext">단건 기준 ETA·음식 방치시간·라이더 수익 비교 데이터가 제공되면 이 패키지의 품질 보증 결과를 표시합니다.</p></div>';
  }
  const passed = guarantee.passed !== false;
  const metrics = [
    ['고객 ETA', noHarmMinutes(guarantee.single_eta_min), noHarmMinutes(guarantee.bundle_eta_min)],
    ['음식 방치시간', noHarmMinutes(guarantee.single_food_sitting_min), noHarmMinutes(guarantee.bundle_food_sitting_min)],
    ['라이더 시간당 수익', noHarmMoney(guarantee.single_hourly_revenue), noHarmMoney(guarantee.bundle_hourly_revenue)],
  ];
  const reason = guarantee.reason || (passed
    ? '모든 비교 기준이 허용 범위 안에 있어 이 배차를 추천합니다.'
    : '일부 비교 기준이 허용 범위를 벗어나 이 배차는 추천하지 않습니다.');
  return `<div class="card"><div class="section-title-row"><h2>No-Harm 품질 보증서</h2><span class="badge ${passed ? 'good' : 'warn'}">${passed ? '보증 통과' : '보증 미통과'}</span></div><div class="quality-comparison"><div class="quality-comparison-head"><span>비교 기준</span><span>단건</span><span>AI 배차</span></div>${metrics.map(([label, single, bundled]) => `<div class="quality-comparison-row"><strong>${Yogiyo.escape(label)}</strong><span>${Yogiyo.escape(single)}</span><span>${Yogiyo.escape(bundled)}</span></div>`).join('')}</div><div class="notice ${passed ? 'info' : 'warn'}" style="margin-top:12px"><span>${passed ? '✓' : '!'}</span><div><strong>${passed ? '이 배차를 추천하는 이유' : '보증 기준 미통과'}</strong><span>${Yogiyo.escape(reason)}</span></div></div></div>`;
};

const setDetailBackgroundInert = isInert => {
  document.querySelectorAll('.mobile-scroll, .bottom-nav').forEach(background => {
    background.inert = isInert;
  });
};

const detailFocusableElements = () => [...Yogiyo.el('packageDetailSheet').querySelectorAll(
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
)];

function closePackageDetail() {
  packageDetailRequestId += 1;
  Yogiyo.el('packageDetailBackdrop').classList.remove('open');
  Yogiyo.el('packageDetailSheet').classList.remove('open');
  Yogiyo.el('packageDetailSheet').setAttribute('aria-hidden', 'true');
  setDetailBackgroundInert(false);
  if (packageDetailTrigger?.isConnected) packageDetailTrigger.focus();
  packageDetailTrigger = undefined;
}

function renderPackageDetail(pkg) {
  const detail = pkg.score_detail || {};
  const orderIds = Array.isArray(pkg.order_ids) && pkg.order_ids.length ? pkg.order_ids.join(', ') : '주문 ID 정보 없음';
  const createdDate = pkg.created_at ? new Date(pkg.created_at) : null;
  const createdAt = createdDate && Number.isFinite(createdDate.getTime()) ? createdDate.toLocaleString('ko-KR') : '생성 시각 정보 없음';
  Yogiyo.el('packageDetailTitle').textContent = `패키지 ${pkg.package_id} 상세`;
  Yogiyo.el('packageDetailSummary').textContent = `${packageStatus(pkg.status)} · ${pkg.package_type || '패키지'} · 주문 ${orderIds}`;
  const totalTime = Number.isFinite(Number(detail.total_time)) ? `${Number(detail.total_time).toFixed(1)}분` : '정보 없음';
  const revenue = Number.isFinite(Number(pkg.package_revenue)) ? Yogiyo.money(pkg.package_revenue) : '정보 없음';
  const hourlyRevenue = Number.isFinite(Number(pkg.hourly_revenue)) ? Yogiyo.money(pkg.hourly_revenue) : '정보 없음';
  Yogiyo.el('packageDetailContent').innerHTML = `<div class="card"><div class="section-title-row"><h2>제안 핵심 정보</h2><span>수락 전 확인</span></div>${packageDetailRow('예상 패키지 수익', revenue)}${packageDetailRow('예상 시간당 수익', hourlyRevenue)}${packageDetailRow('총 예상 소요시간', totalTime)}<div class="route-strategy-box"><strong>추천 방문 순서</strong><span>${Yogiyo.escape(routeSummary(pkg.route_detail))}</span></div></div>${noHarmGuaranteeCard(pkg)}<div class="card"><div class="section-title-row"><h2>패키지 정보</h2></div>${packageDetailRow('패키지 유형', pkg.package_type || '정보 없음')}${packageDetailRow('상태', packageStatus(pkg.status))}${packageDetailRow('묶음 주문 수', `${pkg.bundle_size ?? '-'}건`)}${packageDetailRow('매칭 점수', Number.isFinite(Number(pkg.score)) ? Number(pkg.score).toFixed(2) : '정보 없음')}${packageDetailRow('생성 시각', createdAt)}</div><div class="card"><div class="section-title-row"><h2>배차 시간 분석</h2></div>${packageDetailRow('라이더 대기시간', Number.isFinite(Number(detail.courier_wait_time)) ? `${Number(detail.courier_wait_time).toFixed(1)}분` : '정보 없음')}${packageDetailRow('음식 대기시간', Number.isFinite(Number(detail.food_sitting_time)) ? `${Number(detail.food_sitting_time).toFixed(1)}분` : '정보 없음')}${packageDetailRow('음식 보관시간', Number.isFinite(Number(detail.bag_time)) ? `${Number(detail.bag_time).toFixed(1)}분` : '정보 없음')}</div><div class="card"><div class="section-title-row"><h2>상세 방문 순서</h2></div>${packageDetailTimeline(detail.timeline)}</div>${packageExplanationCard(pkg)}`;
}

async function openPackageDetail(packageId, trigger) {
  const requestId = ++packageDetailRequestId;
  packageDetailTrigger = trigger;
  Yogiyo.el('packageDetailTitle').textContent = `패키지 ${packageId} 상세`;
  Yogiyo.el('packageDetailSummary').textContent = '최신 배차 정보를 불러오는 중입니다.';
  Yogiyo.el('packageDetailContent').innerHTML = '<div class="card skeleton"></div>';
  Yogiyo.el('packageDetailBackdrop').classList.add('open');
  Yogiyo.el('packageDetailSheet').classList.add('open');
  Yogiyo.el('packageDetailSheet').setAttribute('aria-hidden', 'false');
  setDetailBackgroundInert(true);
  Yogiyo.el('packageDetailCloseButton').focus();
  const pkg = [...(currentRider?.offers || []), ...(currentRider?.packages || [])]
    .find(item => String(item.package_id) === String(packageId));
  if (requestId !== packageDetailRequestId) return;
  if (pkg) renderPackageDetail(pkg);
  else Yogiyo.el('packageDetailContent').innerHTML = '<div class="state-card empty"><div class="state-icon" aria-hidden="true">⌕</div><div><strong>패키지 정보가 없습니다.</strong><p>다음 5초 갱신 뒤 다시 확인해 주세요.</p></div></div>';
}

function renderRider({ profile, offers, offersError, nextStop }) {
  currentRider = { profile, offers, offersError, nextStop };
  setContentVisible(true);
  Yogiyo.clearLoadState('riderLoadState');
  const riderBusy = profile?.status === 'BUSY';
  const canAcceptOffer = !riderBusy;
  // 모든 OFFERED 패키지를 누적해서 보여 준다. 이전에는 선택 주문 필터와
  // 동일 주문 조합 중복 제거 때문에 새 제안이 기존 제안을 덮어쓴 것처럼 보였다.
  const visibleOffers = offers.filter(pkg => {
    const hasAcceptedOrder = Array.isArray(pkg.order_ids)
      && pkg.order_ids.some(orderId => acceptedOfferOrderIds.has(String(orderId)));
    return !hasAcceptedOrder && !declinedOfferKeys().has(offerKey(pkg));
  });
  const sortedVisibleOffers = visibleOffers.slice().sort((left, right) => {
    const difference = offerSortValue(right) - offerSortValue(left);
    return difference || Number(left.package_id) - Number(right.package_id);
  });
  const displayedOffers = sortedVisibleOffers;
  const declinedOfferCount = offers.length - visibleOffers.length;
  const name = profile?.name || riderId;
  const coordinate = coordinateLabel(profile);
  const position = coordinate || '위치 정보 미제공';

  Yogiyo.el('riderName').textContent = name;
  Yogiyo.el('riderMeta').textContent = [profile?.region, profile?.status].filter(Boolean).join(' · ') || '라이더 정보를 확인 중';
  Yogiyo.el('packageState').textContent = riderBusy ? '진행 중인 배차' : visibleOffers.length ? `배차 제안 ${visibleOffers.length}건` : '진행 중인 패키지 없음';
  Yogiyo.el('packageCount').textContent = riderBusy ? '1건' : '0건';
  Yogiyo.el('offerCount').textContent = offersError ? '조회 실패' : `${visibleOffers.length}건`;
  Yogiyo.el('offerSortSelect').value = offerSort;
  Yogiyo.el('completedCount').textContent = `${Number(profile?.completed_order_count || 0)}건`;
  Yogiyo.el('earningsTotalPackageCount').textContent = riderBusy ? '1건' : '0건';
  Yogiyo.el('earningsCompletedCount').textContent = '-';
  Yogiyo.el('earningsTotalRevenue').textContent = '-';
  Yogiyo.el('earningsSummary').textContent = '최종 시연 API는 다음 작업과 라이더 상태를 제공합니다.';
  Yogiyo.el('riderPosition').textContent = position;
  Yogiyo.el('riderAvailability').textContent = profile?.status || '상태 정보 미제공';
  Yogiyo.renderMap('riderMap', Yogiyo.mapData.combine(
    Yogiyo.mapData.create(),
    Yogiyo.mapData.fromRiderProfile({ ...profile, rider_id: riderId, meta: { selected: true } }),
  ));
  Yogiyo.el('riderLocationCount').textContent = '내 위치 · 5초 갱신';
  Yogiyo.el('currentPackageSummary').textContent = nextStop?.type
    ? `${nextStop.label} · ${nextStop.type === 'pickup' ? '픽업' : '배달'} 진행`
    : visibleOffers.length ? `${visibleOffers.length}개의 배차 제안을 확인해 주세요.` : '현재 진행할 작업이 없습니다.';
  Yogiyo.el('currentRun').innerHTML = nextStopCard(nextStop);
  Yogiyo.el('nextRunReservation').innerHTML = futureSlotDemo ? futureSlotDemoCard() : runStatusCard(undefined, { reservation: true });

  if (offersError) {
    Yogiyo.el('riderOffers').innerHTML = `<div class="state-card error"><div class="state-icon" aria-hidden="true">!</div><div><strong>배차 제안을 불러오지 못했습니다.</strong><p>${Yogiyo.escape(Yogiyo.errorMessage(offersError, '배차 제안'))}</p><button type="button" class="ghost-button" data-offer-retry>다시 확인</button></div></div>`;
  } else if (!canAcceptOffer) {
    Yogiyo.el('riderOffers').innerHTML = '<div class="state-card empty"><div class="state-icon" aria-hidden="true">🛵</div><div><strong>현재 패키지를 먼저 완료해 주세요.</strong><p>진행 중인 패키지가 있어 새로운 배차 제안은 수락할 수 없습니다.</p></div></div>';
  } else if (!visibleOffers.length) {
    Yogiyo.el('riderOffers').innerHTML = `<div class="state-card empty"><div class="state-icon" aria-hidden="true">⌕</div><div><strong>확인할 배차 제안이 없습니다.</strong><p>${declinedOfferCount ? `이 화면에서 제외된 제안 ${declinedOfferCount}건이 있습니다.` : '조리 시작 후 백엔드의 배차 제안을 기다리고 있습니다.'}</p></div></div>`;
  } else {
    Yogiyo.el('riderOffers').innerHTML = `<div class="offer-list">${displayedOffers.map(pkg => {
      const score = Number.isFinite(Number(pkg.score)) ? Number(pkg.score).toFixed(2) : '-';
      const revenue = Number.isFinite(Number(pkg.package_revenue)) ? Yogiyo.money(pkg.package_revenue) : '정보 없음';
      return `<article class="offer-row"><div class="offer-main"><strong>패키지 ${Yogiyo.escape(pkg.package_id)}</strong><span>매칭 ${Yogiyo.escape(score)} · 예상 수익 ${Yogiyo.escape(revenue)}</span></div>${offerExplanationCard(pkg)}<div class="offer-actions"><button class="ghost-button" type="button" data-offer-detail="${pkg.package_id}" aria-label="패키지 ${pkg.package_id} 상세 조회">상세</button><button class="ghost-button" type="button" data-offer-decline="${pkg.package_id}" aria-label="패키지 ${pkg.package_id} 제안 거절">거절</button><button class="primary-button" type="button" data-offer-accept="${pkg.package_id}" aria-label="패키지 ${pkg.package_id} 제안 수락">수락</button></div></article>`;
    }).join('')}</div>`;
  }

  Yogiyo.el('riderOffers').querySelector('[data-offer-retry]')?.addEventListener('click', () => loadRider());
  Yogiyo.el('riderOffers').querySelectorAll('[data-offer-accept]').forEach(button => {
    button.addEventListener('click', event => acceptOffer(Number(event.currentTarget.dataset.offerAccept), event.currentTarget));
  });
  Yogiyo.el('riderOffers').querySelectorAll('[data-offer-decline]').forEach(button => {
    button.addEventListener('click', event => declineOffer(Number(event.currentTarget.dataset.offerDecline)));
  });
  Yogiyo.el('riderOffers').querySelectorAll('[data-offer-detail]').forEach(button => {
    button.addEventListener('click', event => openPackageDetail(Number(event.currentTarget.dataset.offerDetail), event.currentTarget));
  });

  Yogiyo.el('riderPackages').innerHTML = nextStop?.type
    ? nextStopCard(nextStop, { actionable: true })
    : '<div class="state-card empty"><div class="state-icon" aria-hidden="true">⌕</div><div><strong>진행할 작업이 없습니다.</strong><p>배차를 수락하면 다음 픽업 또는 배달 작업이 표시됩니다.</p></div></div>';
  Yogiyo.el('riderPackages').querySelector('[data-rider-arrive]')?.addEventListener('click', event => completeCurrentStop(event.currentTarget));
}

async function fetchRiderView() {
  const profile = await Yogiyo.apiClient.demo.riderProfile();
  const offersResult = Yogiyo.apiClient.demo.riderOffers()
    .then(response => ({ offers: response.offers || [], offersError: undefined }))
    .catch(error => ({ offers: [], offersError: error }));
  const nextStopResult = profile.status === 'BUSY'
    ? Yogiyo.apiClient.demo.riderNextStop().catch(() => null)
    : Promise.resolve(null);
  const { offers, offersError } = await offersResult;
  const nextStop = await nextStopResult;
  return {
    profile,
    offers,
    offersError,
    nextStop,
  };
}

async function loadRider() {
  try {
    renderRider(await fetchRiderView());
    setConnection(true);
  } catch (error) {
    showRiderFailure(error);
    Yogiyo.toast(error.message);
  }
}

const notifyDemoPackageAccepted = (response, orderIds) => {
  if (window.parent === window) return;
  window.parent.postMessage({
    type: 'ygy:package-accepted',
    packageId: response.package_id,
    riderId,
    orderIds,
  }, window.location.origin);
};

async function acceptOffer(packageId, button) {
  await Yogiyo.withPending(button, async () => {
    try {
      const offer = currentRider?.offers?.find(item => String(item.package_id) === String(packageId));
      const response = await Yogiyo.apiClient.demo.acceptPackage(packageId);
      const acceptedOrderIds = Array.isArray(response.order_ids) ? response.order_ids : offer?.order_ids || [];
      acceptedOrderIds.forEach(orderId => acceptedOfferOrderIds.add(String(orderId)));
      recentlyAcceptedPackageId = String(response.package_id);
      window.clearTimeout(recentlyAcceptedTimer);
      Yogiyo.toast(`패키지 ${response.package_id} 배차를 수락했습니다. OFFERED → MATCHING으로 전환됩니다.`);
      notifyDemoPackageAccepted(response, acceptedOrderIds);
      await loadRider();
      recentlyAcceptedTimer = window.setTimeout(() => {
        recentlyAcceptedPackageId = undefined;
        if (currentRider) renderRider(currentRider);
      }, 1800);
    } catch (error) {
      if (error?.status === 409) {
        Yogiyo.toast('이미 다른 라이더가 가져간 배차입니다. 최신 제안 목록으로 갱신합니다.');
        await loadRider();
        return;
      }
      if (error?.status === 404) {
        Yogiyo.toast('패키지가 없거나 이미 처리되었습니다. 최신 제안 목록으로 갱신합니다.');
        await loadRider();
        return;
      }
      showRiderFailure(error, { action: true });
      Yogiyo.toast(error.message);
    }
  });
}

function declineOffer(packageId) {
  const pkg = currentRider?.offers?.find(offer => String(offer.package_id) === String(packageId));
  declinedOfferKeys().add(offerKey(pkg || { package_id: packageId }));
  Yogiyo.toast(`패키지 ${packageId}와 동일 주문 조합 제안을 이 화면에서 숨겼습니다. 서버에는 저장되지 않습니다.`);
  if (currentRider) renderRider(currentRider);
}

async function completeCurrentStop(button) {
  await Yogiyo.withPending(button, async () => {
    try {
      const response = await Yogiyo.apiClient.demo.riderArrive();
      const completed = response?.completed;
      const next = response?.next;
      const completedLabel = completed?.label || completed?.store_name || `주문 ${completed?.order_id ?? '-'}`;
      Yogiyo.toast(`${completedLabel} ${completed?.type === 'pickup' ? '픽업' : '배달'} 완료${next ? ' · 다음 작업을 확인해 주세요.' : ' · 모든 운행이 완료되었습니다.'}`);
      await loadRider();
    } catch (error) {
      showRiderFailure(error, { action: true });
      Yogiyo.toast(error.message);
    }
  });
}

Yogiyo.el('offerSortSelect').addEventListener('change', event => {
  offerSort = event.currentTarget.value === 'revenue' ? 'revenue' : 'score';
  if (currentRider) renderRider(currentRider);
});
Yogiyo.el('packageDetailCloseButton').addEventListener('click', closePackageDetail);
Yogiyo.el('packageDetailBackdrop').addEventListener('click', closePackageDetail);
document.addEventListener('keydown', event => {
  const sheet = Yogiyo.el('packageDetailSheet');
  if (!sheet.classList.contains('open')) return;
  if (event.key === 'Escape') {
    closePackageDetail();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = detailFocusableElements();
  if (!focusable.length) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !sheet.contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
  }
});
stopRiderViewPolling = Yogiyo.poll(fetchRiderView, view => {
  renderRider(view);
  setConnection(true);
}, { intervalMs: 5000, onError: error => {
  setConnection(false);
  if (!currentRider) showRiderFailure(error);
  console.warn("rider polling failed", error);
} });
window.addEventListener('beforeunload', () => {
  stopRiderViewPolling?.();
}, { once: true });
