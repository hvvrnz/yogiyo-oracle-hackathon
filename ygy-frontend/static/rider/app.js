const initialRiderId = Yogiyo.qs('riderId', Yogiyo.defaultIds.rider);
let riderId = initialRiderId;
let currentRider;
let stopRiderViewPolling;
let locationAddress;
let locationAddressKey;
let locationAddressRequestId = 0;
let packageDetailRequestId = 0;
let packageDetailTrigger;

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

const packageAction = pkg => {
  if (pkg.status === 'MATCHING' || pkg.status === 'MATCHED') return `<button class="primary-button full" data-package-action="pickup" data-package-id="${pkg.package_id}">패키지 픽업 완료</button>`;
  if (pkg.status === 'PICKED_UP') return `<button class="primary-button full" data-package-action="complete" data-package-id="${pkg.package_id}">패키지 배달 완료</button>`;
  return `<button class="ghost-button full" disabled>${Yogiyo.escape(packageStatus(pkg.status))}</button>`;
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

function closePackageDetail() {
  packageDetailRequestId += 1;
  Yogiyo.el('packageDetailBackdrop').classList.remove('open');
  Yogiyo.el('packageDetailSheet').classList.remove('open');
  Yogiyo.el('packageDetailSheet').setAttribute('aria-hidden', 'true');
  packageDetailTrigger?.focus?.();
  packageDetailTrigger = undefined;
}

function renderPackageDetail(pkg, explanation = { status: 'loading' }) {
  const detail = pkg.score_detail || {};
  const orderIds = Array.isArray(pkg.order_ids) && pkg.order_ids.length ? pkg.order_ids.join(', ') : '주문 ID 정보 없음';
  const createdDate = pkg.created_at ? new Date(pkg.created_at) : null;
  const createdAt = createdDate && Number.isFinite(createdDate.getTime()) ? createdDate.toLocaleString('ko-KR') : '생성 시각 정보 없음';
  Yogiyo.el('packageDetailTitle').textContent = `패키지 ${pkg.package_id} 상세`;
  Yogiyo.el('packageDetailSummary').textContent = `${packageStatus(pkg.status)} · ${pkg.package_type || '패키지'} · 주문 ${orderIds}`;
  Yogiyo.el('packageDetailContent').innerHTML = `<div class="card">${packageDetailRow('패키지 유형', pkg.package_type || '정보 없음')}${packageDetailRow('상태', packageStatus(pkg.status))}${packageDetailRow('묶음 주문 수', `${pkg.bundle_size ?? '-'}건`)}${packageDetailRow('패키지 수익', Number.isFinite(Number(pkg.package_revenue)) ? Yogiyo.money(pkg.package_revenue) : '정보 없음')}${packageDetailRow('시간당 수익', Number.isFinite(Number(pkg.hourly_revenue)) ? Yogiyo.money(pkg.hourly_revenue) : '정보 없음')}${packageDetailRow('매칭 점수', Number.isFinite(Number(pkg.score)) ? Number(pkg.score).toFixed(2) : '정보 없음')}${packageDetailRow('생성 시각', createdAt)}</div><div class="card"><div class="section-title-row"><h2>배차 시간 분석</h2></div>${packageDetailRow('총 예상 소요시간', Number.isFinite(Number(detail.total_time)) ? `${Number(detail.total_time).toFixed(1)}분` : '정보 없음')}${packageDetailRow('라이더 대기시간', Number.isFinite(Number(detail.courier_wait_time)) ? `${Number(detail.courier_wait_time).toFixed(1)}분` : '정보 없음')}${packageDetailRow('음식 대기시간', Number.isFinite(Number(detail.food_sitting_time)) ? `${Number(detail.food_sitting_time).toFixed(1)}분` : '정보 없음')}${packageDetailRow('음식 보관시간', Number.isFinite(Number(detail.bag_time)) ? `${Number(detail.bag_time).toFixed(1)}분` : '정보 없음')}</div><div class="card"><div class="section-title-row"><h2>상세 방문 순서</h2></div>${packageDetailTimeline(detail.timeline)}</div>${packageExplanationCard(explanation)}`;
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
  const currentPackage = activePackages[0];
  const canAcceptOffer = activePackages.length === 0;
  const name = profile?.name || riderId;
  resolveLocationAddress(profile);
  const coordinate = coordinateLabel(profile);
  const position = locationAddress || (coordinate ? '주소 확인 중' : '위치 정보 미제공');

  Yogiyo.el('riderName').textContent = name;
  Yogiyo.el('riderMeta').textContent = [profile?.region, profile?.status].filter(Boolean).join(' · ') || '라이더 정보를 확인 중';
  Yogiyo.el('packageState').textContent = activePackages.length ? `진행 패키지 ${activePackages.length}건` : offers.length ? `배차 제안 ${offers.length}건` : '진행 중인 패키지 없음';
  Yogiyo.el('packageCount').textContent = `${packages.length}건`;
  Yogiyo.el('offerCount').textContent = offersError ? '조회 실패' : `${offers.length}건`;
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
    : offers.length ? `${offers.length}개의 배차 제안을 확인해 주세요.` : '현재 패키지 정보가 없습니다.';

  if (offersError) {
    Yogiyo.el('riderOffers').innerHTML = `<div class="state-card error"><div class="state-icon" aria-hidden="true">!</div><div><strong>배차 제안을 불러오지 못했습니다.</strong><p>${Yogiyo.escape(Yogiyo.errorMessage(offersError, '배차 제안'))}</p><button type="button" class="ghost-button" data-offer-retry>다시 확인</button></div></div>`;
  } else if (!canAcceptOffer) {
    Yogiyo.el('riderOffers').innerHTML = '<div class="state-card empty"><div class="state-icon" aria-hidden="true">🛵</div><div><strong>현재 패키지를 먼저 완료해 주세요.</strong><p>진행 중인 패키지가 있어 새로운 배차 제안은 수락할 수 없습니다.</p></div></div>';
  } else {
    Yogiyo.el('riderOffers').innerHTML = offers.map(pkg => {
      const orderIds = Array.isArray(pkg.order_ids) && pkg.order_ids.length ? pkg.order_ids.join(', ') : '주문 ID 정보 없음';
      const bundleSize = Number.isFinite(Number(pkg.bundle_size)) ? `${pkg.bundle_size}건 묶음` : '묶음 수 정보 없음';
      const score = Number.isFinite(Number(pkg.score)) ? `매칭 점수 ${Number(pkg.score).toFixed(2)}` : '매칭 점수 미제공';
      const revenue = Number.isFinite(Number(pkg.package_revenue)) ? `예상 매출 ${Yogiyo.money(pkg.package_revenue)}` : '예상 매출 미제공';
      const hourlyRevenue = Number.isFinite(Number(pkg.hourly_revenue)) ? `시간당 ${Yogiyo.money(pkg.hourly_revenue)}` : '시간당 수익 미제공';
      return `<article class="card order-card ready"><div class="row"><div><span class="badge good">배차 제안</span><div class="order-menu">${Yogiyo.escape(pkg.package_type || '패키지')}</div><div class="order-id">패키지 ${Yogiyo.escape(pkg.package_id)} · ${Yogiyo.escape(bundleSize)}</div></div><strong>${Yogiyo.escape(score)}</strong></div><div class="notice info" style="margin-top:14px"><span>₩</span><div><strong>${Yogiyo.escape(hourlyRevenue)}</strong><span>주문 ${Yogiyo.escape(orderIds)} · ${Yogiyo.escape(revenue)}</span></div></div><div class="route-strategy-box" style="margin-top:14px"><strong>추천 방문 순서</strong><span>${Yogiyo.escape(routeSummary(pkg.route_detail))}</span></div><div style="margin-top:14px"><button class="primary-button full" data-offer-accept="${pkg.package_id}">이 배차 수락하기</button></div><div style="margin-top:10px"><button class="ghost-button full" data-package-detail="${pkg.package_id}">상세 배차 정보 보기</button></div></article>`;
    }).join('') || '<div class="state-card empty"><div class="state-icon" aria-hidden="true">⌕</div><div><strong>현재 제안된 배차가 없습니다.</strong><p>새 패키지가 생성되면 5초 이내에 이곳에 표시됩니다.</p></div></div>';
  }

  Yogiyo.el('riderOffers').querySelector('[data-offer-retry]')?.addEventListener('click', () => loadRider());
  Yogiyo.el('riderOffers').querySelectorAll('[data-offer-accept]').forEach(button => {
    button.addEventListener('click', event => acceptOffer(Number(event.currentTarget.dataset.offerAccept), event.currentTarget));
  });
  Yogiyo.el('riderOffers').querySelectorAll('[data-package-detail]').forEach(button => {
    button.addEventListener('click', event => openPackageDetail(Number(event.currentTarget.dataset.packageDetail), event.currentTarget));
  });

  Yogiyo.el('riderPackages').innerHTML = packages.map(pkg => {
    const orderIds = Array.isArray(pkg.order_ids) && pkg.order_ids.length ? pkg.order_ids.join(', ') : '주문 ID 정보 없음';
    const bundleSize = Number.isFinite(Number(pkg.bundle_size)) ? `${pkg.bundle_size}건 묶음` : '묶음 수 정보 없음';
    const score = Number.isFinite(Number(pkg.score)) ? `매칭 점수 ${Number(pkg.score).toFixed(2)}` : '매칭 점수 미제공';
    const revenue = Number.isFinite(Number(pkg.package_revenue)) ? `예상 매출 ${Yogiyo.money(pkg.package_revenue)}` : '예상 매출 미제공';
    const hourlyRevenue = Number.isFinite(Number(pkg.hourly_revenue)) ? `시간당 ${Yogiyo.money(pkg.hourly_revenue)}` : '시간당 수익 미제공';
    return `<article class="card order-card"><div class="row"><div><span class="badge brand">${Yogiyo.escape(packageStatus(pkg.status))}</span><div class="order-menu">${Yogiyo.escape(pkg.package_type || '패키지')}</div><div class="order-id">패키지 ${Yogiyo.escape(pkg.package_id)} · ${Yogiyo.escape(bundleSize)}</div></div><strong>${Yogiyo.escape(score)}</strong></div><div class="notice info" style="margin-top:14px"><span>🛵</span><div><strong>주문 ${Yogiyo.escape(orderIds)}</strong><span>${Yogiyo.escape(revenue)} · ${Yogiyo.escape(hourlyRevenue)}</span></div></div><div class="route-strategy-box" style="margin-top:14px"><strong>방문 순서</strong><span>${Yogiyo.escape(routeSummary(pkg.route_detail))}</span></div><div style="margin-top:14px">${packageAction(pkg)}</div><div style="margin-top:10px"><button class="ghost-button full" data-package-detail="${pkg.package_id}">상세 배차 정보 보기</button></div></article>`;
  }).join('') || '<div class="state-card empty"><div class="state-icon" aria-hidden="true">⌕</div><div><strong>배정된 패키지가 없습니다.</strong><p>현재 이 라이더에게 진행 중이거나 완료된 패키지가 없습니다.</p></div></div>';

  Yogiyo.el('riderPackages').querySelectorAll('[data-package-action]').forEach(button => {
    button.addEventListener('click', event => {
      const { packageAction: action, packageId } = event.currentTarget.dataset;
      updatePackage(action, Number(packageId), event.currentTarget);
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

async function acceptOffer(packageId, button) {
  await Yogiyo.withPending(button, async () => {
    try {
      const response = await Yogiyo.apiClient.riders.accept(riderId, packageId);
      Yogiyo.toast(`패키지 ${response.package_id} 배차를 수락했습니다.`);
      await loadRider();
    } catch (error) {
      if (error?.status === 409) {
        Yogiyo.toast('이미 다른 라이더가 가져간 배차입니다. 최신 제안 목록으로 갱신합니다.');
        await loadRider();
        return;
      }
      showRiderFailure(error, { action: true });
      Yogiyo.toast(error.message);
    }
  });
}

async function updatePackage(action, packageId, button) {
  await Yogiyo.withPending(button, async () => {
    try {
      const response = action === 'pickup'
        ? await Yogiyo.apiClient.riders.pickup(riderId, packageId)
        : await Yogiyo.apiClient.riders.complete(riderId, packageId);
      Yogiyo.toast(`패키지 ${response.package_id} 상태가 ${response.status}로 변경되었습니다.`);
      await loadRider();
    } catch (error) {
      showRiderFailure(error, { action: true });
      Yogiyo.toast(error.message);
    }
  });
}

function bindRiderLookup() {
  const input = Yogiyo.el('riderIdInput');
  const button = Yogiyo.el('loadRiderButton');
  input.value = riderId;
  const reload = () => {
    const nextRiderId = input.value.trim();
    if (!nextRiderId) {
      Yogiyo.toast('라이더 ID를 입력해 주세요.');
      return;
    }
    riderId = nextRiderId;
    currentRider = undefined;
    locationAddress = undefined;
    locationAddressKey = undefined;
    locationAddressRequestId += 1;
    loadRider();
  };
  button.addEventListener('click', reload);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') reload();
  });
}

bindRiderLookup();
Yogiyo.el('packageDetailCloseButton').addEventListener('click', closePackageDetail);
Yogiyo.el('packageDetailBackdrop').addEventListener('click', closePackageDetail);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && Yogiyo.el('packageDetailSheet').classList.contains('open')) closePackageDetail();
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