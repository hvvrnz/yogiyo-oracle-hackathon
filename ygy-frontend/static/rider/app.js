const riderId = Yogiyo.qs('riderId', Yogiyo.defaultIds.rider);
let currentRider;
let stopRiderViewPolling;
let offerSort = 'score';
let visitedSteps = []; 

let previousNextStopKey = null;
let suppressNextStopChangeToast = false;

const acceptedPackageKey = 'ygy-demo-accepted-package';

function restoreAcceptedPackage() {
  try {
    const value =
      sessionStorage.getItem(acceptedPackageKey);

    return value
      ? JSON.parse(value)
      : null;
  } catch {
    return null;
  }
}

let acceptedPackage = restoreAcceptedPackage();

function saveAcceptedPackage(pkg) {
  acceptedPackage = pkg;

  if (pkg) {
    sessionStorage.setItem(
      acceptedPackageKey,
      JSON.stringify(pkg)
    );
  } else {
    sessionStorage.removeItem(acceptedPackageKey);
  }
}

function syncAcceptedPackageStatus(pkg, nextStop) {
  if (!pkg) return null;

  if (nextStop?.type === 'pickup') {
    return {
      ...pkg,
      status: 'MATCHING'
    };
  }

  if (nextStop?.type === 'dropoff') {
    return {
      ...pkg,
      status: 'PICKED_UP'
    };
  }

  if (nextStop?.message === '모든 경로 완료') {
    return {
      ...pkg,
      status: 'COMPLETED'
    };
  }

  return pkg;
}

const packageStatusLabels = Object.freeze({ OFFERED: '수락 가능', MATCHING: '픽업 진행 중', PICKED_UP: '배달 진행 중', COMPLETED: '배달 완료' });
const packageStatus = status => packageStatusLabels[status] || status || '상태 정보 없음';
const routeSteps = pkg => (Array.isArray(pkg?.route_detail) ? pkg.route_detail : [])
  .map((step, index) => ({ ...step, sequence: Number(step.sequence ?? index + 1) }))
  .sort((left, right) => left.sequence - right.sequence);
const stopKey = step => {
  if (!step) return null;

  return `${step.order_id}-${String(step.type || '').toLowerCase()}`;
};
function syncVisitedSteps(pkg, nextStop) {
  const steps = routeSteps(pkg);

  if (!steps.length) {
    visitedSteps = [];
    return;
  }

  if (nextStop?.message === '모든 경로 완료') {
    visitedSteps = steps
      .map(stopKey)
      .filter(Boolean);

    return;
  }

  if (!nextStop?.type) {
    return;
  }

  const nextKey = stopKey(nextStop);

  const nextIndex = steps.findIndex(
    step => stopKey(step) === nextKey
  );

  if (nextIndex < 0) {
    return;
  }

  visitedSteps = steps
    .slice(0, nextIndex)
    .map(stopKey)
    .filter(Boolean);
}
const routeSummary = pkg => routeSteps(pkg).map(step =>
  `<div class="offer-route-row"><b>${step.sequence}</b> ${step.type === 'pickup' ? '픽업' : '배달'} · ${Yogiyo.escape(step.label || '위치 정보 없음')}</div>`
).join('') || '방문 순서 정보 없음';

function setConnection(online) {
  const node = Yogiyo.el('connection');
  node.classList.toggle('online', online);
  node.classList.toggle('offline', !online);
  node.querySelector('span').textContent = online ? '실시간 조회 중' : '연결 확인 필요';
}

function showRiderFailure(error) {
  setConnection(false);
  Yogiyo.renderLoadState('riderLoadState', {
    title: error?.status === 404 ? '라이더 정보를 찾을 수 없습니다.' : '라이더 정보를 불러오지 못했습니다.',
    description: Yogiyo.errorMessage(error, '라이더'),
    onRetry: loadRider,
  });
}

function riderMapData(profile, pkg) {
  const routeMap = Yogiyo.mapData.fromRouteDetail(pkg?.route_detail || [], visitedSteps);
  const riderMap = Yogiyo.mapData.fromRiderProfile({ ...profile, rider_id: riderId, meta: { selected: true } });
  return Yogiyo.mapData.combine(routeMap, riderMap);
}


function routeSchedule(
  pkg,
  nextStop,
  { interactive = true } = {}
) {
  const steps = routeSteps(pkg);

  if (!steps.length) {
    return '<p class="subtext">방문 순서 정보가 없습니다.</p>';
  }

  const nextKey = stopKey(nextStop);

  return `
    <div class="rider-stop-list">
      ${steps.map(step => {
        const key = stopKey(step);

        const visited =
          visitedSteps.includes(key);

        const current =
          Boolean(nextKey) &&
          key === nextKey;

        const isPickup =
          step.type === 'pickup';

        const typeLabel =
          isPickup
            ? '픽업'
            : '배달';

        const actionLabel =
          isPickup
            ? '픽업 완료'
            : '배달 완료';

        const fallbackLabel =
          isPickup
            ? '매장 위치'
            : '배달지 위치';

        return `
          <div
            class="rider-stop-row
              ${isPickup ? 'pickup' : 'dropoff'}
              ${visited ? 'visited' : ''}
              ${current ? 'current' : ''}"
          >
            <b>${step.sequence}</b>

            <div class="rider-stop-copy">
              <strong>${typeLabel}</strong>
              <span>
                ${Yogiyo.escape(
                  step.label ||
                  fallbackLabel
                )}
              </span>
            </div>

            ${
              interactive
                ? `
                  <button
                    type="button"
                    class="stop-complete-button"
                    data-stop-order-id="${step.order_id}"
                    data-stop-type="${step.type}"
                    ${current && !visited ? '' : 'disabled'}
                  >
                    ${actionLabel}
                  </button>
                `
                : ''
            }
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function runDetail(pkg, nextStop) {
  if (!pkg) return '<div class="state-card empty"><div class="state-icon">⌕</div><div><strong>현재 운행이 없습니다.</strong><p>배차 탭에서 제안을 수락하면 운행 지도와 상세 정보가 표시됩니다.</p></div></div>';
  const action = nextStop?.type === 'pickup' ? '픽업 완료' : '배달 완료';
  const next = nextStop?.type ? `<div class="notice info"><span>⌖</span><div><strong>현재 작업: ${Yogiyo.escape(nextStop.label || '장소 정보 없음')}</strong><span>주문 #${Yogiyo.escape(nextStop.order_id ?? '-')} ${action}</span></div></div>` : '<div class="notice info"><span>✓</span><div><strong>모든 방문을 완료했습니다.</strong><span>다음 배차 제안을 확인해 주세요.</span></div></div>';
  return `<section class="rider-detail-section"><div class="section-title-row"><h2>현재 배차</h2><span class="badge brand">${Yogiyo.escape(packageStatus(pkg.status))}</span></div><div class="card"><div class="row"><span class="label">패키지</span><span class="value">#${Yogiyo.escape(pkg.package_id)}</span></div><div class="row"><span class="label">묶음 주문</span><span class="value">${Yogiyo.escape(pkg.bundle_size ?? '-')}건</span></div><div class="row"><span class="label">예상 수익</span><span class="value">${Yogiyo.money(pkg.package_revenue)}</span></div>${next}</div></section><section class="rider-detail-section"><div class="section-title-row"><h2>전체 방문 순서</h2><span>지도 번호와 동일</span></div><div class="card">${routeSchedule(pkg, nextStop)}</div></section>`;
}

function runStatusCard(pkg) {
  if (!pkg) return '<div class="run-status-card empty"><strong>현재 운행 중인 패키지가 없습니다.</strong><span>배차 제안을 수락하면 운행 정보가 표시됩니다.</span></div>';
  return `<div class="run-status-card"><div><strong>패키지 #${Yogiyo.escape(pkg.package_id)}</strong><span class="badge brand">${Yogiyo.escape(packageStatus(pkg.status))}</span></div><div class="run-route-list">${routeSummary(pkg)}</div><small>예상 수익 ${Yogiyo.money(pkg.package_revenue)}</small></div>`;
}

function offerCard(pkg) {
  const text =
    String(pkg.rider_text || '').trim() ||
    '수익과 추천 방문 순서를 확인한 뒤 수락해 주세요.';
  const score =
    Number.isFinite(Number(pkg.score))
      ? Number(pkg.score).toFixed(2)
      : '-';
  return `
    <article class="offer-row">
      <div class="offer-header">
        <strong>패키지 #${Yogiyo.escape(pkg.package_id)}</strong>
        <span class="offer-revenue-highlight">예상 수익 ${Yogiyo.money(pkg.package_revenue)}</span>
      </div>
      <div class="offer-main">
        <span>
          ${Yogiyo.escape(pkg.bundle_size ?? '-')}건 묶음
          · AI 경로 점수 ${Yogiyo.escape(score)}
        </span>
        <div class="offer-route-list">
          ${routeSummary(pkg)}
        </div>
      </div>
      <div class="llm-guidance offer-ai-guidance">
        <strong>AI 운행 안내</strong>
        <span class="explanation-copy">
          ${Yogiyo.escape(text)}
        </span>
      </div>

      <div class="offer-actions">
        <button
          class="ghost-button"
          type="button"
          data-offer-detail="${pkg.package_id}">
          상세
        </button>

        <button
          class="primary-button"
          type="button"
          data-offer-accept="${pkg.package_id}">
          수락
        </button>
      </div>
    </article>
  `;
}

function openPackageDetail(pkg) {
  Yogiyo.el('packageDetailTitle').textContent = `패키지 #${pkg.package_id} 상세`;
  Yogiyo.el('packageDetailSummary').textContent =
  `${pkg.bundle_size ?? '-'}건 묶음 · ${
    packageStatus(pkg.status || 'OFFERED')
  }`;
  Yogiyo.el('packageDetailContent').innerHTML = `<div class="card"><div class="section-title-row"><h2>AI 추천 방문 순서</h2></div>${routeSchedule(pkg, null, {interactive: false})}</div><div class="card"><div class="notice llm-guidance"><span>✦</span><div><strong>AI 운행 안내</strong><span>${Yogiyo.escape(pkg.rider_text || '배차 정보를 확인해 주세요.')}</span></div></div></div>`;
  Yogiyo.el('packageDetailBackdrop').classList.add('open');
  Yogiyo.el('packageDetailSheet').classList.add('open');
  Yogiyo.el('packageDetailSheet').setAttribute('aria-hidden', 'false');
}

function closePackageDetail() {
  Yogiyo.el('packageDetailBackdrop').classList.remove('open');
  Yogiyo.el('packageDetailSheet').classList.remove('open');
  Yogiyo.el('packageDetailSheet').setAttribute('aria-hidden', 'true');
}

function bindOffers(offers) {
  const root = Yogiyo.el('riderOffers');

  root
    .querySelectorAll('[data-offer-accept]')
    .forEach(button => {
      button.addEventListener('click', () => {
        const pkg = offers.find(
          item =>
            String(item.package_id) ===
            String(button.dataset.offerAccept)
        );

        if (pkg) {
          acceptOffer(pkg, button);
        }
      });
    });

  root
    .querySelectorAll('[data-offer-detail]')
    .forEach(button => {
      button.addEventListener('click', () => {
        const pkg = offers.find(
          item =>
            String(item.package_id) ===
            String(button.dataset.offerDetail)
        );

        if (pkg) openPackageDetail(pkg);
      });
    });
}

function renderRider(view) {
  currentRider = view;
  const { profile, offers = [], offersError, nextStop, packages = [] } = view;
  const activePackage = packages[0];
const visibleOffers = offers
  .slice()
  .sort((left, right) => {
    if (offerSort === 'revenue') {
      return (
        Number(right.package_revenue || 0) -
        Number(left.package_revenue || 0)
      );
    }

    return (
      Number(left.score ?? Infinity) -
      Number(right.score ?? Infinity)
    );
  });
  Yogiyo.el('riderName').textContent = profile.name || riderId;
  Yogiyo.el('riderMeta').textContent = [profile.region, profile.status].filter(Boolean).join(' · ');
  Yogiyo.el('packageState').textContent = activePackage ? packageStatus(activePackage.status) : visibleOffers.length ? `배차 제안 ${visibleOffers.length}건` : '진행 중인 배차 없음';
  Yogiyo.el('currentPackageSummary').textContent = nextStop?.type ? `${nextStop.type === 'pickup' ? '다음 픽업' : '다음 배달'} · ${nextStop.label}` : activePackage ? `패키지 #${activePackage.package_id} 운행 중` : '배차 탭에서 제안을 확인하세요.';
  const mapActionButton = Yogiyo.el('riderMapActionButton');
  if (nextStop?.type) {
    mapActionButton.hidden = false;
    mapActionButton.textContent =
      nextStop.type === 'pickup'
        ? '픽업 완료'
        : '배달 완료';
  } else {
    mapActionButton.hidden = true;
  }
  Yogiyo.el('riderLocationCount').textContent = profile.lat != null ? '내 위치 · 5초 갱신' : '내 위치 정보 없음';
  Yogiyo.renderMap('riderMap', riderMapData(profile, activePackage));
  Yogiyo.el('riderRunSummary').innerHTML = activePackage ? `<div><span>${Yogiyo.escape(packageStatus(activePackage.status))}</span><strong>패키지 #${Yogiyo.escape(activePackage.package_id)}</strong></div><strong>${Yogiyo.money(activePackage.package_revenue)}</strong>` : '<div><span>운행 대기</span><strong>배차 탭에서 새 제안을 확인하세요.</strong></div>';
  Yogiyo.el('riderRunDetails').innerHTML = runDetail(activePackage, nextStop);
  Yogiyo.el('riderRunDetails').querySelectorAll('[data-stop-order-id]:not([disabled])').forEach(
    btn => btn.addEventListener('click', event => completeCurrentStop(event.currentTarget))
  );
  Yogiyo.el('currentRun').innerHTML = runStatusCard(activePackage);
  Yogiyo.el('offerCount').textContent = visibleOffers.length;
  Yogiyo.el('offerCountDetail').textContent = `${visibleOffers.length}건`;
  if (offersError) Yogiyo.el('riderOffers').innerHTML = '<div class="state-card error"><div class="state-icon">!</div><div><strong>배차 제안을 불러오지 못했습니다.</strong><p>잠시 후 다시 확인해 주세요.</p></div></div>';
  else if (activePackage) Yogiyo.el('riderOffers').innerHTML = '<div class="state-card empty"><div class="state-icon">🛵</div><div><strong>현재 운행을 먼저 완료해 주세요.</strong><p>완료 후 새 배차 제안을 수락할 수 있습니다.</p></div></div>';
  else if (!visibleOffers.length) Yogiyo.el('riderOffers').innerHTML = '<div class="state-card empty"><div class="state-icon">⌕</div><div><strong>배차 제안이 없습니다.</strong><p>조리가 시작되면 AI 배차 제안이 표시됩니다.</p></div></div>';
  else { Yogiyo.el('riderOffers').innerHTML = `<div class="offer-list">${visibleOffers.map(offerCard).join('')}</div>`; bindOffers(visibleOffers); }
  Yogiyo.clearLoadState('riderLoadState');
}

async function fetchRiderView() {
  const profile =
    await Yogiyo.apiClient.demo.riderProfile();

  const offersResult =
    await Yogiyo.apiClient.demo.riderOffers()
      .catch(error => ({
        offers: [],
        error
      }));

  let nextStop = null;

  if (profile.status === 'BUSY') {
  nextStop =
    await Yogiyo.apiClient.demo.riderNextStop()
      .catch(() => null);

  const currentNextStopKey = stopKey(nextStop);

  if (
    previousNextStopKey &&
    currentNextStopKey &&
    previousNextStopKey !== currentNextStopKey
  ) {
    if (!suppressNextStopChangeToast) {
      Yogiyo.toast('경로가 변경되었습니다.');
    }
  }

    previousNextStopKey = currentNextStopKey;
    suppressNextStopChangeToast = false;
  } else {
    // /api/demo/reset 이후 이전 시연의 프론트 상태 제거
    visitedSteps = [];
    previousNextStopKey = null;
    suppressNextStopChangeToast = false;
    saveAcceptedPackage(null);
  }

  acceptedPackage =
    syncAcceptedPackageStatus(
      acceptedPackage,
      nextStop
    );

  if (acceptedPackage) {
    syncVisitedSteps(
      acceptedPackage,
      nextStop
    );

    saveAcceptedPackage(
      acceptedPackage
    );
  }

  return {
    profile,
    offers: offersResult.offers || [],
    offersError: offersResult.error,
    packages: acceptedPackage
      ? [acceptedPackage]
      : [],
    nextStop
  };
}

async function loadRider() {
  try { renderRider(await fetchRiderView()); setConnection(true); }
  catch (error) { showRiderFailure(error); Yogiyo.toast(error.message); }
}

async function acceptOffer(pkg, button) {
  await Yogiyo.withPending(button, async () => {
    try {
      const packageId = pkg.package_id;

      await Yogiyo.apiClient.demo.acceptPackage(
        packageId
      );
      visitedSteps = [];
      saveAcceptedPackage({
        ...pkg,
        status: 'MATCHING'
      });

      Yogiyo.toast(
        `패키지 #${packageId} 배차를 수락했습니다.`
      );

      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'ygy:package-accepted',
          packageId,
          riderId,
          orderIds: pkg.order_ids || []
        }, window.location.origin);
      }

      await loadRider();
    } catch (error) {
      Yogiyo.toast(error.message);
      await loadRider();
    }
  });
}
async function completeCurrentStop(button) {
  await Yogiyo.withPending(button, async () => {
    try {
      const response =
        await Yogiyo.apiClient.demo.riderArrive();
      
      suppressNextStopChangeToast = true;

      if (acceptedPackage) {
        saveAcceptedPackage({
          ...acceptedPackage,
          status: response.package_status
        });
      }
      if (response.completed) {
        const key =
          stopKey(response.completed);

        if (
          key &&
          !visitedSteps.includes(key)
        ) {
          visitedSteps = [
            ...visitedSteps,
            key
          ];
        }
      }
      Yogiyo.toast(
        `${response.completed?.label || '현재 작업'} ${
          response.completed?.type === 'pickup'
            ? '픽업'
            : '배달'
        } 완료`
      );
      await loadRider();
    } catch (error) {
      Yogiyo.toast(error.message);
    }
  });
}

function bindRiderTabs() {
  document.querySelectorAll('[data-rider-tab]').forEach(button => button.addEventListener('click', () => {
    const run = button.dataset.riderTab === 'run';
    Yogiyo.el('riderRunTab').hidden = !run;
    Yogiyo.el('riderDispatchTab').hidden = run;
    document.querySelectorAll('[data-rider-tab]').forEach(tab => { const active = tab === button; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); });
    if (run && currentRider) window.requestAnimationFrame(() => Yogiyo.renderMap('riderMap', riderMapData(currentRider.profile, currentRider.packages?.[0])));
  }));
}

function bindRiderSheet() {
  const panel = Yogiyo.el('riderBottomPanel');
  const handle = Yogiyo.el('riderSheetHandle');
  let startY;
  const setExpanded = expanded => { panel.classList.toggle('expanded', expanded); handle.setAttribute('aria-expanded', String(expanded)); handle.querySelector('b').textContent = expanded ? '아래로 끌어 지도 보기' : '위로 끌어 운행 상세 보기'; };
  panel.addEventListener('pointerdown', event => { if (event.target.closest('button, a, input, select, textarea') && !handle.contains(event.target)) return; startY = event.clientY; panel.setPointerCapture?.(event.pointerId); });
  panel.addEventListener('pointerup', event => { if (startY == null) return; const distance = event.clientY - startY; if (Math.abs(distance) < 10) setExpanded(!panel.classList.contains('expanded')); else if (distance < -30) setExpanded(true); else if (distance > 30) setExpanded(false); startY = null; });
  panel.addEventListener('pointercancel', () => { startY = null; });
}

Yogiyo.el('offerSortSelect').addEventListener('change', event => { offerSort = event.currentTarget.value; if (currentRider) renderRider(currentRider); });
Yogiyo.el('packageDetailCloseButton').addEventListener('click', closePackageDetail);
Yogiyo.el('riderMapActionButton').addEventListener('click', event => completeCurrentStop(event.currentTarget));
Yogiyo.el('packageDetailBackdrop').addEventListener('click', closePackageDetail);
bindRiderTabs();
bindRiderSheet();
stopRiderViewPolling = Yogiyo.poll(fetchRiderView, view => { renderRider(view); setConnection(true); }, { intervalMs: 5000, onError: showRiderFailure });
window.addEventListener('beforeunload', () => stopRiderViewPolling?.(), { once: true });
