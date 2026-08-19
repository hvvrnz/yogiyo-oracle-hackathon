const storeId = Yogiyo.qs('storeId', Yogiyo.defaultIds.merchant);

let currentMerchant = { orders: [] };
let currentCompleted = { orders: [] };
let activeMerchantTab = 'processing';
let selectedOrderId;
let storeDirectory;
let currentRiderProfile = null;
let currentRiderPackages = [];

const DEFAULT_COOK_MIN = 20;
const MIN_COOK_MIN = 5;
const MAX_COOK_MIN = 40;
const COOK_MIN_STEP = 5;

const cookMinuteDrafts = new Map();

const statusLabels = Object.freeze({ NEW: '신규 주문', COOKING: '조리 중', COOKED: '조리 완료', MATCHED: '배차 완료', PICKED_UP: '픽업 완료', COMPLETED: '조리 완료', DELIVERED: '배달 완료' });
const statusTone = status =>
  status === 'NEW'
    ? 'info'
    : status === 'COOKING'
      ? 'warn'
      : ['COMPLETED', 'DELIVERED'].includes(status)
        ? 'good'
        : 'brand';
const setConnection = online => { const node = Yogiyo.el('connection'); node.classList.toggle('online', online); node.classList.toggle('offline', !online); node.querySelector('span').textContent = online ? '영업중' : '연결 확인 필요'; };
const menuSummary = items => (Array.isArray(items) ? items : []).map(item => `${item.menu}${item.qty > 1 ? ` ${item.qty}개` : ''}`).join(' · ') || '메뉴 정보 없음';
const assignedPackageForOrder = orderId => currentRiderPackages.find(pkg => (pkg.order_ids || []).some(id => String(id) === String(orderId)));
const riderLocationLabel = rider => Number.isFinite(Number(rider?.lat)) && Number.isFinite(Number(rider?.lng)) ? `${Number(rider.lat).toFixed(5)}, ${Number(rider.lng).toFixed(5)}` : '위치 확인 중';

async function getStore() {
  if (storeDirectory) return storeDirectory.find(store => String(store.store_id) === String(storeId));
  try { storeDirectory = (await Yogiyo.apiClient.demo.stores()).stores; } catch { storeDirectory = []; }
  return storeDirectory.find(store => String(store.store_id) === String(storeId));
}

function showFailure(error) {
  setConnection(false);
  Yogiyo.renderLoadState('merchantLoadState', { title: '주문 정보를 불러오지 못했습니다.', description: Yogiyo.errorMessage(error, '매장 주문'), onRetry: loadMerchant });
}

function orderListCard(order) {
  const selected = String(order.order_id) === String(selectedOrderId);
  return `<button type="button" class="merchant-order-item${selected ? ' selected' : ''}" data-order-select="${order.order_id}"><span class="badge ${statusTone(order.status)}">${Yogiyo.escape(statusLabels[order.status] || order.status)}</span><strong>${Yogiyo.escape(menuSummary(order.menu_items))}</strong><span>주문 #${Yogiyo.escape(order.order_id)} · ${Yogiyo.money(order.amount)}</span></button>`;
}

function renderDetail(order, store, view={}) {
  const root = Yogiyo.el('merchantOrderDetail');

  if (!order) {
  root.innerHTML = `
    <div class="state-card empty">
      <div class="state-icon">✓</div>
      <div>
        <strong>
          ${Yogiyo.escape(
            view.message || '현재 조리할 주문이 없습니다.'
          )}
        </strong>

        ${
          view.merchant_text
            ? `
              <p>
                ${Yogiyo.escape(view.merchant_text)}
              </p>
            `
            : `
              <p>
                ${Yogiyo.escape(
                  view.empty_description ||
                  '새 주문이 들어오면 이곳에 표시됩니다.'
                )}
              </p>
            `
        }
      </div>
    </div>
  `;

  return;
}

    const isNew = order.status === 'NEW';

    const canCompleteCooking =
      ['COOKING', 'MATCHED'].includes(order.status);

    const items = Array.isArray(order.menu_items)
      ? order.menu_items
      : [];
    const assignedPackage = assignedPackageForOrder(order.order_id);
    const assignedRider = assignedPackage ? currentRiderProfile : null; 

    const cookMinutes =
      cookMinuteDrafts.get(String(order.order_id)) ??
      DEFAULT_COOK_MIN;

    const actionButtons = isNew
      ? `
        <div class="merchant-decision-actions">
          <div class="cook-time-stepper">
            <button type="button" class="stepper-button" data-stepper-decrease="${order.order_id}">-</button>

            <input
              type="number"
              data-cook-minutes="${order.order_id}"
              value="${cookMinutes}"
              min="${MIN_COOK_MIN}"
              max="${MAX_COOK_MIN}"
              step="${COOK_MIN_STEP}"
              readonly
            />

            <span>분</span>

            <button type="button" class="stepper-button" data-stepper-increase="${order.order_id}">+</button>
          </div>

          <button
            class="primary-button"
            type="button"
            data-order-accept="${order.order_id}">
            조리 시작
          </button>
        </div>
      `
      : canCompleteCooking
        ? `
          <div class="merchant-decision-actions">
            <button
              class="primary-button"
              type="button"
              data-order-cook-complete="${order.order_id}">
              조리 완료
            </button>
          </div>
        `
        : '';

  root.innerHTML = `
    <div class="merchant-detail-head">
      <div>
        <span class="badge ${statusTone(order.status)}">
          ${Yogiyo.escape(statusLabels[order.status] || order.status)}
        </span>
        <h2>주문 #${Yogiyo.escape(order.order_id)}</h2>
        <p>${Yogiyo.escape(store?.name || '매장 주문')}</p>
      </div>
      <strong>${Yogiyo.money(order.amount)}</strong>
    </div>

    ${actionButtons}

    <div class="merchant-detail-scroll">
      <section class="card">
        <div class="section-title-row">
          <h2>주문 내역</h2>
          <span>총 ${Yogiyo.money(order.amount)}</span>
        </div>

        ${
          items.map(item => `
            <div class="row">
              <span class="label">
                ${Yogiyo.escape(item.menu)}
              </span>
              <span class="value">
                ${item.qty}개 · ${Yogiyo.money(item.price)}
              </span>
            </div>
          `).join('')
          ||
          '<p class="subtext">메뉴 정보가 없습니다.</p>'
        }
      </section>

      <section class="card">
        <div class="section-title-row">
          <h2>조리 정보</h2>
        </div>

        <div class="row">
          <span class="label">사장님 입력 조리시간</span>
          <span class="value">
            ${
              order.owner_cook_min
                ? `${order.owner_cook_min}분`
                : view.isCompletedTab
                  ? '기록 없음'
                  : '수락 후 입력'
            }
          </span>
        </div>
      </section>

      <section class="card merchant-rider-card">
        <div class="section-title-row">
          <h2>라이더 정보</h2>
        </div>

        ${
          assignedRider
            ? `
              <div class="row">
                <span class="label">라이더 ID</span>
                <span class="value">${Yogiyo.escape(assignedRider.rider_id || '-')}</span>
              </div>

              <div class="row">
                <span class="label">라이더 이름</span>
                <span class="value">${Yogiyo.escape(assignedRider.name || '-')}</span>
              </div>

              <div class="row">
                <span class="label">현재 위치</span>
                <span class="value">${Yogiyo.escape(riderLocationLabel(assignedRider))}</span>
              </div>

              <div class="row">
                <span class="label">활동 지역</span>
                <span class="value">${Yogiyo.escape(assignedRider.region || '-')}</span>
              </div>

              <div class="row">
                <span class="label">현재 상태</span>
                <span class="value">${Yogiyo.escape(assignedRider.status || '-')}</span>
              </div>
            `
            : `
              <p class="merchant-rider-empty">
                배차 지정된 라이더가 없습니다.
              </p>
            `
        }
      </section>

      ${
        order.merchant_text
          ? `
            <section class="notice llm-guidance merchant-ai-guidance">
              <span>✦</span>
              <div>
                <strong>AI 조리 안내</strong>
                <span>
                  ${Yogiyo.escape(order.merchant_text)}
                </span>
              </div>
            </section>
          `
          : ''
      }
    </div>
  `;

  root
    .querySelector('[data-order-accept]')
    ?.addEventListener('click', event => {
      acceptOrder(
        Number(event.currentTarget.dataset.orderAccept),
        event.currentTarget
      );
    });

    root
  .querySelector('[data-order-cook-complete]')
  ?.addEventListener('click', event => {
    completeCooking(
      Number(event.currentTarget.dataset.orderCookComplete),
      event.currentTarget
    );
  });

  root
  .querySelector('[data-stepper-decrease]')
  ?.addEventListener('click', event => {
    const orderId =
      event.currentTarget.dataset.stepperDecrease;

    const input =
      root.querySelector(
        `[data-cook-minutes="${orderId}"]`
      );

    if (!input) return;

    const current = Number(input.value);
    const next = Math.max(
      MIN_COOK_MIN,
      current - COOK_MIN_STEP
    );

    input.value = next;
    cookMinuteDrafts.set(String(orderId), next);
  });

  root
  .querySelector('[data-stepper-increase]')
  ?.addEventListener('click', event => {
    const orderId =
      event.currentTarget.dataset.stepperIncrease;

    const input =
      root.querySelector(
        `[data-cook-minutes="${orderId}"]`
      );

    if (!input) return;

    const current = Number(input.value);
    const next = Math.min(
      MAX_COOK_MIN,
      current + COOK_MIN_STEP
    );

    input.value = next;
    cookMinuteDrafts.set(String(orderId), next);
  });
  

}

function renderMerchant(processingView, completedView, store) {
  currentMerchant = processingView || { orders: [] };
  currentCompleted = completedView || { orders: [] };

  const rawProcessingOrders = Array.isArray(currentMerchant.orders)
    ? currentMerchant.orders
    : [];

  const completedOrders = Array.isArray(currentCompleted.orders)
    ? currentCompleted.orders
    : [];

  const completedOrderIds = new Set(
    completedOrders.map(order => String(order.order_id))
  );

  const processingOrders = rawProcessingOrders.filter(
    order => !completedOrderIds.has(String(order.order_id))
  );

  const activeOrders =
    activeMerchantTab === 'completed'
      ? completedOrders
      : processingOrders;

  const newOrders = processingOrders.filter(
    order => order.status === 'NEW'
  );

  const progressOrders = processingOrders.filter(
    order => order.status !== 'NEW'
  );

  if (
    !activeOrders.some(
      order =>
        String(order.order_id) ===
        String(selectedOrderId)
    )
  ) {
    selectedOrderId = activeOrders[0]?.order_id;
  }

  Yogiyo.el('merchantStoreName').textContent =
    store?.name || `매장 ${storeId}`;

  Yogiyo.el('merchantStoreMeta').textContent =
    [store?.category, store?.region]
      .filter(Boolean)
      .join(' · ') || '주문 처리 현황';

  // 상단 탭 건수
  Yogiyo.el('processingCount').textContent =
    processingOrders.length;

  Yogiyo.el('completedCount').textContent =
    completedOrders.length;

  // 처리중 탭 내부 건수
  Yogiyo.el('newOrderCount').textContent =
    `${newOrders.length}건`;

  Yogiyo.el('progressOrderCount').textContent =
    `${progressOrders.length}건`;

  // 처리완료 탭 내부 건수
  Yogiyo.el('completedOrderCount').textContent =
    `${completedOrders.length}건`;

  // 신규 주문
  Yogiyo.el('newOrderList').innerHTML =
    newOrders.map(orderListCard).join('') ||
    '<p class="merchant-empty-copy">신규 주문이 없습니다.</p>';

  // 진행 중 주문
  Yogiyo.el('progressOrderList').innerHTML =
    progressOrders.map(orderListCard).join('') ||
    '<p class="merchant-empty-copy">진행 중인 주문이 없습니다.</p>';

  // 처리 완료 주문
  Yogiyo.el('completedOrderList').innerHTML =
    completedOrders.map(orderListCard).join('') ||
    '<p class="merchant-empty-copy">처리 완료된 주문이 없습니다.</p>';

  // 현재 선택된 탭에 맞는 목록만 표시
  Yogiyo.el('merchantProcessingList').hidden =
    activeMerchantTab !== 'processing';

  Yogiyo.el('merchantCompletedList').hidden =
    activeMerchantTab !== 'completed';

  // 상단 탭 active 상태 갱신
  document
    .querySelectorAll('[data-merchant-tab]')
    .forEach(button => {
      const active =
        button.dataset.merchantTab === activeMerchantTab;

      button.classList.toggle('active', active);
      button.setAttribute(
        'aria-selected',
        String(active)
      );
    });

  // 주문 선택
  document
    .querySelectorAll('[data-order-select]')
    .forEach(button => {
      button.addEventListener('click', () => {
        selectedOrderId =
          Number(button.dataset.orderSelect);

        renderMerchant(
          currentMerchant,
          currentCompleted,
          store
        );
      });
    });

  const selectedOrder = activeOrders.find(
    order =>
      String(order.order_id) ===
      String(selectedOrderId)
  );

  const detailView =
    activeMerchantTab === 'completed'
      ? {
          ...currentCompleted,
          isCompletedTab: true,
          message: '처리 완료된 주문이 없습니다.',
          empty_description:
            '라이더가 픽업한 주문이 이곳에 표시됩니다.',
        }
      : {
          ...currentMerchant,
          message:
            processingOrders.length === 0
              ? '현재 처리중인 주문이 없습니다.'
              : currentMerchant.message,
          empty_description:
            '새 주문이 들어오면 이곳에 표시됩니다.',
        };

  renderDetail(
    selectedOrder,
    store,
    detailView
  );

  Yogiyo.clearLoadState('merchantLoadState');
}

async function loadMerchant() {
  try {
    const [processingView, completedView, store, riderProfile, riderPackagesView] = await Promise.all([
      Yogiyo.apiClient.demo.merchantOrders(),
      Yogiyo.apiClient.demo.merchantCompleted(),
      getStore(),
      Yogiyo.apiClient.demo.riderProfile(),
      Yogiyo.apiClient.demo.riderPackages(),
    ]);

    currentRiderProfile = riderProfile;
    currentRiderPackages = Array.isArray(riderPackagesView.packages) ? riderPackagesView.packages : [];

    renderMerchant(
      processingView,
      completedView,
      store
    );

    setConnection(true);
  } catch (error) {
    showFailure(error);
    Yogiyo.toast(error.message);
  }
}

async function acceptOrder(orderId, button) {
  
  const stepperInput =
  document.querySelector(
    `[data-cook-minutes="${orderId}"]`
  );

const minutes = Number(
  stepperInput?.value ??
  cookMinuteDrafts.get(String(orderId)) ??
  DEFAULT_COOK_MIN
);



if (
  !Number.isInteger(minutes) ||
  minutes < MIN_COOK_MIN ||
  minutes > MAX_COOK_MIN ||
  minutes % COOK_MIN_STEP !== 0
) {
  Yogiyo.toast(
    '조리시간은 5분 단위로 5분에서 40분 사이에서 선택해 주세요.'
  );
  return;
}


  await Yogiyo.withPending(button, async () => {
    try {
      await Yogiyo.apiClient.demo.merchantCookStart(minutes);

      cookMinuteDrafts.delete(String(orderId));

      Yogiyo.toast(
        `주문 #${orderId}의 조리를 시작했습니다.`
      );

      await loadMerchant();
    } catch (error) {
      Yogiyo.toast(error.message);
    }
  });
}

async function completeCooking(orderId, button) {
  await Yogiyo.withPending(button, async () => {
    try {
      const result =
        await Yogiyo.apiClient.demo.merchantCookComplete();

      if (result.rerouted) {
        Yogiyo.toast('경로가 재조정되었습니다.');
      } else if (result.message) {
        Yogiyo.toast(result.message);
      } else {
        Yogiyo.toast(
          `주문 #${orderId}의 조리가 완료되었습니다.`
        );
      }

      await loadMerchant();
    } catch (error) {
      Yogiyo.toast(error.message);
    }
  });
}

document
  .querySelectorAll('[data-merchant-tab]')
  .forEach(button => {
    button.addEventListener('click', async () => {
      const nextTab =
        button.dataset.merchantTab;

      if (
        !['processing', 'completed'].includes(nextTab) ||
        nextTab === activeMerchantTab
      ) {
        return;
      }

      activeMerchantTab = nextTab;
      selectedOrderId = undefined;

      renderMerchant(
        currentMerchant,
        currentCompleted,
        await getStore()
      );
    });
  });

Yogiyo.poll(
  async () => {
    const [processingView, completedView, riderProfile, riderPackagesView] = await Promise.all([
      Yogiyo.apiClient.demo.merchantOrders(),
      Yogiyo.apiClient.demo.merchantCompleted(),
      Yogiyo.apiClient.demo.riderProfile(),
      Yogiyo.apiClient.demo.riderPackages(),
    ]);

    return { processingView, completedView, riderProfile, riderPackagesView };
  },

  async ({ processingView, completedView, riderProfile, riderPackagesView }) => {
  currentRiderProfile = riderProfile;
  currentRiderPackages = Array.isArray(riderPackagesView.packages) ? riderPackagesView.packages : [];
    renderMerchant(
      processingView,
      completedView,
      await getStore()
    );

    setConnection(true);
  },

  {
    intervalMs: 5000,
    onError: showFailure
  }
);