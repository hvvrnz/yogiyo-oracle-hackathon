const storeId = Yogiyo.qs('storeId', Yogiyo.defaultIds.merchant);

let currentMerchant = { orders: [] };
let currentCompleted = { orders: [] };
let activeMerchantTab = 'processing';
let selectedOrderId;
let storeDirectory;
let currentRiderProfile = null;
let latestCookFeedback = null;

const DEFAULT_COOK_MIN = 20;
const MIN_COOK_MIN = 5;
const MAX_COOK_MIN = 40;
const COOK_MIN_STEP = 5;

const cookMinuteDrafts = new Map();

const statusLabels = Object.freeze({ NEW: '신규 주문', COOKING: '조리 중', COOKED: '조리 완료', MATCHED: '배차 완료', PICKED_UP: '배달 중', COMPLETED: '조리 완료', DELIVERED: '배달 완료' });
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

async function getStore() {
  if (storeDirectory) return storeDirectory.find(store => String(store.store_id) === String(storeId));
  try { storeDirectory = (await Yogiyo.apiClient.demo.stores()).stores; } catch { storeDirectory = []; }
  return storeDirectory.find(store => String(store.store_id) === String(storeId));
}

function showFailure(error) {
  setConnection(false);
  Yogiyo.renderLoadState('merchantLoadState', { title: '주문 정보를 불러오지 못했습니다.', description: Yogiyo.errorMessage(error, '매장 주문'), onRetry: loadMerchant });
}

function receiptCard(order) {
  const payment = order.payment;

  const paymentLines = payment ? `
  <div class="row"><span class="label">총 결제금액</span><span class="value">${Yogiyo.money(payment.total_amount)}</span></div>
    <div class="row"><span class="label">배달팁</span><span class="value">${Yogiyo.money(payment.delivery_fee)}</span></div>
    <div class="row"><span class="label">결제수단</span><span class="value">${Yogiyo.escape(payment.payment_method)}</span></div>
    <div class="row"><span class="label">고객 연락처</span><span class="value">${Yogiyo.escape(payment.safety_number)}</span></div>
    <div class="row"><span class="label">현금영수증</span><span class="value">${Yogiyo.escape(payment.cash_receipt)}</span></div>
  ` : '<p class="subtext">결제 정보가 없습니다.</p>';

  return `
    <section class="card">
      <div class="section-title-row">
        <h2>주문 상세</h2>
        <button type="button" class="receipt-print-button" data-print-receipt="${order.order_id}">🧾영수증 출력</button>
      </div>
      ${paymentLines}
    </section>
  `;
}


function openExplanationModal(content) {
  const backdrop = Yogiyo.el('explanationBackdrop');
  const sheet = Yogiyo.el('explanationSheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h2 class="sheet-title">${Yogiyo.escape(content.title)}</h2>
    <ul class="explanation-steps">
      ${content.steps.map(s => `<li>${Yogiyo.escape(s)}</li>`).join('')}
    </ul>
  `;
  backdrop.classList.add('open');
  sheet.classList.add('open');
}

function closeExplanationModal() {
  Yogiyo.el('explanationBackdrop').classList.remove('open');
  Yogiyo.el('explanationSheet').classList.remove('open');
}


function orderListCard(order, { showBadge = true } = {}) {
  const selected = String(order.order_id) === String(selectedOrderId);
  const badge = showBadge
    ? `<span class="badge ${statusTone(order.status)}">${Yogiyo.escape(statusLabels[order.status] || order.status)}</span>`
    : '';
  return `<button type="button" class="merchant-order-item${selected ? ' selected' : ''}" data-order-select="${order.order_id}">
    ${badge}
    <strong class="order-number">YGY07${Yogiyo.escape(order.order_id)}</strong>
    <span class="order-menu-line">${Yogiyo.escape(menuSummary(order.menu_items))} · ${Yogiyo.money(order.amount)}</span>
  </button>`;
}

function orderSummaryBox(order) {
  const items = Array.isArray(order.menu_items) ? order.menu_items : [];
  const first = items[0];
  const title = first
    ? `${Yogiyo.escape(first.menu)} · ${first.qty ?? 1}개`
    : '메뉴 정보 없음';

  const itemLines = items.length > 1
    ? `<ul class="order-summary-items">${items.map(item =>
        `<li>${Yogiyo.escape(item.menu)} ${item.qty ?? 1}개</li>`
      ).join('')}</ul>`
    : '';

  return `
    <div class="order-summary-box">
      <div class="order-summary-title">${title}</div>
      ${itemLines}
    </div>
  `;
}

function orderRequestLines(order) {
  const lines = [];
  if (order.customer_request) lines.push(`<span>[매장 요청사항]: ${Yogiyo.escape(order.customer_request)}</span>`);
  if (order.rider_request) lines.push(`<span>[라이더 요청사항]: ${Yogiyo.escape(order.rider_request)}</span>`);
  if (!lines.length) return '';
  return `<p class="order-request-line">${lines.join('<br/>')}</p>`;
}



function orderComponentLines(order) {
  const items = Array.isArray(order.menu_items) ? order.menu_items : [];
  const components = items[0]?.components || [];
  if (!components.length) return '';

  const lines = components.map(c => {
    const extra = c.price_delta ? ` · +${Yogiyo.money(c.price_delta)}` : '';
    return `<li>${Yogiyo.escape(c.name)} ${c.qty}개${extra}</li>`;
  }).join('');

  return `<ul class="order-component-list">${lines}</ul>`;
}

let latestReference = null; // 파일 상단, latestCookFeedback 선언 근처에 추가

function merchantCookCoach(
  order,
  store,
  cookMinutes
) {
  const feedback =
    order?.cook_feedback ||
    latestCookFeedback;

  const isPostCook =
    ['COOKED', 'MATCHED', 'PICKED_UP', 'DELIVERED'].includes(order?.status);

  /*
   * 조리 완료 이후(라이더 배차 대기~배달완료 전 구간 포함):
   * 예상 vs 실제 피드백
   */
  if (feedback && isPostCook) {
    const ownerMin =
      Number(
        feedback.owner_cook_min
      );

    const actualMin =
      Number(
        feedback.actual_cook_min
      );

    const diff =
      actualMin - ownerMin;

    const diffText =
      diff < 0
        ? `예상보다 ${Math.abs(diff)}분 빨리 완료`
        : diff > 0
          ? `예상보다 ${diff}분 더 소요`
          : '입력값과 실제 시간이 일치';

    return `
      <section
        class="
          merchant-coach-card
          merchant-feedback-card
        "
      >
        <div class="merchant-coach-header">
          <span class="merchant-coach-check">
            ✓
          </span>

          <span class="merchant-coach-eyebrow">
            오늘 조리 기록
          </span>
        </div>

        <h3>
          ${Yogiyo.escape(
            feedback.title ||
            diffText
          )}
        </h3>

        <div class="merchant-time-compare">

          <div>
            <span>입력한 시간</span>
            <strong>
              ${ownerMin}분
            </strong>
          </div>

          <span class="merchant-time-arrow">
            →
          </span>

          <div class="actual">
            <span>실제 조리</span>
            <strong>
              ${actualMin}분
            </strong>
          </div>

        </div>

        <p>
          ${Yogiyo.escape(
            feedback.message || ''
          )}
        </p>

        <div class="merchant-learning-note">
          <span>↗</span>

          <strong>
            ${
              Yogiyo.escape(
                feedback.learning_message ||
                '이번 결과는 다음 조리시간 판단에 활용할 수 있는 실측 데이터예요.'
              )
            }
          </strong>
        </div>

      </section>
    `;
  }


  /*
   * 조리 시작 전 / 조리 중:
   * 신규 매장 Cold Start 참고정보
   */
  const reference = order?.cook_reference;
  if (reference) latestReference = reference;
  const effectiveReference = reference || latestReference;

  if (!effectiveReference) {
    return `
      <section class="merchant-coach-card">
        <div class="merchant-coach-header">
          <span class="merchant-coach-dot"></span>
          <span class="merchant-coach-eyebrow">조리시간 참고</span>
        </div>
        <h3>참고 정보를 불러오는 중이에요.</h3>
      </section>
    `;
  }

  const currentCookMin =
    order.owner_cook_min ??
    cookMinutes;

  const avgMin = Number(effectiveReference.avg_cook_min);
  const currentDiffClass = Math.abs(currentCookMin - avgMin) >= 5 ? 'metric-diff-warn' : 'metric-diff-good';

  return `
    <section class="merchant-coach-card">

      <div class="merchant-coach-header">

        <span class="merchant-coach-dot">
        </span>

        <span class="merchant-coach-eyebrow">
          조리시간 참고
        </span>

      </div>

      <h3>
        ${Yogiyo.escape(
          store?.name ||
          '현재 매장'
        )}은 아직 자체 조리 이력이
        충분하지 않아요.
      </h3>

      <p>
        강남 지역의 같은 버거류 매장
        <strong>
          ${Yogiyo.escape(
            effectiveReference.matched_store_name
          )}
        </strong>
        의 유사 조리 기록을 참고했어요.
      </p>

      <div class="merchant-coach-metrics">

        <div>
          <span>유사 기록</span>
          <strong>
            ${Yogiyo.escape(
              effectiveReference.recent_case_count
            )}건
          </strong>
        </div>

        <div>
          <span>평균 조리</span>
          <strong>
            ${Yogiyo.escape(
              effectiveReference.avg_cook_min
            )}분
          </strong>
        </div>

        <div class="${currentDiffClass}">
          <span>현재 입력</span>
          <strong data-merchant-current-cook>
            ${Yogiyo.escape(
              currentCookMin
            )}분
          </strong>
        </div>

      </div>

      <div class="merchant-coach-source">
        <span>✦</span>

        Oracle AI Vector Search를 통한 예측값이며 참고용으로 사용하시면 됩니다.
      </div>

    </section>
  `;
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

    const canCompleteCooking = order.status === 'COOKING';

    const items = Array.isArray(order.menu_items)
      ? order.menu_items
      : [];
    const riderAssigned = currentRiderProfile && (currentRiderProfile.status === 'BUSY' || ['MATCHED', 'PICKED_UP', 'DELIVERED'].includes(order.status));
    const assignedRider = riderAssigned ? currentRiderProfile : null;

    const cookMinutes =
      cookMinuteDrafts.get(String(order.order_id)) ??
      DEFAULT_COOK_MIN;

    const cookCoach =
      merchantCookCoach(
        order,
        store,
        cookMinutes
      );

    const headRightBlock = `
      <div class="merchant-head-actions">
        
        <div class="cook-time-stepper" style="${isNew ? '' : 'display:none'}">
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
        <button class="primary-button" type="button"
          data-order-accept="${order.order_id}"
          style="${isNew ? '' : 'display:none'}">
          조리 시작
        </button>
        <button class="primary-button" type="button"
          data-order-cook-complete="${order.order_id}"
          style="${canCompleteCooking ? '' : 'display:none'}">
          조리 완료
        </button>
      </div>
    `;
      
    

  root.innerHTML = `
    <div class="merchant-detail-head">
      <div>
        <span class="badge ${statusTone(order.status)}">
          ${Yogiyo.escape(statusLabels[order.status] || order.status)}
        </span>
        <h2>주문 YGY07${Yogiyo.escape(order.order_id)}</h2>
        <p class="order-menu-line">${Yogiyo.escape(menuSummary(order.menu_items))}</p>
        ${orderComponentLines(order)}
        ${orderRequestLines(order)}
      </div>
      ${headRightBlock}
    </div>

    <div class="merchant-detail-scroll">

      ${cookCoach}
           
      ${receiptCard(order)}

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
                <span class="value" data-rider-location>주소 확인 중</span>
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
    </div>
  `;

  const riderLocationNode = root.querySelector('[data-rider-location]');

  if (assignedRider && riderLocationNode) {
    Promise.resolve(Yogiyo.reverseGeocode?.(assignedRider.lat, assignedRider.lng))
      .then(address => {
        if (!riderLocationNode.isConnected) return;
        riderLocationNode.textContent = address || '주소를 확인할 수 없습니다.';
      })
      .catch(() => {
        if (!riderLocationNode.isConnected) return;
        riderLocationNode.textContent = '주소를 확인할 수 없습니다.';
      });
  }

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

    const currentCookNode =
      root.querySelector(
        '[data-merchant-current-cook]'
      );

    if (currentCookNode) {
      currentCookNode.textContent =
        `${next}분`;
    }
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

    const currentCookNode =
      root.querySelector(
        '[data-merchant-current-cook]'
      );

    if (currentCookNode) {
      currentCookNode.textContent =
        `${next}분`;
    }
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

  // // 처리완료 탭 내부 건수
  // Yogiyo.el('completedOrderCount').textContent =
  //   `${completedOrders.length}건`;

  // 신규 주문
  Yogiyo.el('newOrderList').innerHTML =
    newOrders.map(order => orderListCard(order, { showBadge: false })).join('') ||
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
    const [processingView, completedView, store, riderProfile] = await Promise.all([
      Yogiyo.apiClient.demo.merchantOrders(),
      Yogiyo.apiClient.demo.merchantCompleted(),
      getStore(),
      Yogiyo.apiClient.demo.riderProfile(),
    ]);

    currentRiderProfile = riderProfile;
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
        `주문 YGY07${orderId}의 조리를 시작했습니다.`
      );

      await loadMerchant();
    } catch (error) {
      Yogiyo.toast(error.message);
    }
  });
}

async function completeCooking(
  orderId,
  button
) {
  await Yogiyo.withPending(
    button,
    async () => {
      try {
        const result =
          await Yogiyo.apiClient.demo
            .merchantCookComplete();


        latestCookFeedback =
          result.cook_feedback ||
          null;


        if (
          result.feedback_message
        ) {
          Yogiyo.toast(
            result.feedback_message
          );

        } else {
          Yogiyo.toast(
            `주문 YGY07${orderId}의 조리가 완료되었습니다.`
          );
        }


        await loadMerchant();

      } catch (error) {
        Yogiyo.toast(
          error.message
        );
      }
    }
  );
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
  () => Promise.all([
    Yogiyo.apiClient.demo.merchantOrders(),
    Yogiyo.apiClient.demo.merchantCompleted(),
    getStore(),
    Yogiyo.apiClient.demo.riderProfile(),
  ]),
  ([processingView, completedView, store, riderProfile]) => {
    currentRiderProfile = riderProfile;
    renderMerchant(processingView, completedView, store);
    setConnection(true);
  },
  {
    intervalMs: 5000,
    onError: () => setConnection(false),
  }
);

loadMerchant();