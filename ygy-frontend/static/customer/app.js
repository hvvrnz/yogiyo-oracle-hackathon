let currentOrder;
let stopPolling;
let stopRiderPolling;
let trackedRiderId;
let currentRiderProfile;

const assignmentConfirmedStatuses = new Set([
  'MATCHING',
  'MATCHED',
  'PICKED_UP',
  'DELIVERED',
  'COMPLETED',
]);

const hasPackage = order =>
  order?.package_id != null &&
  order?.package_id !== '';

const hasAssignedRider = order =>
  order?.rider_id != null &&
  order?.rider_id !== '';

const hasConfirmedAssignment = order =>
  hasPackage(order) &&
  (
    assignmentConfirmedStatuses.has(order?.status) ||
    hasAssignedRider(order)
  );

const hasOfferedPackage = order =>
  order?.status === 'COOKING' &&
  hasPackage(order) &&
  !hasAssignedRider(order);


const statusMeta = Object.freeze({
  NEW: {
    label: '신규 주문',
    progress: 0,
    message:
      '주문이 접수되었습니다. 매장에서 주문을 확인하고 있어요.',
  },

  COOKING: {
    label: '조리 중 · 배차 수락 대기',
    progress: 1,
    message:
      '음식을 조리하고 있어요. 라이더의 배차 수락을 기다리고 있습니다.',
  },

  MATCHED: {
    label: '배차 완료',
    progress: 3,
    message:
      '배차가 완료되었습니다. 라이더가 픽업을 준비하고 있어요.',
  },

  PICKED_UP: {
    label: '픽업 완료',
    progress: 5,
    message:
      '라이더가 음식을 픽업해 배달 중이에요.',
  },

  DELIVERED: {
    label: '배달 완료',
    progress: 6,
    message:
      '배달이 완료되었습니다.',
  },

  COMPLETED: {
    label: '배달 완료',
    progress: 6,
    message:
      '배달이 완료되었습니다.',
  },
});


const setContentVisible = visible => {
  const panel = Yogiyo.el('customerBottomPanel');

  if (panel) {
    panel.hidden = !visible;
  }
};


function setConnection(online) {
  const root = Yogiyo.el('connection');

  if (!root) return;

  root.classList.toggle('online', online);
  root.classList.toggle('offline', !online);

  const label = root.querySelector('span');

  if (label) {
    label.textContent =
      online
        ? '서버 연결됨'
        : '재연결 필요';
  }
}


function showCustomerFailure(error) {
  setConnection(false);

  if (!currentOrder) {
    setContentVisible(false);
  }

  Yogiyo.renderLoadState(
    'customerLoadState',
    {
      title:
        error?.status === 404
          ? '시연 주문을 찾을 수 없습니다.'
          : '주문 정보를 불러오지 못했습니다.',

      description:
        Yogiyo.errorMessage(
          error,
          '시연 주문'
        ),

      onRetry: () => loadCustomer(),
    }
  );
}


function menuSummary(items) {
  return (Array.isArray(items) ? items : [])
    .map(item =>
      `${item.menu}${
        item.qty > 1
          ? ` ${item.qty}개`
          : ''
      }`
    )
    .join(' · ') || '메뉴 정보 없음';
}


function renderCustomerExplanation() {
  const section =
    Yogiyo.el('customerExplanationSection');

  const content =
    Yogiyo.el('customerExplanationContent');

  if (!hasConfirmedAssignment(currentOrder)) {
    section.hidden = true;
    content.replaceChildren();
    return;
  }

  section.hidden = false;

  const text =
    String(
      currentOrder?.consumer_text || ''
    ).trim();

  const copy =
    text ||
    '배차 안내를 준비 중입니다. 확정된 배차 정보는 위 상태와 경로에서 확인할 수 있습니다.';

  content.innerHTML = `
    <div class="notice llm-guidance">
      <span>✦</span>

      <div>
        <strong>배차 안내</strong>

        <span class="explanation-copy">
          ${Yogiyo.escape(copy)}
        </span>
      </div>
    </div>
  `;
}


function customerStatusMeta(order) {
  if (
    hasConfirmedAssignment(order) &&
    ![
      'PICKED_UP',
      'DELIVERED',
      'COMPLETED',
    ].includes(order?.status)
  ) {
    return statusMeta.MATCHED;
  }

  if (hasOfferedPackage(order)) {
    return {
      label: '배차 제안됨',
      progress: 1,
      message:
        '조리 중인 주문의 배차 제안이 생성되었습니다. 라이더의 수락을 기다리고 있어요.',
    };
  }

  return (
    statusMeta[order?.status] || {
      label:
        order?.status ||
        '상태 확인 중',

      progress: 0,

      message:
        '주문 상태를 확인하고 있어요.',
    }
  );
}


function customerMapData(order) {
  const routeDetail =
    Array.isArray(order?.route_detail)
      ? order.route_detail
      : [];

  /*
   * route_detail이 존재하더라도 실제 좌표가 없을 수 있으므로
   * map-data에서 정상 좌표로 변환된 방문지가 2개 이상일 때만
   * 전체 배차 경로를 사용합니다.
   */
  const detailedRoute =
    Yogiyo.mapData.fromRouteDetail(
      routeDetail
    );

  const routeMap =
    detailedRoute.route.length >= 2
      ? detailedRoute
      : Yogiyo.mapData.fromCustomerOrder(
          order
        );

  const riderMap =
    hasAssignedRider(order) &&
    currentRiderProfile
      ? Yogiyo.mapData.fromRiderProfile(
          currentRiderProfile
        )
      : Yogiyo.mapData.create();

  return Yogiyo.mapData.combine(
    routeMap,
    riderMap
  );
}


function renderCustomerMap() {
  if (!currentOrder) return;

  Yogiyo.renderMap(
    'customerMap',
    customerMapData(currentOrder)
  );

  const riderStep =
    Yogiyo.el('riderStep');

  riderStep.textContent =
    hasAssignedRider(currentOrder)
      ? currentRiderProfile
        ? `담당 라이더 ${
            currentRiderProfile.name ||
            currentRiderProfile.rider_id
          } 위치 표시 중`
        : `담당 라이더 ${
            currentOrder.rider_id
          } 위치 확인 중`
      : '담당 라이더 배정 전';
}


function syncRiderLocation(order) {
  const riderId =
    hasAssignedRider(order)
      ? String(order.rider_id)
      : null;

  if (riderId === trackedRiderId) {
    return;
  }

  stopRiderPolling?.();

  stopRiderPolling = undefined;
  trackedRiderId = riderId;
  currentRiderProfile = undefined;

  if (!riderId) {
    return;
  }

  stopRiderPolling =
    Yogiyo.poll(
      () =>
        Yogiyo.apiClient.demo.riderProfile(),

      profile => {
        if (
          trackedRiderId !== riderId
        ) {
          return;
        }

        currentRiderProfile = profile;

        renderCustomerMap();
      },

      {
        intervalMs: 5000,

        onError: () => {
          if (
            trackedRiderId === riderId
          ) {
            renderCustomerMap();
          }
        },
      }
    );
}


function bindCustomerSheet() {
  const panel =
    Yogiyo.el('customerBottomPanel');

  const handle =
    Yogiyo.el('customerSheetHandle');

  if (!panel || !handle) {
    return;
  }

  let startY = null;

  const setExpanded = expanded => {
    panel.classList.toggle(
      'expanded',
      expanded
    );

    handle.setAttribute(
      'aria-expanded',
      String(expanded)
    );

    handle.querySelector('b').textContent =
      expanded
        ? '아래로 끌어 지도 보기'
        : '위로 끌어 주문 상세 보기';
  };

  panel.addEventListener(
    'pointerdown',
    event => {
      if (
        event.target.closest(
          'button, a, input, select, textarea'
        ) &&
        event.target !== handle &&
        !handle.contains(event.target)
      ) {
        return;
      }

      startY = event.clientY;

      panel.setPointerCapture?.(
        event.pointerId
      );
    }
  );

  panel.addEventListener(
    'pointerup',
    event => {
      if (startY == null) {
        return;
      }

      const distance =
        event.clientY - startY;

      if (Math.abs(distance) < 10) {
        setExpanded(
          !panel.classList.contains(
            'expanded'
          )
        );
      } else if (distance < -30) {
        setExpanded(true);
      } else if (distance > 30) {
        setExpanded(false);
      }

      startY = null;
    }
  );

  panel.addEventListener(
    'pointercancel',
    () => {
      startY = null;
    }
  );
}


function renderCustomer(order) {
  currentOrder = order;

  const meta =
    customerStatusMeta(order);

  const assignmentConfirmed =
    hasConfirmedAssignment(order);

  const etaLabel =
    !assignmentConfirmed &&
    ['NEW', 'COOKING'].includes(
      order.status
    )
      ? order.status === 'NEW'
        ? '매장 확인 대기 중'
        : '라이더 수락 대기 중'
      : order.eta_min == null
        ? 'ETA 계산 중'
        : `약 ${Math.ceil(
            order.eta_min
          )}분`;

  const items =
    Array.isArray(order.menu_items)
      ? order.menu_items
      : [];

  Yogiyo.el(
    'orderId'
  ).textContent =
    `내 주문번호 #${order.order_id} · ${
      order.store_name || '매장'
    }`;

  Yogiyo.el(
    'etaWindow'
  ).textContent =
    etaLabel;

  Yogiyo.el(
    'currentMessage'
  ).textContent =
    meta.message;

  Yogiyo.el(
    'deliveryOrder'
  ).textContent =
    meta.label;

  Yogiyo.el(
    'etaUpdated'
  ).textContent =
    '시연 주문 API · 5초 갱신';

  Yogiyo.el(
    'statusBadge'
  ).innerHTML =
    `<span class="dot"></span>${
      Yogiyo.escape(meta.label)
    }`;

  Yogiyo.el(
    'storeName'
  ).textContent =
    order.store_name || '매장';

  Yogiyo.el(
    'orderNumber'
  ).textContent =
    `내 주문번호 #${order.order_id}`;

  Yogiyo.el(
    'menuSummary'
  ).textContent =
    menuSummary(items);

  Yogiyo.el(
    'remainingMin'
  ).textContent =
    etaLabel;

  Yogiyo.el(
    'packageId'
  ).textContent =
    assignmentConfirmed
      ? `배차 번호 ${order.package_id}`
      : hasOfferedPackage(order)
        ? `배차 제안 ${order.package_id} · 라이더 수락 대기`
        : order.status === 'COOKING'
          ? '배차 수락 대기 중'
          : '배차 번호 배정 전';

  [
    ...Yogiyo.el(
      'progressTrack'
    ).children,
  ].forEach(
    (node, index) => {
      node.classList.toggle(
        'active',
        index <= meta.progress
      );
    }
  );

  Yogiyo.el(
    'amount'
  ).textContent =
    Yogiyo.money(order.amount);

  Yogiyo.el(
    'deliveryAddress'
  ).textContent =
    order.delivery_address ||
    '배달지 주소 정보 없음';

  Yogiyo.el(
    'itemsCard'
  ).innerHTML =
    items
      .map(
        item => `
          <div class="row">
            <span class="label">
              ${Yogiyo.escape(
                item.menu
              )}
            </span>

            <span class="value">
              ${item.qty}개 · ${
                Yogiyo.money(
                  item.price
                )
              }
            </span>
          </div>
        `
      )
      .join('') ||
    `
      <div class="subtext">
        메뉴 정보가 없습니다.
      </div>
    `;

  syncRiderLocation(order);

  renderCustomerMap();
  renderCustomerExplanation();

  setContentVisible(true);

  Yogiyo.clearLoadState(
    'customerLoadState'
  );

  setConnection(true);
}


function refreshCustomer(order) {
  renderCustomer(order);
}


async function loadCustomer(
  { silent = false } = {}
) {
  try {
    const order =
      await Yogiyo.apiClient.demo.customerOrder();

    refreshCustomer(order);
  } catch (error) {
    showCustomerFailure(error);

    if (!silent) {
      Yogiyo.toast(
        error.message
      );
    }
  }
}


stopPolling =
  Yogiyo.poll(
    () =>
      Yogiyo.apiClient.demo.customerOrder(),

    order => {
      refreshCustomer(order);
    },

    {
      intervalMs: 5000,

      onError: error => {
        setConnection(false);

        if (!currentOrder) {
          showCustomerFailure(
            error
          );
        }

        console.warn(
          'customer polling failed',
          error
        );
      },
    }
  );


window.addEventListener(
  'beforeunload',
  () => {
    stopPolling?.();
    stopRiderPolling?.();
  },
  { once: true }
);


bindCustomerSheet();