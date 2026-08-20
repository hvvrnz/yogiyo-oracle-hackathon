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

const orderCardStatus = {
  NEW: '주문 접수',
  COOKING: '음식 조리 중',
  MATCHING: '배차 진행 중',
  MATCHED: '배차 완료',
  PICKED_UP: '배달 중',
  DELIVERED: '배달 완료',
  COMPLETED: '배달 완료',
};

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
    label: '주문이 접수되었어요!',
    progress: 0,
    message:
      '매장에서 주문을 확인하고 있어요.',
  },

  COOKING: {
    label: '음식 조리 중',
    progress: 1,
    message:
      '라이더 배정이 확정되면 정확한 도착 시간을 알려드릴게요',
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
        ? '실시간 조회 중'
        : '재연결 필요';
  }
}

function formatOrderCode(orderId) {
  return `YGY07${orderId}`;
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

function menuOneLineSummary(items) {
  if (!Array.isArray(items) || !items.length) return '메뉴 정보가 없습니다.';
  const first = items[0].menu;
  const restCount = items.length - 1;
  return restCount > 0 ? `${first} 외 ${restCount}개` : first;
}


function renderCustomerExplanation() {
  const section = Yogiyo.el(
    'customerExplanationSection'
  );
  const content = Yogiyo.el(
    'customerExplanationContent'
  );

  if (!section || !content) return;

  const status =
    currentOrder?.status || '';

  const shouldShow =
    ['MATCHED', 'PICKED_UP', 'DELIVERED'].includes(
      status
    );

  if (!shouldShow) {
    section.hidden = true;
    content.innerHTML = '';
    return;
  }

  let eyebrow = '요기요 고객님을 위한 맞춤 배달 안내';
  let headline =
    '음식이 조리된 뒤 오래 기다리지 않도록\n'
    + '배달 순서를 최적화했어요.';
  let bodyLines = [
    '조리시간과 라이더 이동 동선을 함께 계산했어요.',
    '음식이 완성된 뒤 매장에서 오래 기다리지 않도록\n'
    +'픽업 시점을 맞췄어요.',
    '더 따뜻하고 신선한 상태로 전달해드릴게요.',
  ];

  if (status === 'PICKED_UP') {
    eyebrow = '요기요 고객님을 위한 맞춤 배달 안내';
    headline =
      '음식이 조리된 직후 빠르게 픽업되어\n'
      +'고객님께 이동 중이에요.';
    bodyLines = [
      '조리 완료 시점과 라이더 도착 시점을 함께 고려했어요.',
      '조금만 기다리시면 받아보실 수 있어요.',
    ];
  }

  if (status === 'DELIVERED') {
    eyebrow = '요기요 고객님을 위한 맞춤 배달 완료';
    headline =
      '조리 후 대기 시간을 줄이도록 계산된 동선으로 배달이 완료되었어요.';
    bodyLines = [
      '조리시간과 라이더 이동 순서를 함께 고려해 배달했어요.',
      '음식이 완성된 뒤 오래 기다리지 않도록 순서를 조정했어요.',
      '더 안정적인 상태로 받아보실 수 있도록 설계했어요.',
    ];
  }

  content.innerHTML = `
    <div class="customer-guide-card">
      <div class="customer-guide-header">
        <span class="customer-guide-dot"></span>
        <span class="customer-guide-eyebrow">${Yogiyo.escape(
          eyebrow
        )}</span>
      </div>

      <p class="customer-guide-headline">
        ${Yogiyo.escape(headline)}
      </p>

      <ul class="customer-guide-points">
        ${bodyLines
          .map(
            line => `
              <li>${Yogiyo.escape(line)}</li>
            `
          )
          .join('')}
      </ul>
    </div>
  `;

  section.hidden = false;
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
  if (!order) return Yogiyo.mapData.create();
  return Yogiyo.mapData.fromCustomerOrder(order);
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
        ? `라이더님이 매장으로 이동 중이에요!`
        : `라이더 ${
            currentOrder.rider_id
          } 위치 확인 중`
      : '라이더 배정 전';
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
        ? '주문 상세 보기'
        : '주문 상세 보기';
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

// 임의 성절 시간
// function etaBaseMinutes() {
//   return 17 * 60 + 21;
// }

// 실제 시간 반영
function etaBaseMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function formatArrivalEta(etaMin) {
  const remainingMin = Math.max(0, Math.ceil(Number(etaMin)));
  const arrivalTotalMin = (etaBaseMinutes() + remainingMin) % (24 * 60);
  const hour = Math.floor(arrivalTotalMin / 60);
  const minute = arrivalTotalMin % 60;

  return `🍳 ${remainingMin}분 뒤 도착 예정 (${String(hour).padStart(2, '0')}시 ${String(minute).padStart(2, '0')}분)`;
}

function renderCustomer(order) {
  currentOrder = order;

  const meta =
    customerStatusMeta(order);

  const assignmentConfirmed =
    hasConfirmedAssignment(order);

  const etaLabel = ['DELIVERED', 'COMPLETED'].includes(order.status)
  ? '배달 완료'
  : !assignmentConfirmed && ['NEW', 'COOKING'].includes(order.status)
    ? order.status === 'NEW'
      ? '매장에서 주문을 확인하고 있어요.'
      : '가장 가까운 라이더님을 찾고 있어요. 🛵'
    : order.eta_min == null
      ? '도착 예정 시간 확인 중'
      : formatArrivalEta(order.eta_min);

  const items =
    Array.isArray(order.menu_items)
      ? order.menu_items
      : [];

  Yogiyo.el('orderId').textContent =
  `${order.store_name || '매장'} 주문 조회`;

  const etaWindow =
    Yogiyo.el('etaWindow');

  etaWindow.textContent =
    etaLabel;

  etaWindow.classList.toggle(
    'is-loading',
    order.status === 'NEW'
  );


  Yogiyo.el(
    'etaUpdated'
  ).textContent =
    orderCardStatus[order.status] ||
    '상태 확인 중';

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

  Yogiyo.el('orderNumber').textContent =
  `주문번호 ${formatOrderCode(order.order_id)}`;

  Yogiyo.el(
    'menuSummary'
  ).textContent =
    menuSummary(items);


  Yogiyo.el(
    'packageId'
  ).textContent =
    assignmentConfirmed
      ? `배차 번호 ${order.package_id}`
      : hasOfferedPackage(order)
        ? `배차 제안 ${order.package_id} · 라이더 수락 대기`
        : order.status === 'COOKING'
          ? '배차 수락 대기 중'
          : '';
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

  // Yogiyo.el(
  //   'amount'
  // ).textContent =
  //   Yogiyo.money(order.amount);

  Yogiyo.el(
    'deliveryAddress'
  ).textContent =
    order.delivery_address ||
    '배달지 주소 정보 없음';

  const payment = order.payment;

  Yogiyo.el('deliveryTip').textContent =
    payment ? Yogiyo.money(payment.delivery_fee) : '-';

  Yogiyo.el('totalAmount').textContent =
    payment ? Yogiyo.money(payment.total_amount) : Yogiyo.money(order.amount);

  Yogiyo.el('paymentMethod').textContent =
    payment ? payment.payment_method : '-';

  Yogiyo.el('safetyNumber').textContent =
    payment ? payment.safety_number : '-';

  Yogiyo.el(
    'itemsCard'
  ).innerHTML = `
    <div class="row">
      <span class="label">메뉴</span>
      <span class="value">${Yogiyo.escape(menuOneLineSummary(items))}</span>
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