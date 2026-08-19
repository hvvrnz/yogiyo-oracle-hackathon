const mockMode = Yogiyo.useMock;

const demoStartupQuery = new URLSearchParams(location.search);

if (mockMode && !demoStartupQuery.has('keepMock')) {
  Yogiyo.resetMock();
}


/* -------------------------------------------------------------------------- */
/* 시연 모드 안내                                                               */
/* -------------------------------------------------------------------------- */

const controlRoot = document.querySelector('.control-groups');

if (controlRoot) {
  controlRoot.innerHTML = mockMode
    ? `
      <section class="control-subpanel">
        <h3>개발용 목업 모드</h3>
        <p
          style="
            color:#b7b7c1;
            font-size:11px;
            margin:0;
            line-height:1.6;
          "
        >
          브라우저에 저장된 목업 데이터를 사용합니다.
          화면별 상태 변경은 실제 서버에 반영되지 않습니다.
        </p>
      </section>
    `
    : `
      <section class="control-subpanel">
        <h3>실제 서버 시연 모드</h3>
        <p
          style="
            color:#b7b7c1;
            font-size:11px;
            margin:0;
            line-height:1.6;
          "
        >
          시연 진입 시 데이터를 초기화하고,
          주문 90001 · 패키지 80001 · 라이더 rider_12를 기준으로
          고객·사장님·라이더 화면을 연결합니다.
        </p>
      </section>
    `;
}


Yogiyo.el('demoModeDescription').textContent = mockMode
  ? '개발용 목업 모드입니다. 화면별 상태 변경은 브라우저 목업 데이터에만 반영됩니다.'
  : '실제 시연 API 모드입니다. 각 역할 화면은 현재 서버 상태를 주기적으로 갱신합니다.';


Yogiyo.el('backendDocsLink').hidden = mockMode;

Yogiyo.el('connectionText').textContent = mockMode
  ? '개발용 목업 데이터'
  : '실제 REST API 연결';


/* -------------------------------------------------------------------------- */
/* 숨겨진 시연 요약 정보                                                        */
/* -------------------------------------------------------------------------- */

Yogiyo.el('summaryStatus').textContent = mockMode
  ? '목업 데이터'
  : '실제 API';

Yogiyo.el('summaryOrders').textContent =
  '주문 90001';

Yogiyo.el('summaryDuration').textContent =
  '5초 폴링';

Yogiyo.el('summaryStrategy').textContent = mockMode
  ? '브라우저 저장소'
  : '조리 → 배차 → 픽업·배달';

Yogiyo.el('summaryRevenue').textContent =
  'rider_12';

Yogiyo.el('summaryRider').textContent =
  '조리 시작 후 AI 배차 제안';

Yogiyo.el('summaryVersion').textContent = mockMode
  ? 'VITE_USE_MOCK=true'
  : '실제 API';


/* -------------------------------------------------------------------------- */
/* 숨겨진 이벤트 로그 초기화                                                     */
/* -------------------------------------------------------------------------- */

Yogiyo.el('eventList').innerHTML = mockMode
  ? `
    <div class="event">
      <code>MOCK_MODE</code>
      <span>
        백엔드 없이 개발용 목업 데이터로 화면 흐름을 확인하고 있습니다.
      </span>
      <time>LOCAL</time>
    </div>
  `
  : `
    <div class="event">
      <code>REAL_API_MODE</code>
      <span>
        최종 시연 API를 사용하여 고객·사장님·라이더 화면을 연결합니다.
      </span>
      <time>REST</time>
    </div>
  `;


/* -------------------------------------------------------------------------- */
/* 최종 시연 대상                                                               */
/* -------------------------------------------------------------------------- */

let demoSelectionRequestId = 0;

/*
 * 최종 시연 API의 라이더는 rider_12로 고정합니다.
 *
 * GET /api/demo/rider/profile
 * GET /api/demo/rider/offers
 * GET /api/demo/rider/next-stop
 * POST /api/demo/rider/arrive
 */
const demoRiderId = 'rider_12';


/* -------------------------------------------------------------------------- */
/* iframe 제어                                                                  */
/* -------------------------------------------------------------------------- */

const setDemoPanel = (
  frameId,
  linkId,
  titleId,
  url,
  title
) => {
  Yogiyo.el(frameId).src = url;
  Yogiyo.el(linkId).href = url;
  Yogiyo.el(titleId).textContent = title;
};


const refreshDemoFrame = frameId => {
  const frame = Yogiyo.el(frameId);

  try {
    frame.contentWindow.location.reload();
  } catch {
    frame.src = frame.src;
  }
};


/* -------------------------------------------------------------------------- */
/* 이벤트 로그                                                                  */
/* -------------------------------------------------------------------------- */

const appendDemoEvent = (code, message) => {
  const time = new Date().toLocaleTimeString(
    'ko-KR',
    {
      hour: '2-digit',
      minute: '2-digit'
    }
  );

  Yogiyo.el('eventList').insertAdjacentHTML(
    'afterbegin',
    `
      <div class="event">
        <code>${Yogiyo.escape(code)}</code>
        <span>${Yogiyo.escape(message)}</span>
        <time>${Yogiyo.escape(time)}</time>
      </div>
    `
  );
};


/* -------------------------------------------------------------------------- */
/* 라이더 배차 수락 → 고객·사장님 화면 즉시 반영                                 */
/* -------------------------------------------------------------------------- */

window.addEventListener('message', event => {
  const riderFrame = Yogiyo.el('demoRiderFrame');

  if (
    event.origin !== window.location.origin ||
    event.source !== riderFrame.contentWindow
  ) {
    return;
  }

  const {
    type,
    packageId,
    riderId,
    orderIds
  } = event.data || {};

  if (type !== 'ygy:package-accepted') {
    return;
  }


  /*
   * 고객 화면에는 배차 수락 이벤트를 전달합니다.
   * 실제 주문 상태는 /api/demo/customer/order에서 다시 조회합니다.
   */
  Yogiyo.el('demoCustomerFrame')
    .contentWindow
    ?.postMessage(
      {
        type: 'ygy:customer-package-accepted',
        packageId,
        riderId,
        orderIds: Array.isArray(orderIds)
          ? orderIds
          : []
      },
      window.location.origin
    );


  /*
   * 사장님 화면은
   * GET /api/demo/merchant/next-to-cook
   * 결과를 즉시 다시 조회할 수 있도록 새로고침합니다.
   */
  refreshDemoFrame('demoMerchantFrame');


  const message =
    `패키지 ${packageId}를 ${riderId}가 수락했습니다. ` +
    '고객·사장님 화면을 즉시 갱신했습니다.';


  appendDemoEvent(
    'PACKAGE_ACCEPTED',
    message
  );


  Yogiyo.el(
    'simulationAnnouncement'
  ).textContent = message;


  Yogiyo.toast(
    '배차 수락 상태를 고객·사장님 화면에 즉시 반영했습니다.'
  );
});


/* -------------------------------------------------------------------------- */
/* 통합 시연 초기화                                                             */
/* -------------------------------------------------------------------------- */

const loadDemoPanels = async () => {
  const requestId = ++demoSelectionRequestId;
  const riderId = demoRiderId;

  try {
    /*
     * 최종 API
     *
     * POST /api/demo/reset
     */
    await Yogiyo.apiClient.demo.reset();

    sessionStorage.removeItem('ygy-demo-completed-packages');
    sessionStorage.removeItem('ygy-demo-accepted-package');

    if (requestId !== demoSelectionRequestId) {
      return;
    }


    /*
     * 고객
     *
     * GET /api/demo/customer/order
     */
    setDemoPanel(
      'demoCustomerFrame',
      'demoCustomerLink',
      'demoCustomerTitle',
      '/customer',
      '고객 · 주문 90001'
    );


    /*
     * 사장님
     *
     * GET  /api/demo/merchant/next-to-cook
     * POST /api/demo/merchant/cook-start
     */
    setDemoPanel(
      'demoMerchantFrame',
      'demoMerchantLink',
      'demoMerchantTitle',
      '/merchant',
      '사장님 · 매장 889'
    );


    /*
     * 라이더
     *
     * GET  /api/demo/rider/profile
     * GET  /api/demo/rider/offers
     * PUT  /api/demo/rider/package/{package_id}/accept
     * GET  /api/demo/rider/next-stop
     * POST /api/demo/rider/arrive
     */
    setDemoPanel(
      'demoRiderFrame',
      'demoRiderLink',
      'demoRiderTitle',
      `/rider?riderId=${encodeURIComponent(riderId)}`,
      `라이더 · ${riderId}`
    );


    appendDemoEvent(
      'DEMO_RESET',
      '시연 데이터를 초기화했습니다. 주문 90001, 패키지 80001, rider_12를 기준으로 시작합니다.'
    );
  } catch (error) {
    if (requestId !== demoSelectionRequestId) {
      return;
    }


    setDemoPanel(
      'demoCustomerFrame',
      'demoCustomerLink',
      'demoCustomerTitle',
      '/customer',
      '고객 · 시연 연결 실패'
    );


    setDemoPanel(
      'demoMerchantFrame',
      'demoMerchantLink',
      'demoMerchantTitle',
      '/merchant',
      '사장님 · 시연 연결 실패'
    );


    setDemoPanel(
      'demoRiderFrame',
      'demoRiderLink',
      'demoRiderTitle',
      `/rider?riderId=${encodeURIComponent(riderId)}`,
      `라이더 · ${riderId} · 시연 연결 실패`
    );


    appendDemoEvent(
      'DEMO_RESET_FAILED',
      Yogiyo.errorMessage(
        error,
        '시연 데이터 초기화'
      )
    );


    Yogiyo.toast(
      Yogiyo.errorMessage(
        error,
        '시연 데이터를 초기화하지 못했습니다.'
      )
    );
  }
};


/* -------------------------------------------------------------------------- */
/* 시작                                                                         */
/* -------------------------------------------------------------------------- */

loadDemoPanels();