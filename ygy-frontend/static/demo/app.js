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
  : '조리시간이 긴 주문일수록 배차가 어려워지는 문제, 완전탐색 기반 배차 알고리즘과 Oracle Generative AI의 조리시간 예측으로 함께 해결합니다.';




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
    orderIds,
    lat,
    lng,
    durationMs,
  } = event.data || {};

if (type === 'ygy:rider-position') {
  Yogiyo.el('demoCustomerFrame')
    .contentWindow
    ?.postMessage(
      {
        type:
          'ygy:customer-rider-position',

        packageId,
        riderId,
        lat,
        lng,
        durationMs,
      },

      window.location.origin
    );

  return;
}

  if (type !== 'ygy:package-accepted') {    return;  }


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


  // Yogiyo.toast(
  //   '배차 수락 상태를 고객·사장님 화면에 즉시 반영했습니다.'
  // );
});


/* -------------------------------------------------------------------------- */
/* 통합 시연 초기화                                                             */
/* -------------------------------------------------------------------------- */

const loadDemoPanels = async () => {
  const requestId = ++demoSelectionRequestId;
  const riderId = demoRiderId;

  try {

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
      '주문 고객'
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
      '사장님 · store_id_889'
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
      'DEMO_LOADED',
      '현재 시연 상태를 유지한 채 고객·사장님·라이더 화면을 연결했습니다.'  
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

const resetDemoState = async button => {
  await Yogiyo.withPending(
    button,
    async () => {
      try {
        await Yogiyo.apiClient.demo.reset();

        sessionStorage.removeItem(
          'ygy-demo-completed-packages'
        );

        sessionStorage.removeItem(
          'ygy-demo-accepted-package'
        );

        sessionStorage.removeItem(
          'ygy-demo-rider-position'
        );

        loadDemoPanels();

        refreshDemoFrame(
          'demoCustomerFrame'
        );

        refreshDemoFrame(
          'demoMerchantFrame'
        );

        refreshDemoFrame(
          'demoRiderFrame'
        );

        appendDemoEvent(
          'DEMO_RESET',
          '시연 데이터를 초기 상태로 되돌렸습니다.'
        );

        Yogiyo.el(
          'simulationAnnouncement'
        ).textContent =
          '시연 데이터를 초기 상태로 되돌렸습니다.';

        Yogiyo.toast(
          '시연 데이터를 초기화했습니다.'
        );
      } catch (error) {
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
    }
  );
};
/* -------------------------------------------------------------------------- */
/* 시작                                                                         */
/* -------------------------------------------------------------------------- */

const demoResetButton =
  Yogiyo.el('demoResetButton');

demoResetButton?.addEventListener(
  'click',
  () => {
    resetDemoState(
      demoResetButton
    );
  }
);

loadDemoPanels();

/* -------------------------------------------------------------------------- */
/* 알고리즘 근거 모달                                                            */
/* -------------------------------------------------------------------------- */

function cookTimeExplanationContent(reference) {
  const hasOwnData = reference.reference_type !== 'cold_start';
  return {
    type: 'cook',
    title: 'AI 조리시간 판단 보조 결과',
    subtitle: hasOwnData
      ? '이 매장의 자체 조리 이력을 사장님의 조리시간 판단 근거로 제공합니다.'
      : '자체 조리 이력이 부족해 같은 지역·카테고리의 유사 사례를 참고정보로 제공합니다.',
    matchedStore: hasOwnData ? null : reference.matched_store_name,
    fallbackLevel: hasOwnData ? null : reference.fallback_level,
    hasOwnData,
    menuLine: reference.menu_name ? `${reference.menu_name} ${reference.item_qty}개` : null,
    embeddingInput: reference.embedding_input_text,
    similarCases: reference.similar_cases || [],
    metrics: hasOwnData
      ? [
          { label: '자체 기록', value: `${reference.recent_case_count}건` },
          { label: '최근 30일 평균', value: `${reference.avg_cook_min}분` },
          { label: '보정계수 적용', value: `${reference.correction_factor ?? '1.0'}x` },
        ]
      : [
          { label: '유사 사례', value: `${reference.recent_case_count}건` },
          { label: '평균 조리시간', value: `${reference.avg_cook_min}분` },
          { label: '임베딩 방식', value: 'Cohere Embed · 1024차원' },
        ],
  };
}

function pendingCookTimeExplanationContent(subtitle) {
  return {
    type: 'cook',
    title: 'AI 조리시간 판단 보조 결과',
    subtitle,
    pending: true,
    hasOwnData: false,
    embeddingInput: null,
    similarCases: [],
    metrics: [
      { label: '현재 상태', value: '조리 시작 전' },
      { label: '임베딩 모델', value: 'Cohere Multilingual v3.0' },
      { label: '출력 규격', value: '1024차원' },
    ],
  };
}

function renderCookContent(content) {
  const metrics = content.metrics.map(m => `
    <div><span>${Yogiyo.escape(m.label)}</span><strong>${Yogiyo.escape(m.value)}</strong></div>
  `).join('');

  const matchBlock = content.pending
    ? `
      <div class="fallback-step" style="max-width:340px">
        <span class="fallback-step-num">i</span>
        <strong>조리 시작 전</strong>
        <p>조리가 시작되면 현재 주문의 실제 참고 결과도 함께 표시됩니다.</p>
      </div>
    `
    : content.hasOwnData
    ? `
      <div class="fallback-step matched" style="max-width:340px">
        <span class="fallback-step-num">✓</span>
        <strong>자체 이력 사용</strong>
        <p>다른 매장 데이터를 참고하지 않고 이 매장 자신의 조리 기록만으로 예측해요.</p>
      </div>
    `
    : `
      <div class="fallback-step matched" style="max-width:340px">
        <span class="fallback-step-num">${content.fallbackLevel}</span>
        <strong>최종 검색 범위</strong>
        <p>같은 지역 · 같은 카테고리</p>
        <span class="fallback-step-badge">✓ 강남 · 버거류</span>
      </div>
    `;

  const casesTable = content.similarCases.length ? `
    <div class="schema-block">
      <h3>실제 참고한 유사 사례</h3>
      <table class="schema-table">
        <thead><tr><th>매장</th><th>요일 · 시간대</th><th>실제 조리시간</th><th>벡터 거리</th></tr></thead>
        <tbody>
          ${content.similarCases.map(c => `
            <tr>
              <td>${Yogiyo.escape(c.store_name)}</td>
              <td>${Yogiyo.escape(c.weekday)} · ${Yogiyo.escape(c.time_slot)}</td>
              <td>${c.actual_cook_min}분</td>
              <td>${c.distance.toFixed(3)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p class="schema-note">코사인 거리가 0에 가까울수록 현재 주문 상황과 의미적으로 유사한 사례입니다.</p>
    </div>
  ` : '';
  const embeddingBlock = content.embeddingInput ? `
    <div class="schema-block">
      <h3>메뉴는 컬럼이 아니라 임베딩 텍스트로 처리돼요</h3>
      ${content.menuLine ? `<p class="schema-note">이번 주문 메뉴: <strong>${Yogiyo.escape(content.menuLine)}</strong></p>` : ''}
      <div class="embedding-input-box">${Yogiyo.escape(content.embeddingInput)}</div>
      <p class="schema-note">이 문장 그대로가 Cohere Embed(cohere.embed-multilingual-v3.0)에 입력돼 1024차원 벡터가 돼요. 메뉴명을 별도 카테고리 컬럼으로 나누지 않고, 텍스트 안에 자연어로 녹여서 벡터 유사도가 알아서 판단하게 해요.</p>
    </div>
  ` : '';

  return `
    <h2 class="explain-modal-title">${Yogiyo.escape(content.title)}</h2>
    <p class="explain-modal-subtitle">${Yogiyo.escape(content.subtitle)}</p>
    ${matchBlock}
    <div class="fallback-metrics">${metrics}</div>
    ${embeddingBlock}
    <section class="embedding-choice-box">
      <div>
        <strong>모델 선택</strong>
        <span>Cohere Embed Multilingual v3.0</span>
      </div>

      <div>
        <strong>선택 이유</strong>
        <span>한국어 지원과 OCI·Oracle Vector Search 연동을 고려한 다국어 임베딩 모델</span>
      </div>

      <div>
        <strong>1024차원인 이유</strong>
        <span>
          팀이 임의로 정한 값이 아니라 선택한 모델의 고정 출력 규격이며,
          Oracle VECTOR(1024, FLOAT32)와 일치시켰습니다.
        </span>
      </div>

      <div>
        <strong>검증 범위</strong>
        <span>
          384차원 Light 모델과 정확도·비용을 직접 비교하지 않았으며,
          실서비스 적용 전 별도 비교가 필요합니다.
        </span>
      </div>
    </section>
    <p class="data-strategy-notice">
      유사 사례는 판단 근거이며 최종 조리시간은 사장님이 현재 매장 상황을 반영해 결정합니다.
    </p>
    ${casesTable}
  `;
}

function fallbackExplanationContent() {
  return {
    type: 'fallback',
    title: '데이터 부족 매장의 조리시간 전략',
    subtitle: '초기에는 유사 사례를 참고하고, 자체 결과가 축적되면 매장별 기준으로 고도화합니다.',
    steps: [
      { num: 1, label: '자체 매장 이력', detail: 'get_cases_by_time_slot / get_store_average', matched: false },
      { num: 2, label: '같은 지역 · 같은 브랜드', detail: '동일 브랜드의 같은 지역 사례', matched: false, note: '' },
      { num: 3, label: '다른 지역 · 같은 브랜드', detail: '동일 브랜드의 다른 지역 사례', matched: false, note: ''},
      { num: 4, label: '같은 지역 · 같은 카테고리', detail: '다른 브랜드를 포함한 강남 버거류', matched: true, note: '현재 적용 · 강남 버거류' },
      { num: 5, label: '전체 카테고리', detail: '지역을 확장한 동일 카테고리', matched: false },
    ],
    metrics: [
      { label: '유사 사례', value: '10건' },
      { label: '평균 조리시간', value: '14.5분' },
      { label: '현재 검색 범위', value: '같은 지역·카테고리' },
    ],
  };
}

function renderFallbackContent(content) {
  const steps = content.steps.map((s, i) => `
    <div class="fallback-step${s.matched ? ' matched' : ''}">
      <span class="fallback-step-num">${s.num}</span>
      <strong>${Yogiyo.escape(s.label)}</strong>
      <p class="fallback-step-fn">${Yogiyo.escape(s.detail)}</p>
      ${s.matched ? `<span class="fallback-step-badge">✓ ${Yogiyo.escape(s.note)}</span>` : ''}
    </div>
    ${i < content.steps.length - 1 ? '<div class="fallback-arrow">→</div>' : ''}
  `).join('');

  const metrics = content.metrics.map(m => `
    <div><span>${Yogiyo.escape(m.label)}</span><strong>${Yogiyo.escape(m.value)}</strong></div>
  `).join('');

  return `
    <h2 class="explain-modal-title">${Yogiyo.escape(content.title)}</h2>
    <p class="explain-modal-subtitle">${Yogiyo.escape(content.subtitle)}</p>
    <div class="fallback-flow">${steps}</div>
    <div class="fallback-metrics">${metrics}</div>
    <section class="data-strategy-upgrade">
      <article class="data-strategy-card">
        <strong>현재 MVP</strong>
        <span>Vector Search로 유사 사례 제공</span>
        <span>사장님이 최종 조리시간 결정</span>
        <span>입력시간과 실제 완료시간 차이 표시</span>
      </article>

      <div class="data-strategy-arrow" aria-hidden="true">→</div>

      <article class="data-strategy-card is-future">
        <strong>실서비스 고도화</strong>
        <span>입력시간과 완료시간을 매장별로 지속 축적</span>
        <span>공통 ML 회귀 모델로 조리시간 예측</span>
        <span>매장별 평균 오차 추가 보정</span>
        <span>Vector Search는 신규 매장·근거 제공</span>
      </article>
    </section>

    <p class="data-strategy-notice">
      현재 MVP에서는 피드백을 화면에 기록하는 흐름까지 구현했으며,
      DB 영구 축적과 자동 ML 재학습은 향후 고도화 범위입니다.
    </p>
  `;
}

function clusterExplanationContent() {
  return {
    type: 'cluster',
    title: '동선·남은 조리시간 기반 3건 클러스터링',
    subtitle: '같은 권역의 주문을 대상으로 동선 비용과 남은 조리시간 차이를 함께 계산합니다.',
    gate: '서로 다른 권역의 주문은 클러스터링 후보에서 제외합니다.',
    formula: [
      '매장 간 거리, 배달지 간 거리와 매장-배달지 교차거리의 평균을 반영합니다.',
      '사장님이 확정한 조리시간에서 경과시간을 뺀 남은 조리시간 차이를 반영합니다.',
      '현재 MVP에서는 시간 차이를 평균속도 시속 20km 기준의 거리 비용으로 환산합니다.',
      '남은 조리시간 상태가 크게 다른 조합에는 추가 패널티를 적용합니다.',
    ],
    keyInsight: {
      title: '동선과 시간의 결합',
      body: '조리시간만 비슷한 주문을 먼저 묶는 방식이 아닙니다. 같은 권역 안에서 이동거리와 남은 조리시간 차이를 하나의 점수로 비교하며, 30초마다 남은 시간을 갱신해 묶음 가능 여부를 다시 계산합니다.',
    },
    codeSnippet: `def remaining_cook_time(order):
    elapsed_min = (datetime.now() - order["created_at"]).total_seconds() / 60
    return max(order["base_cooking_min"] - elapsed_min, 0)`,
    worked: {
      title: '실제 계산 예시 — 정통도시락 + 요기요햄버거 묶기 판단',
      rows: [
        ['매장 간 거리', '0.3km'],
        ['배달지 간 거리', '0.4km'],
        ['매장-배달지 교차거리(평균)', '0.5km'],
        ['남은 조리시간 차이', '7분 → 시속20km 환산 2.33km'],
        ['긴급도 일치 여부', '동일(0km)'],
      ],
      total: 'cluster_score = 0.3 + 0.4 + 0.5 + 2.33 + 0 = 3.53',
      note: '현재 방식은 묶음 후보를 빠르게 비교하기 위한 MVP 휴리스틱입니다. 실제 서비스에서는 거리를 도로 이동시간으로 변환해 예상 도착시각과 조리완료시각을 직접 비교하는 방식으로 고도화할 수 있습니다.',
    },
    rules: [
      { label: '권역 불일치', value: '묶기 자체 불가 (inf)' },
      { label: '최대 묶음 크기', value: '3건' },
      { label: '평균점수 초과 시', value: '단건(SOLO)으로 분리' },
    ],
  };
}

// =========================

function renderClusterContent(content) {
  const formulaLines = content.formula.map(f => `<li>${Yogiyo.escape(f)}</li>`).join('');
  const workedRows = content.worked.rows.map(([label, value]) => `
    <tr><td>${Yogiyo.escape(label)}</td><td>${Yogiyo.escape(value)}</td></tr>
  `).join('');
  const rules = content.rules.map(r => `
    <div class="cluster-rule"><strong>${Yogiyo.escape(r.label)}</strong><span>${Yogiyo.escape(r.value)}</span></div>
  `).join('');

  return `
    <h2 class="explain-modal-title">${Yogiyo.escape(content.title)}</h2>
    <p class="explain-modal-subtitle">${Yogiyo.escape(content.subtitle)}</p>
    <div class="notice warn" style="margin-bottom:16px"><strong>권역 게이트</strong><span>${Yogiyo.escape(content.gate)}</span></div>
    <ul class="explanation-steps">${formulaLines}</ul>
    ${content.codeSnippet ? `<pre class="code-snippet">${Yogiyo.escape(content.codeSnippet)}</pre>` : ''}
    <div class="candidate-insight" style="text-align:left; margin:16px 0">
      <strong style="display:block; margin-bottom:6px">${Yogiyo.escape(content.keyInsight.title)}</strong>
      ${Yogiyo.escape(content.keyInsight.body)}
    </div>
    <div class="schema-block">
      <h3>${Yogiyo.escape(content.worked.title)}</h3>
      <table class="schema-table">
        <thead><tr><th>항목</th><th>값</th></tr></thead>
        <tbody>${workedRows}</tbody>
      </table>
      <p class="candidate-insight" style="margin-top:12px">${Yogiyo.escape(content.worked.total)}</p>
      <p class="schema-note">${Yogiyo.escape(content.worked.note)}</p>
    </div>
    <div class="cluster-rules">${rules}</div>
  `;
}


function renderExplanationContent(content) {
  if (content.type === 'candidates') return renderCandidatesContent(content);
  if (content.type === 'fallback') return renderFallbackContent(content);
  if (content.type === 'cluster') return renderClusterContent(content);
  if (content.type === 'cook') return renderCookContent(content);
  return `
    <h2 class="explain-modal-title">${Yogiyo.escape(content.title)}</h2>
    <ul class="explanation-steps">
      ${content.steps.map(s => `<li>${Yogiyo.escape(s)}</li>`).join('')}
    </ul>
  `;
}

function renderCandidatesContent(content) {
  const selected = content.candidates.find(c => c.selected) || content.candidates[0];
  const metrics = [
    ['라이더 대기시간', `${selected?.waitMin ?? 0}분`],
    ['음식 방치시간', `${selected?.sittingMin ?? 0}분`],
    ['가방 체류시간', '19분'],
    ['전체 수행시간', `${selected?.totalMin ?? 0}분`],
    ['종합점수', '50.8점'],
  ].map(([label, value]) => `
    <div><span>${Yogiyo.escape(label)}</span><strong>${Yogiyo.escape(value)}</strong></div>
  `).join('');

  const orderItems = selected?.items?.map(i => `<li>${Yogiyo.escape(i)}</li>`).join('') || '';

  return `
    <h2 class="explain-modal-title">${Yogiyo.escape(content.title)}</h2>
    <p class="explain-modal-subtitle">${Yogiyo.escape(content.subtitle || '')}</p>
    <div class="candidate-insight" style="text-align:left; margin:16px 0">
      <strong>90가지 방문 순서</strong><br>
      각 주문의 픽업이 해당 배달보다 먼저여야 하므로 유효한 방문 순서는
      6! ÷ 2³ = 90가지입니다. 이는 실제 도로 경로가 아니라 지점의 방문 순서입니다.
    </div>
    <div class="fallback-metrics">${metrics}</div>
    <div class="candidate-card selected" style="margin-top:16px">
      <div class="candidate-card-head">
        <strong>선택된 방문 순서</strong>
        <span class="candidate-badge">✓ 최저 점수</span>
      </div>
      <ul class="candidate-items">${orderItems}</ul>
      <p class="candidate-route">${Yogiyo.escape(selected?.routeText || '')}</p>
    </div>
    <div class="schema-block">
      <h3>예상 조리완료·도착 타임라인</h3>
      <table class="schema-table">
        <thead><tr><th>순서</th><th>방문 이벤트</th><th>예상 조리완료</th><th>예상 도착</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>샌드위치 픽업</td><td>5.0분</td><td>0.9분</td></tr>
          <tr><td>2</td><td>샌드위치 배달</td><td>-</td><td>9.5분</td></tr>
          <tr><td>3</td><td>초밥 픽업</td><td>15.0분</td><td>15.9분</td></tr>
          <tr><td>4</td><td>햄버거 픽업</td><td>20.0분</td><td>19.5분</td></tr>
          <tr><td>5</td><td>햄버거 배달</td><td>-</td><td>24.2분</td></tr>
          <tr><td>6</td><td>초밥 배달</td><td>-</td><td>26.3분</td></tr>
        </tbody>
      </table>
    </div>
    ${content.insight ? `<div class="candidate-insight">${Yogiyo.escape(content.insight)}</div>` : ''}
    <p class="data-strategy-notice">
      시스템은 실제 이동 도로를 강제하지 않고 방문 순서만 제안합니다.
      최종 수락 여부는 라이더가 결정합니다.
    </p>
  `;
}

function openExplanationModal(content) {
  Yogiyo.el('explanationBody').innerHTML = renderExplanationContent(content);
  Yogiyo.el('explanationBackdrop').classList.add('open');
}

function closeExplanationModal() {
  Yogiyo.el('explanationBackdrop').classList.remove('open');
}

async function openCookExplanation() {
  try {
    const res = await fetch('/api/demo/merchant/next-to-cook');
    const data = await res.json();
    if (!data.cook_reference) {
      openExplanationModal(
        pendingCookTimeExplanationContent(
          '아직 참고할 주문 데이터가 없습니다. 아래에서 임베딩 모델 선택 근거를 확인할 수 있습니다.'
        )
      );
      return;
    }
    openExplanationModal(cookTimeExplanationContent(data.cook_reference));
  } catch {
    openExplanationModal(
      pendingCookTimeExplanationContent(
        '주문 데이터를 불러오지 못했습니다. 임베딩 모델 선택 근거는 아래에서 확인할 수 있습니다.'
      )
    );
  }
}

async function openDispatchExplanation() {
  try {
    const res = await fetch('/api/demo/dispatch/candidates');
    const data = await res.json();
    openExplanationModal({
      type: 'candidates',
      title: data.title,
      subtitle: data.subtitle,
      formula: data.formula,
      insight: data.insight,
      workedExample: data.worked_example,
      candidates: data.candidates.map(c => ({ ...c, routeText: c.route_text, waitMin: c.wait_min, sittingMin: c.sitting_min, totalMin: c.total_min, reason: c.reason })),
    });
  } catch {
    openExplanationModal({ title: '배차 엔진 분석 결과', steps: ['데이터를 불러오지 못했습니다.'] });
  }
}

const explanationHandlers = {
  cook: openCookExplanation,
  route: openDispatchExplanation,
  fallback: () => openExplanationModal(fallbackExplanationContent()),
  cluster: () => openExplanationModal(clusterExplanationContent()),
};

document.querySelectorAll('.algo-explain-buttons button').forEach(btn => {
  btn.addEventListener('click', () => {
    explanationHandlers[btn.dataset.explain]?.();
  });
});

Yogiyo.el('explanationCloseBtn').addEventListener('click', closeExplanationModal);
Yogiyo.el('explanationBackdrop').addEventListener('click', event => {
  if (event.target === event.currentTarget) closeExplanationModal();
});