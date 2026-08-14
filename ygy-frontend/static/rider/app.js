const initialRiderId = Yogiyo.qs('riderId', Yogiyo.defaultIds.rider);
let riderId = initialRiderId;
let currentRider;
let riderLocations = [];
let stopRiderViewPolling;
let stopRiderLocationPolling;

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

function renderRider({ profile, packages }) {
  currentRider = { profile, packages };
  setContentVisible(true);
  Yogiyo.clearLoadState('riderLoadState');
  const activePackages = packages.filter(pkg => !['COMPLETED', 'CANCELLED'].includes(pkg.status));
  const currentPackage = activePackages[0] || packages[0];
  const name = profile?.name || riderId;
  const position = [profile?.lat, profile?.lng].every(Number.isFinite)
    ? `${Number(profile.lat).toFixed(5)}, ${Number(profile.lng).toFixed(5)}`
    : '위치 정보 미제공';

  Yogiyo.el('riderName').textContent = name;
  Yogiyo.el('riderMeta').textContent = [profile?.region, profile?.status].filter(Boolean).join(' · ') || '라이더 정보를 확인 중';
  Yogiyo.el('packageState').textContent = activePackages.length ? `진행 패키지 ${activePackages.length}건` : '진행 중인 패키지 없음';
  Yogiyo.el('packageCount').textContent = `${packages.length}건`;
  Yogiyo.el('completedCount').textContent = `${Number(profile?.completed_order_count || 0)}건`;
  Yogiyo.el('riderPosition').textContent = position;
  Yogiyo.el('riderAvailability').textContent = profile?.status || '상태 정보 미제공';
  Yogiyo.renderMap('riderMap', Yogiyo.mapData.combine(
    Yogiyo.mapData.fromRiders(riderLocations, { selectedRiderId: riderId }),
    Yogiyo.mapData.fromRiderProfile({ ...profile, rider_id: riderId }),
  ));
  Yogiyo.el('riderLocationCount').textContent = riderLocations.length ? `전체 ${riderLocations.length}명 · 5초 갱신` : '내 위치 · 5초 갱신';
  Yogiyo.el('currentPackageSummary').textContent = currentPackage
    ? `패키지 ${currentPackage.package_id} · ${packageStatus(currentPackage.status)}`
    : '현재 패키지 정보가 없습니다.';

  Yogiyo.el('riderPackages').innerHTML = packages.map(pkg => {
    const orderIds = Array.isArray(pkg.order_ids) && pkg.order_ids.length ? pkg.order_ids.join(', ') : '주문 ID 정보 없음';
    const bundleSize = Number.isFinite(Number(pkg.bundle_size)) ? `${pkg.bundle_size}건 묶음` : '묶음 수 정보 없음';
    const score = Number.isFinite(Number(pkg.score)) ? `매칭 점수 ${Number(pkg.score).toFixed(2)}` : '매칭 점수 미제공';
    const revenue = Number.isFinite(Number(pkg.package_revenue)) ? `예상 매출 ${Yogiyo.money(pkg.package_revenue)}` : '예상 매출 미제공';
    const hourlyRevenue = Number.isFinite(Number(pkg.hourly_revenue)) ? `시간당 ${Yogiyo.money(pkg.hourly_revenue)}` : '시간당 수익 미제공';
    return `<article class="card order-card"><div class="row"><div><span class="badge brand">${Yogiyo.escape(packageStatus(pkg.status))}</span><div class="order-menu">${Yogiyo.escape(pkg.package_type || '패키지')}</div><div class="order-id">패키지 ${Yogiyo.escape(pkg.package_id)} · ${Yogiyo.escape(bundleSize)}</div></div><strong>${Yogiyo.escape(score)}</strong></div><div class="notice info" style="margin-top:14px"><span>🛵</span><div><strong>주문 ${Yogiyo.escape(orderIds)}</strong><span>${Yogiyo.escape(revenue)} · ${Yogiyo.escape(hourlyRevenue)}</span></div></div><div class="route-strategy-box" style="margin-top:14px"><strong>방문 순서</strong><span>${Yogiyo.escape(routeSummary(pkg.route_detail))}</span></div><div style="margin-top:14px">${packageAction(pkg)}</div></article>`;
  }).join('') || '<div class="state-card empty"><div class="state-icon" aria-hidden="true">⌕</div><div><strong>배정된 패키지가 없습니다.</strong><p>현재 이 라이더에게 진행 중이거나 완료된 패키지가 없습니다.</p></div></div>';

  Yogiyo.el('riderPackages').querySelectorAll('[data-package-action]').forEach(button => {
    button.addEventListener('click', event => {
      const { packageAction: action, packageId } = event.currentTarget.dataset;
      updatePackage(action, Number(packageId), event.currentTarget);
    });
  });
}

async function fetchRiderView() {
  const profile = await Yogiyo.apiClient.riders.profile(riderId);
  try {
    const response = await Yogiyo.apiClient.riders.get(riderId);
    return { profile: { ...profile, lat: response.current_lat ?? profile.lat, lng: response.current_lng ?? profile.lng }, packages: response.packages || [] };
  } catch (error) {
    if (error.status === 404) return { profile, packages: [] };
    throw error;
  }
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
    loadRider();
  };
  button.addEventListener('click', reload);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') reload();
  });
}

bindRiderLookup();
const updateRiderLocations = response => {
  riderLocations = Array.isArray(response?.riders) ? response.riders : [];
  if (currentRider) renderRider(currentRider);
};
stopRiderViewPolling = Yogiyo.poll(fetchRiderView, view => {
  renderRider(view);
  setConnection(true);
}, { intervalMs: 5000, onError: error => {
  setConnection(false);
  if (!currentRider) showRiderFailure(error);
  console.warn('rider polling failed', error);
} });
stopRiderLocationPolling = Yogiyo.pollRiders(updateRiderLocations, {
  intervalMs: 5000,
  onError: error => {
    console.warn('rider location polling failed', error);
    if (currentRider) Yogiyo.el('riderLocationCount').textContent = '전체 라이더 위치 갱신 실패 · 다시 시도 중';
  },
});
window.addEventListener('beforeunload', () => {
  stopRiderViewPolling?.();
  stopRiderLocationPolling?.();
}, { once: true });
