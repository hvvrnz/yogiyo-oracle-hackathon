const riderId = Yogiyo.qs('riderId', Yogiyo.defaultIds.rider);
const selectedOrderId = Yogiyo.qs('orderId');
const hasSelectedOrder = /^\d+$/.test(selectedOrderId || '');
const futureSlotDemo = Yogiyo.qs('futureSlot') === 'demo';
let currentRider;
let stopRiderViewPolling;
let locationAddress;
let locationAddressKey;
let locationAddressRequestId = 0;
let packageDetailRequestId = 0;
let packageDetailTrigger;
let offerSort = 'score';
<<<<<<< HEAD
let recentlyAcceptedPackageId;
let recentlyAcceptedTimer;
const maxVisibleOffers = 20;
const declinedOfferKeysByRider = new Map();
=======
const declinedOfferIdsByRider = new Map();
const completedRouteStepsByPackage = new Map();
>>>>>>> eab109b (fix(라이더): 묶음 배차 방문 단계별 픽업 처리)

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

const includesSelectedOrder = pkg => !hasSelectedOrder || (
  Array.isArray(pkg?.order_ids) && pkg.order_ids.some(orderId => String(orderId) === String(selectedOrderId))
);

const declinedOfferKeys = () => {
  if (!declinedOfferKeysByRider.has(riderId)) declinedOfferKeysByRider.set(riderId, new Set());
  return declinedOfferKeysByRider.get(riderId);
};

const offerSortValue = pkg => {
  const value = offerSort === 'revenue' ? Number(pkg.package_revenue) : Number(pkg.score);
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
};

const offerMetric = value => Number.isFinite(Number(value)) ? Number(value) : Number.NEGATIVE_INFINITY;

const preferredOffer = (left, right) => {
  const scoreDifference = offerMetric(right.score) - offerMetric(left.score);
  if (scoreDifference) return scoreDifference > 0 ? right : left;
  const revenueDifference = offerMetric(right.package_revenue) - offerMetric(left.package_revenue);
  if (revenueDifference) return revenueDifference > 0 ? right : left;
  return Number(right.package_id) < Number(left.package_id) ? right : left;
};

const uniqueOfferRepresentatives = offers => {
  const representatives = new Map();
  offers.forEach(pkg => {
    const key = offerKey(pkg);
    representatives.set(key, representatives.has(key) ? preferredOffer(representatives.get(key), pkg) : pkg);
  });
  return [...representatives.values()];
};


const coordinateKey = profile => {
  const lat = Number(profile?.lat);
  const lng = Number(profile?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(4)},${lng.toFixed(4)}` : null;
};

const coordinateLabel = profile => {
  const lat = Number(profile?.lat);
  const lng = Number(profile?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : null;
};

const resolveLocationAddress = profile => {
  const nextKey = coordinateKey(profile);
  if (nextKey === locationAddressKey) return;
  locationAddressKey = nextKey;
  locationAddress = undefined;
  if (!nextKey) return;
  const requestId = ++locationAddressRequestId;
  Promise.resolve(Yogiyo.reverseGeocode?.(profile?.lat, profile?.lng))
    .then(address => {
      if (requestId !== locationAddressRequestId) return;
      locationAddress = address || coordinateLabel(profile);
      if (currentRider) renderRider(currentRider);
    })
    .catch(() => {
      if (requestId !== locationAddressRequestId) return;
      locationAddress = coordinateLabel(profile);
      if (currentRider) renderRider(currentRider);
    });
};
const routeSummary = route => {
  if (!Array.isArray(route) || !route.length) return '방문 순서 정보 없음';
  return route
    .slice()
    .sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0))
    .map(step => `주문 ${step.order_id ?? '-'} ${step.type === 'pickup' ? '픽업' : ['delivery', 'dropoff'].includes(step.type) ? '배달' : '경유'}`)
    .join(' → ');
};

<<<<<<< HEAD
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

const futureSlotDemoCard = () => '<div class="future-slot-card"><div class="future-slot-head"><strong>다음 운행 예약 제안</strong><span class="badge brand">Future Slot</span></div><div class="future-slot-grid"><span>현재 운행 종료 <b>18:23</b></span><span>매장 도착 예정 <b>18:27</b></span><span>음식 완료 예정 <b>18:27</b></span><span>예상 대기 <b>0분</b></span></div><div class="route-lock-badge">✓ 현재 운행 경로 변경 없음</div><p>현재 배송을 완료한 뒤 수행할 다음 운행만 미리 예약하는 시연용 제안입니다.</p></div>';

const packageAction = pkg => {
  if (pkg.status === 'MATCHING' || pkg.status === 'MATCHED') return `<button class="primary-button" data-package-action="pickup" data-package-id="${pkg.package_id}" aria-label="패키지 ${pkg.package_id} 픽업 완료">픽업</button>`;
  if (pkg.status === 'PICKED_UP') return `<button class="primary-button" data-package-action="complete" data-package-id="${pkg.package_id}" aria-label="패키지 ${pkg.package_id} 배달 완료">완료</button>`;
  return `<button class="ghost-button" disabled>${Yogiyo.escape(packageStatus(pkg.status))}</button>`;
=======
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
  return `<div class="route-stop-list" aria-label="패키지 ${pkg.package_id} 운행 단계">${steps.map(step => {
    const done = isStepDone(pkg, step);
    const active = !done && nextStep && routeStepKey(nextStep) === routeStepKey(step);
    const kind = isPickup(step) ? '픽업' : '배달';
    const label = `주문 ${step.order_id ?? '-'} ${kind} 완료`;
    return `<button class="${active ? 'primary-button' : 'ghost-button'} route-stop-button${done ? ' done' : ''}" ${active ? `data-route-step="${step.index}" data-package-id="${pkg.package_id}"` : 'disabled'} aria-label="패키지 ${pkg.package_id} ${label}">${done ? '✓ ' : ''}${Yogiyo.escape(label)}</button>`;
  }).join('')}</div><p class="route-stop-help">각 매장·고객 방문을 순서대로 완료하세요. 모든 픽업 완료 시에만 고객 주문을 픽업 완료로 전환합니다.</p>`;
>>>>>>> eab109b (fix(라이더): 묶음 배차 방문 단계별 픽업 처리)
};

const packageDetailRow = (label, value) => `<div class="row"><span class="label">${Yogiyo.escape(label)}</span><span class="value">${Yogiyo.escape(value)}</span></div>`;

const explanationText = value => {
  const text = String(value || '').trim();
  return text || null;
};

const packageExplanationCard = state => {
  if (state?.status === 'ready') {
    return `<div class="card"><div class="section-title-row"><h2>배차 안내</h2><span>AI 설명</span></div><div class="notice info"><span>ⓘ</span><div><strong>운행 안내</strong><span class="explanation-copy">${Yogiyo.escape(state.text)}</span></div></div></div>`;
  }
  if (state?.status === 'loading') {
    return '<div class="card"><div class="section-title-row"><h2>배차 안내</h2><span>AI 설명</span></div><div class="notice info"><span>ⓘ</span><div><strong>배차 안내를 불러오는 중입니다.</strong><span>현재 패키지의 운행 안내를 확인하고 있어요.</span></div></div></div>';
  }

  const isMissing = state?.status === 'missing';
  return `<div class="card"><div class="section-title-row"><h2>배차 안내</h2><span>AI 설명</span></div><div class="notice ${isMissing ? 'info' : 'warn'}"><span>${isMissing ? 'ⓘ' : '!'}</span><div><strong>${isMissing ? '배차 설명이 아직 생성되지 않았습니다.' : '배차 안내를 불러오지 못했습니다.'}</strong><span>${isMissing ? '설명이 생성되면 이곳에서 운행 근거를 확인할 수 있습니다.' : Yogiyo.escape(Yogiyo.errorMessage(state?.error, '배차 안내'))}</span><button type="button" class="ghost-button explanation-retry" data-package-explanation-retry>다시 확인</button></div></div></div>`;
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

function renderPackageDetail(pkg, explanation = { status: 'loading' }) {
  const detail = pkg.score_detail || {};
  const orderIds = Array.isArray(pkg.order_ids) && pkg.order_ids.length ? pkg.order_ids.join(', ') : '주문 ID 정보 없음';
  const createdDate = pkg.created_at ? new Date(pkg.created_at) : null;
  const createdAt = createdDate && Number.isFinite(createdDate.getTime()) ? createdDate.toLocaleString('ko-KR') : '생성 시각 정보 없음';
  Yogiyo.el('packageDetailTitle').textContent = `패키지 ${pkg.package_id} 상세`;
  Yogiyo.el('packageDetailSummary').textContent = `${packageStatus(pkg.status)} · ${pkg.package_type || '패키지'} · 주문 ${orderIds}`;
  const totalTime = Number.isFinite(Number(detail.total_time)) ? `${Number(detail.total_time).toFixed(1)}분` : '정보 없음';
  const revenue = Number.isFinite(Number(pkg.package_revenue)) ? Yogiyo.money(pkg.package_revenue) : '정보 없음';
  const hourlyRevenue = Number.isFinite(Number(pkg.hourly_revenue)) ? Yogiyo.money(pkg.hourly_revenue) : '정보 없음';
  Yogiyo.el('packageDetailContent').innerHTML = `<div class="card"><div class="section-title-row"><h2>제안 핵심 정보</h2><span>수락 전 확인</span></div>${packageDetailRow('예상 패키지 수익', revenue)}${packageDetailRow('예상 시간당 수익', hourlyRevenue)}${packageDetailRow('총 예상 소요시간', totalTime)}<div class="route-strategy-box"><strong>추천 방문 순서</strong><span>${Yogiyo.escape(routeSummary(pkg.route_detail))}</span></div></div>${noHarmGuaranteeCard(pkg)}<div class="card"><div class="section-title-row"><h2>패키지 정보</h2></div>${packageDetailRow('패키지 유형', pkg.package_type || '정보 없음')}${packageDetailRow('상태', packageStatus(pkg.status))}${packageDetailRow('묶음 주문 수', `${pkg.bundle_size ?? '-'}건`)}${packageDetailRow('매칭 점수', Number.isFinite(Number(pkg.score)) ? Number(pkg.score).toFixed(2) : '정보 없음')}${packageDetailRow('생성 시각', createdAt)}</div><div class="card"><div class="section-title-row"><h2>배차 시간 분석</h2></div>${packageDetailRow('라이더 대기시간', Number.isFinite(Number(detail.courier_wait_time)) ? `${Number(detail.courier_wait_time).toFixed(1)}분` : '정보 없음')}${packageDetailRow('음식 대기시간', Number.isFinite(Number(detail.food_sitting_time)) ? `${Number(detail.food_sitting_time).toFixed(1)}분` : '정보 없음')}${packageDetailRow('음식 보관시간', Number.isFinite(Number(detail.bag_time)) ? `${Number(detail.bag_time).toFixed(1)}분` : '정보 없음')}</div><div class="card"><div class="section-title-row"><h2>상세 방문 순서</h2></div>${packageDetailTimeline(detail.timeline)}</div>${packageExplanationCard(explanation)}`;
  Yogiyo.el('packageDetailContent').querySelector('[data-package-explanation-retry]')?.addEventListener('click', () => {
    const requestId = ++packageDetailRequestId;
    loadPackageExplanation(pkg, requestId);
  });
}

async function loadPackageExplanation(pkg, requestId) {
  renderPackageDetail(pkg, { status: 'loading' });
  try {
    const explanation = await Yogiyo.apiClient.explanations.get(pkg.package_id);
    if (requestId !== packageDetailRequestId) return;
    const text = explanationText(explanation?.rider_text);
    renderPackageDetail(pkg, text ? { status: 'ready', text } : { status: 'missing' });
  } catch (error) {
    if (requestId !== packageDetailRequestId) return;
    renderPackageDetail(pkg, error?.status === 404 ? { status: 'missing' } : { status: 'error', error });
  }
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
  try {
    const pkg = await Yogiyo.apiClient.packages.get(packageId);
    if (requestId !== packageDetailRequestId) return;
    loadPackageExplanation(pkg, requestId);
  } catch (error) {
    if (requestId !== packageDetailRequestId) return;
    Yogiyo.el('packageDetailSummary').textContent = '패키지 상세 정보를 불러오지 못했습니다.';
    Yogiyo.el('packageDetailContent').innerHTML = `<div class="state-card error"><div class="state-icon" aria-hidden="true">!</div><div><strong>상세 조회에 실패했습니다.</strong><p>${Yogiyo.escape(Yogiyo.errorMessage(error, '패키지 상세'))}</p><button class="ghost-button" data-package-detail-retry="${packageId}">다시 시도</button></div></div>`;
    Yogiyo.el('packageDetailContent').querySelector('[data-package-detail-retry]')?.addEventListener('click', event => openPackageDetail(Number(event.currentTarget.dataset.packageDetailRetry), event.currentTarget));
  }
}

function renderRider({ profile, offers, offersError, packages, earnings, earningsError }) {
  currentRider = { profile, offers, offersError, packages, earnings, earningsError };
  setContentVisible(true);
  Yogiyo.clearLoadState('riderLoadState');
  const activePackages = packages.filter(pkg => !['COMPLETED', 'CANCELLED'].includes(pkg.status));
  const currentPackage = activePackages.find(pkg => !isFutureReservation(pkg));
  const nextReservation = activePackages.find(isFutureReservation);
  const canAcceptOffer = !currentPackage && !nextReservation;
  const scopedOffers = offers.filter(includesSelectedOrder);
  const visibleOffers = scopedOffers.filter(pkg => !declinedOfferKeys().has(offerKey(pkg)));
  const uniqueOffers = uniqueOfferRepresentatives(visibleOffers);
  const sortedVisibleOffers = uniqueOffers.slice().sort((left, right) => {
    const difference = offerSortValue(right) - offerSortValue(left);
    return difference || Number(left.package_id) - Number(right.package_id);
  });
  const displayedOffers = sortedVisibleOffers.slice(0, maxVisibleOffers);
  const declinedOfferCount = scopedOffers.length - visibleOffers.length;
  const duplicateOfferCount = visibleOffers.length - uniqueOffers.length;
  const overflowOfferCount = Math.max(0, sortedVisibleOffers.length - displayedOffers.length);
  const name = profile?.name || riderId;
  resolveLocationAddress(profile);
  const coordinate = coordinateLabel(profile);
  const position = locationAddress || (coordinate ? '주소 확인 중' : '위치 정보 미제공');

  Yogiyo.el('riderName').textContent = name;
  Yogiyo.el('riderMeta').textContent = [profile?.region, profile?.status, hasSelectedOrder ? `주문 ${selectedOrderId} 제안만 표시` : undefined].filter(Boolean).join(' · ') || '라이더 정보를 확인 중';
  Yogiyo.el('packageState').textContent = activePackages.length ? `진행 패키지 ${activePackages.length}건` : uniqueOffers.length ? `배차 제안 ${uniqueOffers.length}건` : '진행 중인 패키지 없음';
  Yogiyo.el('packageCount').textContent = `${packages.length}건`;
  Yogiyo.el('offerCount').textContent = offersError ? '조회 실패' : `${uniqueOffers.length}건${overflowOfferCount ? ` 중 ${displayedOffers.length}건 표시` : ''}`;
  Yogiyo.el('offerSortSelect').value = offerSort;
  Yogiyo.el('completedCount').textContent = `${Number(profile?.completed_order_count || 0)}건`;
  const hasEarnings = Boolean(earnings);
  Yogiyo.el('earningsTotalPackageCount').textContent = hasEarnings ? `${earnings.total_package_count}건` : '-';
  Yogiyo.el('earningsCompletedCount').textContent = hasEarnings ? `${earnings.completed_count}건` : '-';
  Yogiyo.el('earningsTotalRevenue').textContent = hasEarnings ? Yogiyo.money(earnings.total_revenue) : '-';
  Yogiyo.el('earningsSummary').textContent = hasEarnings
    ? `오늘 배정된 패키지 ${earnings.packages.length}건의 수익 API 응답입니다.`
    : earningsError?.status === 404 ? '수익 API가 아직 제공되지 않아 현재 운행 정보만 표시합니다.' : '오늘 수익 정보를 불러오는 중입니다.';
  Yogiyo.el('riderPosition').textContent = position;
  Yogiyo.el('riderAvailability').textContent = profile?.status || '상태 정보 미제공';
  const routeMap = currentPackage ? Yogiyo.mapData.fromRouteDetail(currentPackage.route_detail) : Yogiyo.mapData.create();
  Yogiyo.renderMap('riderMap', Yogiyo.mapData.combine(
    routeMap,
    Yogiyo.mapData.fromRiderProfile({ ...profile, rider_id: riderId, meta: { selected: true } }),
  ));
  Yogiyo.el('riderLocationCount').textContent = '내 위치 · 5초 갱신';
  Yogiyo.el('currentPackageSummary').textContent = currentPackage
    ? `패키지 ${currentPackage.package_id} · ${packageStatus(currentPackage.status)}`
    : uniqueOffers.length ? `${uniqueOffers.length}개의 배차 제안을 확인해 주세요.` : '현재 패키지 정보가 없습니다.';
  Yogiyo.el('currentRun').innerHTML = runStatusCard(currentPackage);
  Yogiyo.el('nextRunReservation').innerHTML = nextReservation
    ? runStatusCard(nextReservation, { reservation: true })
    : futureSlotDemo ? futureSlotDemoCard()
      : runStatusCard(undefined, { reservation: true });

  if (offersError) {
    Yogiyo.el('riderOffers').innerHTML = `<div class="state-card error"><div class="state-icon" aria-hidden="true">!</div><div><strong>배차 제안을 불러오지 못했습니다.</strong><p>${Yogiyo.escape(Yogiyo.errorMessage(offersError, '배차 제안'))}</p><button type="button" class="ghost-button" data-offer-retry>다시 확인</button></div></div>`;
  } else if (!canAcceptOffer) {
    Yogiyo.el('riderOffers').innerHTML = '<div class="state-card empty"><div class="state-icon" aria-hidden="true">🛵</div><div><strong>현재 패키지를 먼저 완료해 주세요.</strong><p>진행 중인 패키지가 있어 새로운 배차 제안은 수락할 수 없습니다.</p></div></div>';
  } else if (!uniqueOffers.length) {
    Yogiyo.el('riderOffers').innerHTML = `<div class="state-card empty"><div class="state-icon" aria-hidden="true">⌕</div><div><strong>확인할 배차 제안이 없습니다.</strong><p>${declinedOfferCount ? `이 화면에서 거절한 제안 ${declinedOfferCount}건을 제외했습니다. 거절은 서버에 저장되지 않습니다.` : hasSelectedOrder ? `주문 ${selectedOrderId}의 배차 제안을 기다리고 있습니다. 조리 시작 후 클러스터링 주기와 다음 5초 조회가 지나면 표시됩니다.` : '조리 시작 후 백엔드의 30초 클러스터링 주기가 지나면, 다음 5초 조회에 표시됩니다.'}</p></div></div>`;
  } else {
    const offerNotice = duplicateOfferCount || overflowOfferCount
      ? `<p class="offer-list-notice">${duplicateOfferCount ? `동일 주문 조합의 경로안 ${duplicateOfferCount}건은 매칭 점수가 가장 높은 제안으로 정리했습니다.` : ''}${duplicateOfferCount && overflowOfferCount ? ' ' : ''}${overflowOfferCount ? `상위 ${maxVisibleOffers}건만 표시합니다.` : ''}</p>`
      : '';
    Yogiyo.el('riderOffers').innerHTML = `${offerNotice}<div class="offer-list">${displayedOffers.map(pkg => {
      const score = Number.isFinite(Number(pkg.score)) ? Number(pkg.score).toFixed(2) : '-';
      const revenue = Number.isFinite(Number(pkg.package_revenue)) ? Yogiyo.money(pkg.package_revenue) : '정보 없음';
      return `<article class="offer-row"><div class="offer-main"><strong>패키지 ${Yogiyo.escape(pkg.package_id)}</strong><span>매칭 ${Yogiyo.escape(score)} · 예상 수익 ${Yogiyo.escape(revenue)}</span></div><div class="offer-actions"><button class="ghost-button" type="button" data-offer-detail="${pkg.package_id}" aria-label="패키지 ${pkg.package_id} 상세 조회">상세</button><button class="ghost-button" type="button" data-offer-decline="${pkg.package_id}" aria-label="패키지 ${pkg.package_id} 제안 거절">거절</button><button class="primary-button" type="button" data-offer-accept="${pkg.package_id}" aria-label="패키지 ${pkg.package_id} 제안 수락">수락</button></div></article>`;
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

<<<<<<< HEAD
  Yogiyo.el('riderPackages').innerHTML = packages.length ? `<div class="assigned-package-list">${packages.map(pkg => {
    const score = Number.isFinite(Number(pkg.score)) ? Number(pkg.score).toFixed(2) : '-';
    const revenue = Number.isFinite(Number(pkg.package_revenue)) ? Yogiyo.money(pkg.package_revenue) : '정보 없음';
    const acceptedNow = String(pkg.package_id) === recentlyAcceptedPackageId ? ' package-accepted' : '';
    return `<article class="assigned-package-row${acceptedNow}"><div class="assigned-package-main"><strong>패키지 ${Yogiyo.escape(pkg.package_id)}</strong><span>${Yogiyo.escape(packageStatus(pkg.status))} · 매칭 ${Yogiyo.escape(score)} · 예상 수익 ${Yogiyo.escape(revenue)}</span></div><div class="assigned-package-actions"><button class="ghost-button" data-package-detail="${pkg.package_id}" aria-label="패키지 ${pkg.package_id} 상세 배차 정보 보기">상세</button>${packageAction(pkg)}</div></article>`;
  }).join('')}</div>` : '<div class="state-card empty"><div class="state-icon" aria-hidden="true">⌕</div><div><strong>배정된 패키지가 없습니다.</strong><p>현재 이 라이더에게 진행 중이거나 완료된 패키지가 없습니다.</p></div></div>';
=======
  Yogiyo.el('riderPackages').innerHTML = packages.map(pkg => {
    const orderIds = Array.isArray(pkg.order_ids) && pkg.order_ids.length ? pkg.order_ids.join(', ') : '주문 ID 정보 없음';
    const bundleSize = Number.isFinite(Number(pkg.bundle_size)) ? `${pkg.bundle_size}건 묶음` : '묶음 수 정보 없음';
    const score = Number.isFinite(Number(pkg.score)) ? `매칭 점수 ${Number(pkg.score).toFixed(2)}` : '매칭 점수 미제공';
    const revenue = Number.isFinite(Number(pkg.package_revenue)) ? `예상 매출 ${Yogiyo.money(pkg.package_revenue)}` : '예상 매출 미제공';
    const hourlyRevenue = Number.isFinite(Number(pkg.hourly_revenue)) ? `시간당 ${Yogiyo.money(pkg.hourly_revenue)}` : '시간당 수익 미제공';
    return `<article class="card order-card"><div class="row"><div><span class="badge brand">${Yogiyo.escape(packageStatus(pkg.status))}</span><div class="order-menu">${Yogiyo.escape(pkg.package_type || '패키지')}</div><div class="order-id">패키지 ${Yogiyo.escape(pkg.package_id)} · ${Yogiyo.escape(bundleSize)}</div></div><strong>${Yogiyo.escape(score)}</strong></div><div class="notice info" style="margin-top:14px"><span>🛵</span><div><strong>주문 ${Yogiyo.escape(orderIds)}</strong><span>${Yogiyo.escape(revenue)} · ${Yogiyo.escape(hourlyRevenue)}</span></div></div><div class="route-strategy-box" style="margin-top:14px"><strong>방문 순서</strong><span>${Yogiyo.escape(routeSummary(pkg.route_detail))}</span></div><div style="margin-top:14px">${routeActionControls(pkg)}</div><div style="margin-top:10px"><button class="ghost-button full" data-package-detail="${pkg.package_id}" aria-label="패키지 ${pkg.package_id} 상세 배차 정보 보기">상세 배차 정보 보기</button></div></article>`;
  }).join('') || '<div class="state-card empty"><div class="state-icon" aria-hidden="true">⌕</div><div><strong>배정된 패키지가 없습니다.</strong><p>현재 이 라이더에게 진행 중이거나 완료된 패키지가 없습니다.</p></div></div>';
>>>>>>> eab109b (fix(라이더): 묶음 배차 방문 단계별 픽업 처리)

  Yogiyo.el('riderPackages').querySelectorAll('[data-route-step]').forEach(button => {
    button.addEventListener('click', event => {
      const { packageId, routeStep } = event.currentTarget.dataset;
      completeRouteStep(Number(packageId), Number(routeStep), event.currentTarget);
    });
  });
  Yogiyo.el('riderPackages').querySelectorAll('[data-package-detail]').forEach(button => {
    button.addEventListener('click', event => openPackageDetail(Number(event.currentTarget.dataset.packageDetail), event.currentTarget));
  });
}

async function fetchRiderView() {
  const profile = await Yogiyo.apiClient.riders.profile(riderId);
  const earningsResult = Yogiyo.apiClient.riders.getEarnings(riderId)
    .then(earnings => ({ earnings, earningsError: undefined }))
    .catch(error => ({ earnings: undefined, earningsError: error }));
  const offersResult = Yogiyo.apiClient.riders.offers(riderId)
    .then(response => ({ offers: response.offers || [], offersError: undefined }))
    .catch(error => ({ offers: [], offersError: error }));
  let packages = [];
  let riderLocation;
  try {
    const response = await Yogiyo.apiClient.riders.get(riderId);
    packages = response.packages || [];
    riderLocation = response;
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  const { earnings, earningsError } = await earningsResult;
  const { offers, offersError } = await offersResult;
  return {
    profile: { ...profile, lat: riderLocation?.current_lat ?? profile.lat, lng: riderLocation?.current_lng ?? profile.lng },
    offers,
    offersError,
    packages,
    earnings,
    earningsError,
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

const notifyDemoPackageAccepted = response => {
  if (window.parent === window) return;
  window.parent.postMessage({
    type: 'ygy:package-accepted',
    packageId: response.package_id,
    riderId,
  }, window.location.origin);
};

async function acceptOffer(packageId, button) {
  await Yogiyo.withPending(button, async () => {
    try {
      const response = await Yogiyo.apiClient.riders.accept(riderId, packageId);
      recentlyAcceptedPackageId = String(response.package_id);
      window.clearTimeout(recentlyAcceptedTimer);
      Yogiyo.toast(`패키지 ${response.package_id} 배차를 수락했습니다. OFFERED → MATCHING으로 전환됩니다.`);
      notifyDemoPackageAccepted(response);
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

async function updatePackage(action, packageId) {
  const response = action === 'pickup'
    ? await Yogiyo.apiClient.riders.pickup(riderId, packageId)
    : await Yogiyo.apiClient.riders.complete(riderId, packageId);
  Yogiyo.toast(`패키지 ${response.package_id} 상태가 ${response.status}로 변경되었습니다.`);
  await loadRider();
}

async function completeRouteStep(packageId, routeStepIndex, button) {
  await Yogiyo.withPending(button, async () => {
    try {
      const pkg = currentRider?.packages?.find(item => Number(item.package_id) === packageId);
      const steps = pkg && routeSteps(pkg);
      const step = steps?.find(item => item.index === routeStepIndex);
      if (!pkg || !step || isStepDone(pkg, step)) return;
      const nextStep = steps.find(item => !isStepDone(pkg, item));
      if (!nextStep || routeStepKey(nextStep) !== routeStepKey(step)) return;

      completedRouteSteps(pkg).add(routeStepKey(step));
      const pickupsComplete = steps.filter(isPickup).every(item => isStepDone(pkg, item));
      const deliveriesComplete = steps.filter(item => !isPickup(item)).every(item => isStepDone(pkg, item));
      if (isPickup(step) && pickupsComplete && pkg.status !== 'PICKED_UP') {
        await updatePackage('pickup', packageId);
        return;
      }
      if (!isPickup(step) && deliveriesComplete && pkg.status === 'PICKED_UP') {
        await updatePackage('complete', packageId);
        return;
      }
      Yogiyo.toast(`주문 ${step.order_id ?? '-'} ${isPickup(step) ? '픽업' : '배달'}을 완료했습니다.`);
      if (currentRider) renderRider(currentRider);
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
