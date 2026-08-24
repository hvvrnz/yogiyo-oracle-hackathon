const riderId = Yogiyo.qs('riderId', Yogiyo.defaultIds.rider);
let currentRider;
let stopRiderViewPolling;
let visitedSteps = []; 
let offerSort = 'revenue-desc';
let simulatedRiderPosition = null;
let isRiderMoving = false;
let waitingForBusyConfirmation = false;

let previousNextStopKey = null;
let suppressNextStopChangeToast = false;
let isAcceptingOffer = false;
let isCompletingStop = false;
let lastOfferRenderKey = '';
let riderViewGeneration = 0;

const acceptedPackageKey = 'ygy-demo-accepted-package';
const completedPackagesKey = 'ygy-demo-completed-packages';
const riderPositionKey = 'ygy-demo-rider-position';

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

function restoreCompletedPackages() {
  try {
    const value = sessionStorage.getItem(completedPackagesKey);
    const items = value ? JSON.parse(value) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

let completedPackages = restoreCompletedPackages();

function saveCompletedPackage(pkg) {
  if (!pkg) return;

  const completed = {
    ...pkg,
    status: 'COMPLETED',
    completed_at: new Date().toISOString()
  };

  completedPackages = [
    completed,
    ...completedPackages.filter(
      item => String(item.package_id) !== String(completed.package_id)
    )
  ].slice(0, 100);

  sessionStorage.setItem(
    completedPackagesKey,
    JSON.stringify(completedPackages)
  );
}

function syncAcceptedPackageStatus(pkg, nextStop) {
  if (!pkg) return null;

  if (nextStop?.message === '모든 경로 완료') {
    return {
      ...pkg,
      status: 'COMPLETED'
    };
  }

  return pkg;
}

const packageStatusLabels = Object.freeze({
  OFFERED: '수락 가능',
  MATCHING: '픽업 진행 중',
  IN_PROGRESS: '배달 중',
  COMPLETED: '배달 완료'
});
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
function riderDisplayPosition(
  profile,
  pkg
) {
  if (
    Number.isFinite(
      Number(
        simulatedRiderPosition?.lat
      )
    ) &&
    Number.isFinite(
      Number(
        simulatedRiderPosition?.lng
      )
    )
  ) {
    return {
      lat:
        Number(
          simulatedRiderPosition.lat
        ),
      lng:
        Number(
          simulatedRiderPosition.lng
        ),
    };
  }

  const lastVisitedStep =
    [...routeSteps(pkg)]
      .reverse()
      .find(
        step =>
          visitedSteps.includes(
            stopKey(step)
          ) &&
          Number.isFinite(
            Number(step.lat)
          ) &&
          Number.isFinite(
            Number(step.lng)
          )
      );

  if (lastVisitedStep) {
    return {
      lat:
        Number(
          lastVisitedStep.lat
        ),
      lng:
        Number(
          lastVisitedStep.lng
        ),
    };
  }

  return {
    lat: profile?.lat,
    lng: profile?.lng,
  };
}
function publishRiderPosition(
  pkg,
  position,
  durationMs = 0
) {
  const lat =
    Number(position?.lat);

  const lng =
    Number(position?.lng);

  if (
    pkg?.package_id == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return;
  }

  const payload = {
    riderId: String(
      currentRider?.profile?.rider_id ||
      riderId
    ),

    packageId: String(
      pkg.package_id
    ),

    lat,
    lng,
    durationMs,
  };

  sessionStorage.setItem(
    riderPositionKey,
    JSON.stringify(payload)
  );

  if (window.parent !== window) {
    window.parent.postMessage(
      {
        type: 'ygy:rider-position',
        ...payload,
      },
      window.location.origin
    );
  }
}
const routeSummary = pkg => routeSteps(pkg).map(step =>
  `<div class="offer-route-row"><b>${step.sequence}</b> ${step.type === 'pickup' ? '픽업' : '배달'} · ${Yogiyo.escape(step.label || '위치 정보 없음')}</div>`
).join('') || '방문 순서 정보 없음';

const routeSummaryText = pkg =>
  routeSteps(pkg)
    .map(
      step =>
        `${step.sequence}. ${
          step.type === 'pickup'
            ? '픽업'
            : '배달'
        } · ${
          step.label ||
          '위치 정보 없음'
        }`
    )
    .join(' → ') ||
  '방문 순서 정보 없음';

function distanceMeters(
  lat1,
  lng1,
  lat2,
  lng2
) {
  const toRad =
    value =>
      value * Math.PI / 180;

  const earthRadius =
    6371000;

  const dLat =
    toRad(lat2 - lat1);

  const dLng =
    toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;

  return (
    earthRadius *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}

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

function riderMapData(
  profile,
  pkg
) {
  const routeMap =
    Yogiyo.mapData.fromRouteDetail(
      pkg?.route_detail || [],
      visitedSteps
    );


  /*
   * 라이더가 한번 이동하기 시작했다면
   * API의 고정 좌표 대신
   * 프론트에서 이동한 좌표를 사용
   */
  const riderPosition =
    riderDisplayPosition(
      profile,
      pkg
    );

  const displayProfile = {
    ...profile,
    lat:
      riderPosition.lat,
    lng:
      riderPosition.lng,
  };


  const riderMap =
    Yogiyo.mapData.fromRiderProfile({
      ...displayProfile,

      rider_id:
        riderId,

      meta: {
        selected: true
      }
    });


  return Yogiyo.mapData.combine(
    routeMap,
    riderMap
  );
}

function renderMapOfferButton(
  offers,
  activePackage
) {
  const mapRoot =
    Yogiyo.el('riderMap');

  if (!mapRoot) {
    return;
  }

  let button =
    mapRoot.querySelector(
      '.rider-map-offer-button'
    );


  /*
   * 배차를 이미 수락했거나
   * 제안이 없으면 지도 버튼 제거
   */
  if (
    activePackage ||
    !offers.length
  ) {
    button?.remove();
    return;
  }


  /*
   * 현재 정렬 기준상
   * 가장 위에 있는 배차 제안을 표시
   */
  const offer =
    offers[0];

  if (!button) {
    button =
      document.createElement(
        'button'
      );

    button.type =
      'button';

    button.className =
      'rider-map-offer-button';

    mapRoot.appendChild(
      button
    );


    button.addEventListener(
      'click',
      () => {
        /*
         * 하단 시트 펼치기
         */
        const panel =
          Yogiyo.el(
            'riderBottomPanel'
          );

        panel?.classList.add(
          'expanded'
        );


        /*
         * 배차 탭 자동 선택
         */
        const dispatchTab =
          Array.from(
            document.querySelectorAll(
              '[data-rider-tab]'
            )
          ).find(
            tab =>
              tab.dataset.riderTab !==
              'run'
          );

        dispatchTab?.click();
      }
    );
  }


  button.innerHTML = `
    <span class="rider-map-offer-label">
      새 배차 제안
    </span>

    <span class="rider-map-offer-summary">
      <strong>
        ${Yogiyo.escape(
          offer.bundle_size ?? '-'
        )}건 ·
        ${Yogiyo.money(
          offer.package_revenue
        )}
      </strong>

      <span
        class="rider-map-offer-arrow"
        aria-hidden="true"
      >
        ›
      </span>
    </span>
  `;
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

  const action = nextStop?.type === 'pickup' ? '픽업' : '배달';

  const next = nextStop?.type
    ? `<div class="notice info"><span>⌖</span><div><strong>${Yogiyo.escape(nextStop.label || '장소 정보 없음')}</strong><span class="rider-next-order-num">주문 YGY07${Yogiyo.escape(nextStop.order_id ?? '-')}</span> ${action} 예정</div></div>`
    : `<div class="notice info"><span>✓</span><div><strong>모든 방문을 완료했습니다.</strong><span>다음 배차 제안을 확인해 주세요.</span></div></div>`;

  return `<section class="rider-detail-section"><div class="section-title-row"><h2>현재 배차</h2></div><div class="card"><div class="row"><span class="label">묶음 주문</span><span class="value">${Yogiyo.escape(pkg.bundle_size ?? '-')}건</span></div>${next}</div></section><section class="rider-detail-section"><div class="section-title-row"><h2>전체 방문 순서</h2><span>지도 번호와 동일</span></div><div class="card">${routeSchedule(pkg, nextStop)}</div></section>`;
}

function distanceMeters(
  lat1,
  lng1,
  lat2,
  lng2
) {
  const toRad =
    value =>
      value * Math.PI / 180;

  const earthRadius =
    6371000;

  const dLat =
    toRad(lat2 - lat1);

  const dLng =
    toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;

  return (
    earthRadius *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}


function runStatusCard(
  pkg,
  profile
) {
  if (!pkg) {
    return `
      <div class="run-status-card empty">
        <strong>
          현재 운행 중인 패키지가 없습니다.
        </strong>

        <span>
          배차 제안을 수락하면 운행 정보가 표시됩니다.
        </span>
      </div>
    `;
  }


  const steps =
    routeSteps(pkg);

  /*
   * 아직 방문하지 않은
   * 첫 번째 목적지
   */
  const nextStep =
    steps.find(
      step =>
        !visitedSteps.includes(
          stopKey(step)
        )
    );


  const riderPosition =
    riderDisplayPosition(
      profile,
      pkg
    );


  let destinationText =
    '다음 목적지를 확인해 주세요.';


  if (
    nextStep &&
    Number.isFinite(
      Number(riderPosition?.lat)
    ) &&
    Number.isFinite(
      Number(riderPosition?.lng)
    ) &&
    Number.isFinite(
      Number(nextStep.lat)
    ) &&
    Number.isFinite(
      Number(nextStep.lng)
    )
  ) {
    const meters =
      distanceMeters(
        Number(riderPosition.lat),
        Number(riderPosition.lng),
        Number(nextStep.lat),
        Number(nextStep.lng)
      );


    const distanceText =
      meters < 1000
        ? `${Math.round(meters)}m`
        : `${(meters / 1000).toFixed(1)}km`;


    destinationText =
      visitedSteps.length === 0
        ? `첫 번째 목적지까지 약 ${distanceText}`
        : `다음 목적지까지 약 ${distanceText}`;
  }


  return `
    <div class="run-status-card">
      <div>
        <strong>
          ${Yogiyo.escape(
            destinationText
          )}
        </strong>

        <span class="badge brand">
          ${Yogiyo.escape(
            packageStatus(pkg.status)
          )}
        </span>
      </div>

      <div class="run-route-list">
        ${routeSummary(pkg)}
      </div>

      <small>
        
        ${Yogiyo.money(
          pkg.package_revenue
        )}
      </small>
    </div>
  `;
}


function firstDestinationText(
  pkg,
  profile
) {
  const firstStep =
    routeSteps(pkg)[0];

  if (!firstStep) {
    return '첫 번째 목적지 정보 없음';
  }

  const riderPosition =
  riderDisplayPosition(
    profile,
    pkg
  );

  if (
    !Number.isFinite(
      Number(riderPosition?.lat)
    ) ||
    !Number.isFinite(
      Number(riderPosition?.lng)
    ) ||
    !Number.isFinite(
      Number(firstStep.lat)
    ) ||
    !Number.isFinite(
      Number(firstStep.lng)
    )
  ) {
    return '첫 번째 목적지 거리 확인 중';
  }

  const meters =
    distanceMeters(
      Number(riderPosition.lat),
      Number(riderPosition.lng),
      Number(firstStep.lat),
      Number(firstStep.lng)
    );

  const distanceText =
    meters < 1000
      ? `${Math.round(meters)}m`
      : `${(meters / 1000).toFixed(1)}km`;

  return `첫 번째 목적지까지 약 ${distanceText}`;
}


function offerCard(
  pkg,
  profile
) {

  return `
    <article class="offer-row">
      <div class="offer-header">
        <div class="offer-distance-info">
          <span class="offer-bundle-count">
            ${Yogiyo.escape(
              pkg.bundle_size ?? '-'
            )}건 묶음
          </span>

          <strong class="offer-first-distance">
            ${Yogiyo.escape(
              firstDestinationText(
                pkg,
                profile
              )
            )}
          </strong>
        </div>

        <div class="offer-revenue-info">
          <span></span>

          <strong>
            ${Yogiyo.money(
              pkg.package_revenue
            )}
          </strong>
        </div>
      </div>


<div class="offer-main">
  <div class="offer-route-list">
    ${routeSummary(pkg)}
  </div>
</div>
      <div class="rider-guide-card">
      <div class="rider-guide-header">
        <span class="rider-guide-dot"></span>

        <span class="rider-guide-eyebrow">
          AI 운행 안내
        </span>
      </div>

      <ul class="rider-guide-points">
        ${
          String(
            pkg.rider_text ||
            '수익과 추천 방문 순서를 확인한 뒤 수락해 주세요.'
          )
            .split(/\r?\n/)
            .map(line =>
              line
                .replace(
                  /^[•\-]\s*/,
                  ''
                )
                .trim()
            )
            .filter(Boolean)
            .map(
              line => `
                <li>
                  ${Yogiyo.escape(line)}
                </li>
              `
            )
            .join('')
        }
      </ul>
    </div>

      <div class="offer-actions">
        <button
          class="ghost-button"
          type="button"
          data-offer-detail="${pkg.package_id}">
          거절
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

function completedPackageRow(pkg) {
  const route = routeSummaryText(pkg);

  return `
    <article class="completed-dispatch-row">
      <div class="completed-dispatch-main">
        <strong>
          <span class="badge good">완료</span>
          패키지 #${Yogiyo.escape(pkg.package_id)}
        </strong>

        <span>
          ${Yogiyo.escape(pkg.bundle_size ?? '-')}건
          · ${Yogiyo.money(pkg.package_revenue)}
        </span>

        <small>
          ${Yogiyo.escape(route)}
        </small>
      </div>

      <button
        type="button"
        class="ghost-button completed-dispatch-detail"
        data-completed-detail="${pkg.package_id}">
        상세
      </button>
    </article>
  `;
}

function renderCompletedPackages() {
  const root = Yogiyo.el('riderCompletedHistory');

  Yogiyo.el('completedDispatchCount').textContent =
    `${completedPackages.length}건`;

  if (!completedPackages.length) {
    root.innerHTML = `
      <div class="state-card empty">
        <div class="state-icon">✓</div>
        <div>
          <strong>완료한 배차가 없습니다.</strong>
          <p>배달을 완료하면 이곳에서 최근 배차를 확인할 수 있습니다.</p>
        </div>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="completed-dispatch-list">
      ${completedPackages.map(completedPackageRow).join('')}
    </div>
  `;

  root
    .querySelectorAll('[data-completed-detail]')
    .forEach(button => {
      button.addEventListener('click', () => {
        const pkg = completedPackages.find(
          item =>
            String(item.package_id) ===
            String(button.dataset.completedDetail)
        );

        if (pkg) openPackageDetail(pkg);
      });
    });
}

function openPackageDetail(pkg) {
  Yogiyo.el('packageDetailTitle').textContent = `패키지 #${pkg.package_id} 상세`;
  Yogiyo.el('packageDetailSummary').textContent =
  `${pkg.bundle_size ?? '-'}건 묶음 · ${
    packageStatus(pkg.status || 'OFFERED')
  }`;
  Yogiyo.el('packageDetailContent').innerHTML = `
    <div class="card">
      <div class="row">
        <span class="label">상태</span>
        <span class="value">${Yogiyo.escape(packageStatus(pkg.status || 'OFFERED'))}</span>
      </div>

      <div class="row">
        <span class="label">묶음 주문</span>
        <span class="value">${Yogiyo.escape(pkg.bundle_size ?? '-')}건</span>
      </div>

      <div class="row">
        <span class="label">예상 수익</span>
        <span class="value">${Yogiyo.money(pkg.package_revenue)}</span>
      </div>
    </div>

    <div class="card">
      <div class="section-title-row">
        <h2>순서대로 방문해주세요.</h2>
      </div>
      ${routeSchedule(pkg)}
    </div>
    <div class="card">
  <div class="notice llm-guidance">
    <span>✦</span>

    <div>
      <strong>
        AI 운행 안내
      </strong>

      <span>
        ${Yogiyo.escape(
          pkg.rider_text ||
          '배차 정보를 확인해 주세요.'
        )}
      </span>
    </div>
  </div>
</div>
  `;
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
    if (
      offerSort === 'time-asc' ||
      offerSort === 'time-desc'
    ) {
      const leftTime =
        Number(
          left.score_detail?.total_time
        );

      const rightTime =
        Number(
          right.score_detail?.total_time
        );

      const leftValid =
        Number.isFinite(leftTime);

      const rightValid =
        Number.isFinite(rightTime);

      if (!leftValid && !rightValid) {
        return 0;
      }

      if (!leftValid) {
        return 1;
      }

      if (!rightValid) {
        return -1;
      }

      return offerSort === 'time-asc'
        ? leftTime - rightTime
        : rightTime - leftTime;
    }

    const leftRevenue =
      Number(
        left.package_revenue || 0
      );

    const rightRevenue =
      Number(
        right.package_revenue || 0
      );

    return offerSort === 'revenue-asc'
      ? leftRevenue - rightRevenue
      : rightRevenue - leftRevenue;
  });
  Yogiyo.el('riderName').textContent = profile.name || riderId;
  Yogiyo.el('riderMeta').textContent = [profile.region, profile.status].filter(Boolean).join(' · ');
  
  const isWaitingForOffer =
  !activePackage &&
  !visibleOffers.length;

  Yogiyo.el('packageState').textContent =
    activePackage
      ? packageStatus(activePackage.status)
      : visibleOffers.length
        ? `새 배차 ${visibleOffers.length}건`
        : '배차 대기 중';


  const currentPackageSummary =
    Yogiyo.el('currentPackageSummary');

  currentPackageSummary.textContent =
    nextStop?.type
      ? `${
          nextStop.type === 'pickup'
            ? ''
            : ''
        } ${nextStop.label}`
      : activePackage
        ? `패키지 #${activePackage.package_id} 운행 중`
        : visibleOffers.length
          ? '✨ 새로운 배차 제안을 확인해 주세요.'
          : '새로운 배차를 기다리고 있어요.';


  currentPackageSummary.classList.toggle(
    'is-loading',
    isWaitingForOffer
  );

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
  Yogiyo.el('riderLocationCount').textContent = profile.lat != null ? ' · 실시간 내 위치' : '내 위치 정보 없음';
  if (!isRiderMoving) {
    Yogiyo.renderMap(
      'riderMap',
      riderMapData(
        profile,
        activePackage
      )
    );
  }
  renderMapOfferButton(
  visibleOffers,
  activePackage
);
  
  if (activePackage) {
    const steps =
      routeSteps(activePackage);

    const nextStep =
      steps.find(
        step =>
          !visitedSteps.includes(
            stopKey(step)
          )
      );

  const riderPosition =
    riderDisplayPosition(
      profile,
      activePackage
    );

    let destinationText =
      '다음 목적지를 확인해 주세요.';

    if (
      nextStep &&
      Number.isFinite(
        Number(riderPosition?.lat)
      ) &&
      Number.isFinite(
        Number(riderPosition?.lng)
      ) &&
      Number.isFinite(
        Number(nextStep.lat)
      ) &&
      Number.isFinite(
        Number(nextStep.lng)
      )
    ) {
      const meters =
        distanceMeters(
          Number(riderPosition.lat),
          Number(riderPosition.lng),
          Number(nextStep.lat),
          Number(nextStep.lng)
        );

      const distanceText =
        meters < 1000
          ? `${Math.round(meters)}m`
          : `${(meters / 1000).toFixed(1)}km`;

      destinationText =
        visitedSteps.length === 0
          ? `첫 번째 목적지까지 약 ${distanceText}`
          : `다음 목적지까지 약 ${distanceText}`;
    }

    Yogiyo.el(
      'riderRunSummary'
    ).innerHTML = `
      <div>
        <span>
          ${Yogiyo.escape(
            packageStatus(
              activePackage.status
            )
          )}
        </span>

        <strong>
          ${Yogiyo.escape(
            destinationText
          )}
        </strong>
      </div>

      <strong>
        ${Yogiyo.money(
          activePackage.package_revenue
        )}
      </strong>
    `;

  } else {
    Yogiyo.el(
      'riderRunSummary'
    ).innerHTML = `
      <div>
        <span>운행 대기</span>
        <strong>
          배차 탭에서 새 제안을 확인하세요.
        </strong>
      </div>
    `;
  }

  Yogiyo.el('riderRunDetails').innerHTML = runDetail(activePackage, nextStop);
  Yogiyo.el('riderRunDetails').querySelectorAll('[data-stop-order-id]:not([disabled])').forEach(
    btn => btn.addEventListener('click', event => completeCurrentStop(event.currentTarget))
  );
  Yogiyo.el('currentRun').innerHTML =
  runStatusCard(
    activePackage,
    profile
  );
const offerCount =
  Yogiyo.el('offerCount');

const availableOfferCount =
  offersError
    ? 0
    : visibleOffers.length;

offerCount.textContent =
  availableOfferCount;

offerCount.classList.toggle(
  'is-empty',
  availableOfferCount === 0
);

Yogiyo.el(
  'offerCountDetail'
).textContent =
  `${visibleOffers.length}건`;

  const offerRenderKey =
    JSON.stringify({
      activePackage:
        activePackage?.package_id || null,

      offers:
        visibleOffers.map(pkg => ({
          package_id:
            pkg.package_id,

          package_revenue:
            pkg.package_revenue,

          bundle_size:
            pkg.bundle_size,

          status:
            pkg.status
        })),

      hasError:
        Boolean(offersError)
    });


  /*
  * 배차 데이터가 실제로 바뀌었을 때만
  * 목록 DOM을 다시 만듭니다.
  *
  * 5초 Polling마다 수락 버튼이
  * 새 DOM으로 교체되는 문제를 방지합니다.
  */
  if (
    offerRenderKey !==
    lastOfferRenderKey
  ) {
    lastOfferRenderKey =
      offerRenderKey;

    const riderOffers =
      Yogiyo.el('riderOffers');


    if (offersError) {
      riderOffers.innerHTML = `
        <div class="state-card error">
          <div class="state-icon">!</div>

          <div>
            <strong>
              배차 제안을 불러오지 못했습니다.
            </strong>

            <p>
              잠시 후 다시 확인해 주세요.
            </p>
          </div>
        </div>
      `;
    }

    else if (activePackage) {
      riderOffers.innerHTML = `
        <div class="state-card empty">
          <div class="state-icon">🛵</div>

          <div>
            <strong>
              현재 운행을 먼저 완료해 주세요.
            </strong>

            <p>
              완료 후 새 배차 제안을 수락할 수 있습니다.
            </p>
          </div>
        </div>
      `;
    }

    else if (!visibleOffers.length) {
      riderOffers.innerHTML = `
        <div class="state-card empty">
          <div class="state-icon">⌕</div>

          <div>
            <strong>
              배차 제안이 없습니다.
            </strong>

            <p>
              조리가 시작되면 배차 제안이 표시됩니다.
            </p>
          </div>
        </div>
      `;
    }

    else {
      riderOffers.innerHTML = `
        <div class="offer-list">
          ${visibleOffers
            .map(
              pkg =>
                offerCard(
                  pkg,
                  profile
                )
            )
            .join('')}
        </div>
      `;

      bindOffers(
        visibleOffers
      );
    }
  }

  renderCompletedPackages();
  Yogiyo.clearLoadState('riderLoadState');
}

async function fetchRiderView() {
  /*
   * 이 요청이 시작된 시점의 세대 번호.
   *
   * 배차 수락 중 generation이 바뀌면
   * 이전 Polling 응답은 폐기합니다.
   */
  const generation =
    riderViewGeneration;


  const profile =
    await Yogiyo.apiClient.demo
      .riderProfile();


  const offersResult =
    await Yogiyo.apiClient.demo
      .riderOffers()
      .catch(error => ({
        offers: [],
        error
      }));


  let nextStop = null;


  if (profile.status === 'BUSY') {
    nextStop =
      await Yogiyo.apiClient.demo
        .riderNextStop()
        .catch(() => null);
  }


  /*
   * 이 요청이 실행되는 동안
   * 배차 수락이 발생했다면
   * 이 응답은 오래된 응답입니다.
   *
   * 절대로 화면이나 상태에 반영하지 않습니다.
   */
  if (
    generation !==
    riderViewGeneration
  ) {
    return null;
  }


  if (profile.status === 'BUSY') {

    waitingForBusyConfirmation = false;
    const currentNextStopKey =
      stopKey(nextStop);


    if (
      previousNextStopKey &&
      currentNextStopKey &&
      previousNextStopKey !==
        currentNextStopKey
    ) {
      if (
        !suppressNextStopChangeToast
      ) {
        Yogiyo.toast(
          '경로가 변경되었습니다.'
        );
      }
    }


    previousNextStopKey =
      currentNextStopKey;

    suppressNextStopChangeToast =
      false;
  }

  /*
   * AVAILABLE 응답이 오더라도
   * 현재 배차 수락 처리 중이면
   * acceptedPackage를 삭제하면 안 됩니다.
   */
  else if (
    !isAcceptingOffer &&
    !waitingForBusyConfirmation
  ) {
    visitedSteps = [];
    previousNextStopKey = null;

    suppressNextStopChangeToast =
      false;

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

    offers:
      offersResult.offers || [],

    offersError:
      offersResult.error,

    packages:
      acceptedPackage
        ? [acceptedPackage]
        : [],

    nextStop
  };
}

async function loadRider() {
  try {
    const view =
      await fetchRiderView();

    /*
     * 오래된 Polling 응답이면
     * 아무것도 하지 않습니다.
     */
    if (!view) {
      return;
    }

    renderRider(view);
    setConnection(true);

  } catch (error) {
    showRiderFailure(error);
    Yogiyo.toast(error.message);
  }
}

async function acceptOffer(
  pkg,
  button
) {
  if (isAcceptingOffer) {
    return;
  }

  isAcceptingOffer = true;

  /*
   * 이미 실행 중이던 5초 polling 응답 무효화
   */
  riderViewGeneration += 1;

  const packageId =
    pkg.package_id;

  const originalText =
    button.textContent;

  /*
   * 수락 버튼 하나만 잠급니다.
   * 화면 전체 pending 처리를 사용하지 않습니다.
   */
  button.disabled = true;
  button.textContent = '수락 중...';

  try {
    await Yogiyo.apiClient.demo
      .acceptPackage(
        packageId
      );

    visitedSteps = [];
    previousNextStopKey = null;
    suppressNextStopChangeToast = false;
    simulatedRiderPosition = null;

    completedPackages =
      completedPackages.filter(
        item =>
          String(item.package_id) !==
          String(pkg.package_id)
      );

    sessionStorage.setItem(
      completedPackagesKey,
      JSON.stringify(
        completedPackages
      )
    );

    /*
     * 프론트에서는 즉시
     * 운행 패키지로 확정
     */
    saveAcceptedPackage({
      ...pkg,
      status: 'MATCHING'
    });

    /*
     * 배차 목록 강제 갱신
     */
    lastOfferRenderKey = '';

    Yogiyo.toast(
      `패키지 #${packageId} 배차를 수락했습니다.`
    );

    if (window.parent !== window) {
      window.parent.postMessage(
        {
          type:
            'ygy:package-accepted',

          packageId,
          riderId,

          orderIds:
            pkg.order_ids || []
        },

        window.location.origin
      );
    }

  } catch (error) {
    Yogiyo.toast(
      error.message
    );

    return;

  } finally {
    /*
     * API 수락이 끝나는 즉시 잠금 해제.
     * loadRider()를 기다리지 않습니다.
     */
    isAcceptingOffer = false;

    if (button.isConnected) {
      button.disabled = false;
      button.textContent =
        originalText;
    }
  }


  /*
   * 여기부터는 pending과 완전히 별개
   */
  await loadRider();
}


async function completeCurrentStop(
  button
) {
  if (isCompletingStop) {
    return;
  }

  isCompletingStop = true;

  try {
    await Yogiyo.withPending(
      button,
      async () => {
        try {
        /*
         * API 호출 전 현재 패키지를 기억
         */
        const currentPackage =
          acceptedPackage ||
          currentRider
            ?.packages?.[0];


        const response =
          await Yogiyo.apiClient.demo
            .riderArrive();

            /*
        * 방문 완료 전에 시작된 Polling 응답은
        * 이전 경로 상태이므로 폐기합니다.
        */
        riderViewGeneration += 1;

        suppressNextStopChangeToast =
          true;


        /*
         * 완료된 방문지와
         * 같은 route_detail 항목 탐색
         */
        const completedStop =
          routeSteps(
            currentPackage
          ).find(
            step =>
              stopKey(step) ===
              stopKey(
                response.completed
              )
          );


        /*
         * 1. 먼저 라이더를 해당 지점까지 이동
         */
        if (
  completedStop &&
  Number.isFinite(
    Number(completedStop.lat)
  ) &&
  Number.isFinite(
    Number(completedStop.lng)
  )
) {
  const targetPosition = {
    lat: Number(
      completedStop.lat
    ),
    lng: Number(
      completedStop.lng
    ),
  };

  publishRiderPosition(
    currentPackage,
    targetPosition,
    900
  );

  isRiderMoving = true;


          try {
            await Yogiyo
              .animateRiderMarker?.(
                'riderMap',

                {
                  lat:
                    Number(
                      completedStop.lat
                    ),

                  lng:
                    Number(
                      completedStop.lng
                    ),
                },

                900
              );


            /*
             * 이동 완료 위치 기억
             */
            simulatedRiderPosition = {
              lat:
                Number(
                  completedStop.lat
                ),

              lng:
                Number(
                  completedStop.lng
                ),
            };

          } finally {
            isRiderMoving =
              false;
          }
        }


        /*
         * 2. 라이더 도착 후
         * 해당 번호를 회색 처리
         */
        if (
          response.completed
        ) {
          const key =
            stopKey(
              response.completed
            );

          if (
            key &&
            !visitedSteps.includes(
              key
            )
          ) {
            visitedSteps = [
              ...visitedSteps,
              key
            ];
          }
        }


        /*
         * 3. 패키지 상태 갱신
         */
        if (acceptedPackage) {
        const updatedPackage = {
          ...acceptedPackage,
          status:
            response.package_status
        };

        if (
          response.package_status ===
          'COMPLETED'
        ) {
          saveCompletedPackage(
            updatedPackage
          );

          /*
          * 완료된 패키지는 더 이상
          * 현재 운행 패키지가 아닙니다.
          */
          saveAcceptedPackage(null);

          visitedSteps = [];
          previousNextStopKey = null;
          suppressNextStopChangeToast = false;
          waitingForBusyConfirmation = false;

          /*
          * 서버 profile 재조회가 실패하더라도
          * 화면은 즉시 운행 완료 상태로 전환합니다.
          */
          if (currentRider) {
            renderRider({
              ...currentRider,

              profile: {
                ...currentRider.profile,
                status: 'AVAILABLE'
              },

              packages: [],
              nextStop: null
            });
          }
        } else {
          saveAcceptedPackage(
            updatedPackage
          );
        }
      }


        /*
         * 4. 새 위치 + 회색 방문지를
         * 지도에 다시 반영
         */
        if (
          currentRider?.profile &&
          acceptedPackage
        ) {
          Yogiyo.renderMap(
            'riderMap',

            riderMapData(
              currentRider.profile,
              acceptedPackage
            )
          );
        }


        Yogiyo.toast(
          `${
            response.completed
              ?.label ||
            '현재 작업'
          } ${
            response.completed
              ?.type ===
            'pickup'
              ? '픽업'
              : '배달'
          } 완료`
        );


        await loadRider();

        } catch (error) {
          isRiderMoving =
            false;

          Yogiyo.toast(
            error.message
          );
        }
      }
    );
  } finally {
    isCompletingStop = false;
  }
}

function switchRiderTab(
  tabName
) {
  const run =
    tabName === 'run';

  const runTab =
    Yogiyo.el('riderRunTab');

  const dispatchTab =
    Yogiyo.el(
      'riderDispatchTab'
    );

  if (
    !runTab ||
    !dispatchTab
  ) {
    return;
  }

  runTab.hidden =
    !run;

  dispatchTab.hidden =
    run;

  document
    .querySelectorAll(
      '[data-rider-tab]'
    )
    .forEach(tab => {
      const active =
        tab.dataset.riderTab ===
        tabName;

      tab.classList.toggle(
        'active',
        active
      );

      tab.setAttribute(
        'aria-selected',
        String(active)
      );
    });


  /*
   * 운행 탭으로 돌아왔을 때만
   * 카카오맵 relayout
   */
  if (
    run &&
    currentRider
  ) {
    window.requestAnimationFrame(
      () => {
        Yogiyo.renderMap(
          'riderMap',

          riderMapData(
            currentRider.profile,
            currentRider
              .packages?.[0]
          )
        );
      }
    );
  }
}

function bindRiderTabs() {
  document
    .querySelectorAll(
      '[data-rider-tab]'
    )
    .forEach(button => {

      /*
       * 하단 시트의 드래그 이벤트가
       * 탭 버튼을 가로채지 못하도록 함
       */
      button.addEventListener(
        'pointerdown',
        event => {
          event.stopPropagation();
        }
      );


      button.addEventListener(
        'pointerup',
        event => {
          event.stopPropagation();
        }
      );


      button.addEventListener(
        'click',
        event => {
          event.preventDefault();
          event.stopPropagation();

          switchRiderTab(
            button.dataset.riderTab
          );
        }
      );
    });
}

function bindRiderSheet() {
  const panel = Yogiyo.el('riderBottomPanel');
  const handle = Yogiyo.el('riderSheetHandle');
  let startY;
  const setExpanded = expanded => { panel.classList.toggle('expanded', expanded); handle.setAttribute('aria-expanded', String(expanded)); handle.querySelector('b').textContent = expanded ? '운행 상세 보기' : '운행 상세 보기';  };
  
  panel.addEventListener(
    'pointerdown',
    event => {
      /*
      * 운행/배차 탭을 포함한 버튼에서는
      * 시트 드래그를 시작하지 않음
      */
      if (
        event.target.closest(
          'button, a, input, select, textarea'
        ) &&
        !handle.contains(event.target)
      ) {
        startY = null;
        return;
      }

      startY =
        event.clientY;

      panel.setPointerCapture?.(
        event.pointerId
      );
    }
  );

  panel.addEventListener(
    'pointerup',
    event => {
      /*
      * 하단 탭 버튼에서 발생한 pointerup은
      * 시트 열기/닫기로 처리하지 않음
      */
      if (
        event.target.closest(
          'button, a, input, select, textarea'
        ) &&
        !handle.contains(event.target)
      ) {
        startY = null;
        return;
      }


      if (startY == null) {
        return;
      }


      const distance =
        event.clientY -
        startY;


      if (
        Math.abs(distance) < 10
      ) {
        setExpanded(
          !panel.classList.contains(
            'expanded'
          )
        );

      } else if (
        distance < -30
      ) {
        setExpanded(true);

      } else if (
        distance > 30
      ) {
        setExpanded(false);
      }


      startY = null;
    }
  );


  panel.addEventListener('pointercancel', () => { startY = null; });
}

Yogiyo.el('offerSortSelect').addEventListener('change', event => { offerSort = event.currentTarget.value; if (currentRider) renderRider(currentRider); });
Yogiyo.el('packageDetailCloseButton').addEventListener('click', closePackageDetail);
Yogiyo.el('riderMapActionButton').addEventListener('click', event => completeCurrentStop(event.currentTarget));
Yogiyo.el('packageDetailBackdrop').addEventListener('click', closePackageDetail);
bindRiderTabs();
bindRiderSheet();


stopRiderViewPolling =
  Yogiyo.poll(
    fetchRiderView,

    view => {
      /*
       * 수락 처리 중이거나
       * 오래된 요청이 폐기된 경우
       * 화면에 반영하지 않습니다.
       */
      if (
        isAcceptingOffer ||
        !view
      ) {
        return;
      }

      renderRider(view);

      const activePackage =
        view.packages?.[0];

      if (activePackage) {
        publishRiderPosition(
          activePackage,
          riderDisplayPosition(
            view.profile,
            activePackage
          ),
          0
        );
      }

      setConnection(true);
    },

    {
      intervalMs: 5000,
      onError: showRiderFailure
    }
  );

window.addEventListener('beforeunload', () => stopRiderViewPolling?.(), { once: true });
