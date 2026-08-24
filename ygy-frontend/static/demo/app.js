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

const defaultCookReference = Object.freeze({
  reference_type: 'cold_start',
  matched_store_name: '버거퀸 강남점🍔',
  fallback_level: 4,
  recent_case_count: 10,
  avg_cook_min: 14.1,
  similar_cases: [
    { store_name: '버거퀸 강남점🍔', weekday: '금', time_slot: '저녁', actual_cook_min: 13.3, distance: 0.1765 },
    { store_name: '버거퀸 강남점🍔', weekday: '금', time_slot: '저녁', actual_cook_min: 13.4, distance: 0.1841 },
    { store_name: '버거퀸 강남점🍔', weekday: '금', time_slot: '저녁', actual_cook_min: 15.7, distance: 0.1933 },
  ],
});

function cookTimeExplanationContent(reference) {
  const hasOwnData = reference.reference_type !== 'cold_start';
  return {
    type: 'cook',
    title: 'AI 조리시간 판단 보조 결과',
    subtitle: hasOwnData
      ? '이 매장은 자체 조리 이력이 충분해, 다른 매장 데이터 없이 자기 이력만으로 예측해요.'
      : '이 매장은 자체 조리 이력이 부족해 Cold Start 상태예요. 유사 매장 사례로 대신 채워요.',
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
          { label: '유사 사례 수', value: `${reference.recent_case_count}건` },
          { label: '평균 조리시간', value: `${reference.avg_cook_min}분` },
          { label: '임베딩 방식', value: 'Cohere Embed · 1024차원' },
        ],
  };
}

function pendingCookTimeExplanationContent(subtitle) {
  return {
    ...cookTimeExplanationContent(
      defaultCookReference
    ),
    subtitle,
    pending: true,
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
        <strong>${content.fallbackLevel}단계 매칭</strong>
        <p>${Yogiyo.escape(content.matchedStore)}</p>
        <span class="fallback-step-badge">✓ Oracle AI Vector Search</span>
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
      <p class="schema-note">벡터 거리가 가까울수록(0에 가까울수록) 현재 상황과 유사한 사례예요. COSINE 거리 기준이에요.</p>
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
        <span>한국어 주문 정보를 의미적으로 비교할 수 있는 다국어 임베딩 모델</span>
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
    <div class="notice warn" style="margin-top:16px">
      <strong>최종 조리시간은 사장님이 결정합니다.</strong>
      <span>AI와 Vector Search는 유사 사례와 판단 근거를 제공하는 보조 수단이며, 최종 값을 자동으로 확정하지 않습니다.</span>
    </div>
    ${casesTable}
  `;
}

function fallbackExplanationContent() {
  return {
    type: 'fallback',
    title: '데이터 부족 매장의 조리시간 전략',
    subtitle: '자체 데이터가 부족한 초기에만 Vector Search로 참고 사례를 찾고, 데이터 축적 정도에 따라 판단 방식을 고도화합니다.',
    steps: [
      { num: 1, label: '자체 매장 이력', detail: 'get_cases_by_time_slot / get_store_average', matched: false },
      { num: 2, label: '같은 지역·브랜드', detail: 'get_similar_cases_by_brand(same_region=True)', matched: false, note: '' },
      { num: 3, label: '다른 지역·같은 브랜드', detail: 'get_similar_cases_by_brand(same_region=False)', matched: false, note: ''},
      { num: 4, label: '같은 지역·카테고리', detail: 'get_similar_cases_by_region_category(exclude_brand=...)', matched: true, note: '버거퀸 강남점🍔' },
      { num: 5, label: '전체 카테고리', detail: 'get_similar_cases_by_category(exclude_brand=...)', matched: false },
    ],
    metrics: [
      { label: '유사 사례', value: '10건' },
      { label: '평균 조리시간', value: '14.5분' },
      { label: '임베딩 차원', value: '1024차원 (VECTOR(1024,FLOAT32))' },
    ],
    codeSnippet: `def embed_situation(store_id, weekday, time_slot, concurrent_order_count, menu_name=None):
    text = f"매장ID {store_id}, {WEEKDAY_KO[weekday]}, 시간대 {time_slot}, 동시주문 {concurrent_order_count}건"
    if menu_name:
        text += f", 메뉴 {menu_name}"
    # Cohere Embed(multilingual-v3.0)로 1024차원 벡터화
    return generative_ai_client.embed_text(...).data.embeddings[0]`,
    codeNote: '요일은 숫자가 아니라 "금요일" 텍스트로 넣습니다. — 자연어 임베딩 모델이 숫자보다 요일명에서 더 많은 맥락(주말 임박, 회식 시즌 등)을 읽어낼 수 있습니다.',
    schema: {
      title: 'vector_cases 테이블 구조',
      note: '메뉴 같은 세부 feature는 별도 컬럼으로 안 쪼개고, embed_situation()이 만드는 임베딩 벡터 안에 자연어로 녹여서 처리합니다.' + ' 3·4단계는 예시를 보여드리기 위해 exclude_brand 조건으로 자기 브랜드를 제외하고 검색했습니다.',
      columns: [
        ['case_id', 'NUMBER', 'PK'],
        ['store_id', 'NUMBER', 'FK → stores'],
        ['weekday', 'NUMBER', '요일'],
        ['time_slot', 'VARCHAR2(20)', '시간대 구간'],
        ['concurrent_order_count', 'NUMBER', '동시 주문 수(혼잡도)'],
        ['menu_name', 'VARCHAR2(50)', '대표 메뉴 (동시조리 중 가장 오래 걸리는 항목)'],
        ['actual_cook_time', 'NUMBER', '실제 조리시간(분)'],
        ['embedding', 'VECTOR(1024, FLOAT32)', 'Cohere Embed 결과'],
      ],
    },
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

  const schemaRows = content.schema.columns.map(([col, type, desc]) => `
    <tr><td>${Yogiyo.escape(col)}</td><td>${Yogiyo.escape(type)}</td><td>${Yogiyo.escape(desc)}</td></tr>
  `).join('');

  return `
    <h2 class="explain-modal-title">${Yogiyo.escape(content.title)}</h2>
    <p class="explain-modal-subtitle">${Yogiyo.escape(content.subtitle)}</p>
    <div class="fallback-flow">${steps}</div>
    <div class="fallback-metrics">${metrics}</div>
    ${content.codeSnippet ? `<pre class="code-snippet">${Yogiyo.escape(content.codeSnippet)}</pre><p class="schema-note">${Yogiyo.escape(content.codeNote)}</p>` : ''}
    <div class="schema-block">
      <h3>${Yogiyo.escape(content.schema.title)}</h3>
      <table class="schema-table">
        <thead><tr><th>컬럼</th><th>타입</th><th>설명</th></tr></thead>
        <tbody>${schemaRows}</tbody>
      </table>
      <p class="schema-note">${Yogiyo.escape(content.schema.note)}</p>
    </div>
    <section class="embedding-choice-box">
      <div>
        <strong>프랜차이즈 매장</strong>
        <span>자체 이력이 부족하면 같은 브랜드의 같은 지역 데이터를 먼저 참고하고, 필요하면 다른 지역까지 범위를 넓힙니다.</span>
      </div>

      <div>
        <strong>개인 매장</strong>
        <span>공유할 브랜드 데이터가 없으므로 자체 이력 다음으로 같은 지역·카테고리의 유사 사례를 참고합니다.</span>
      </div>
    </section>

    <div class="candidate-insight" style="text-align:left">
      Vector Search는 초기 데이터가 부족할 때 유사 사례와 근거를 찾기 위한 보조 수단으로만 사용합니다.
    </div>
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
        <span>실제 결과를 매장별로 지속 축적</span>
        <span>비용·정확도에 유리한 공통 ML 회귀 모델로 조리시간 예측</span>
        <span>매장별 평균 오차로 추가 보정</span>
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
    title: '동선 중심 3건 클러스터링',
    subtitle: '거리·동선을 1차 기준으로 가까운 주문을 선별하고, 남은 조리시간 차이와 긴급도를 보정 기준으로 반영합니다.',
    gate: '권역(region)이 다른 주문은 무한대 점수로 처리해 클러스터링 후보에서 제외합니다.',
    formula: [
      '매장 간 거리를 km 단위로 반영',
      '배달지 간 거리를 km 단위로 반영',
      '각 매장과 상대 배달지 사이 교차거리의 평균을 반영',
      '사장님이 확정한 조리시간에서 경과시간을 뺀 남은 조리시간 차이를 km로 환산해 보정',
      '카테고리 긴급도가 다르면 불일치 페널티를 km로 환산해 추가',
    ],
    keyInsight: {
      title: '동선 우선, 조리시간 보정',
      body: '조리시간이 비슷한 주문을 먼저 묶는 구조가 아닙니다. 동선이 가까운 주문을 먼저 선별한 뒤, 남은 조리시간 차이가 너무 큰 조합을 감점합니다. 30초마다 다시 계산하므로 경과시간에 따라 조합 가능성도 달라집니다.',
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
      note: 'group_score는 조합 내 모든 쌍의 cluster_score 합, 이걸 쌍 개수로 나눈 평균이 MAX_ACCEPTABLE_SCORE보다 낮으면 묶여요.',
    },
    rules: [
      { label: '권역 불일치', value: '묶기 자체 불가 (inf)' },
      { label: '최대 묶음 크기', value: '3건' },
      { label: '재계산 주기', value: '30초' },
      { label: '평균점수 초과 시', value: '단건(SOLO)으로 분리' },
    ],
  };
}

// =========================

function routeExplanationContent(data = {}) {
  const selected =
    data.candidates?.find(
      candidate => candidate.selected
    ) ||
    data.candidates?.[0] ||
    {};

  return {
    type: 'route',
    title: '왜 이 방문 순서인가요?',
    subtitle: '3건의 픽업 3개와 배달 3개를 조합한 유효한 방문 순서를 모두 비교합니다.',
    items: selected.items || [
      '🥪 수제에그샌드위치 5분',
      '🍔 요기요햄버거 20분',
      '🍣 전통모듬초밥 15분',
    ],
    visitOrder: selected.route_text
      ? selected.route_text
          .replace(/ P(?=\s|→|$)/g, ' 픽업')
          .replace(/ D(?=\s|→|$)/g, ' 배달')
      : '샌드위치 픽업 → 샌드위치 배달 → 초밥 픽업 → 햄버거 픽업 → 햄버거 배달 → 초밥 배달',
    metrics: [
      { label: '라이더 대기시간', value: '4.6분' },
      { label: '음식 방치시간', value: '0.9분' },
      { label: '가방 체류시간', value: '19분' },
      { label: '전체 수행시간', value: '26.3분' },
      { label: '총점', value: '50.8점' },
    ],
    timeline: [
      { sequence: 1, event: '샌드위치 픽업', ready: '5.0분', arrival: '0.9분' },
      { sequence: 2, event: '샌드위치 배달', ready: '-', arrival: '9.5분' },
      { sequence: 3, event: '초밥 픽업', ready: '15.0분', arrival: '15.9분' },
      { sequence: 4, event: '햄버거 픽업', ready: '20.0분', arrival: '19.5분' },
      { sequence: 5, event: '햄버거 배달', ready: '-', arrival: '24.2분' },
      { sequence: 6, event: '초밥 배달', ready: '-', arrival: '26.3분' },
    ],
  };
}

function renderRouteContent(content) {
  const metrics = content.metrics.map(metric => `
    <div>
      <span>${Yogiyo.escape(metric.label)}</span>
      <strong>${Yogiyo.escape(metric.value)}</strong>
    </div>
  `).join('');

  const timelineRows = content.timeline.map(item => `
    <tr>
      <td>${item.sequence}</td>
      <td>${Yogiyo.escape(item.event)}</td>
      <td>${Yogiyo.escape(item.ready)}</td>
      <td>${Yogiyo.escape(item.arrival)}</td>
    </tr>
  `).join('');

  return `
    <h2 class="explain-modal-title">${Yogiyo.escape(content.title)}</h2>
    <p class="explain-modal-subtitle">${Yogiyo.escape(content.subtitle)}</p>

    <div class="candidate-insight" style="text-align:left">
      각 주문의 픽업은 해당 배달보다 먼저여야 하므로,
      유효한 방문 순서는 <strong>6! ÷ 2³ = 90가지</strong>입니다.
      시스템은 90가지를 완전탐색해 아래 지표 합이 가장 낮은 순서를 제안합니다.
    </div>

    <div class="fallback-metrics">${metrics}</div>

    <div class="candidate-card selected" style="margin-top:16px">
      <div class="candidate-card-head">
        <strong>선택된 방문 순서</strong>
        <span class="candidate-badge">✓ 최저 점수</span>
      </div>
      <ul class="candidate-items">
        ${content.items.map(item => `<li>${Yogiyo.escape(item)}</li>`).join('')}
      </ul>
      <p class="candidate-route">${Yogiyo.escape(content.visitOrder)}</p>
    </div>

    <div class="schema-block">
      <h3>예상 조리완료·도착 타임라인</h3>
      <table class="schema-table">
        <thead>
          <tr><th>순서</th><th>방문 이벤트</th><th>예상 조리완료</th><th>예상 도착</th></tr>
        </thead>
        <tbody>${timelineRows}</tbody>
      </table>
    </div>

    <div class="notice info" style="margin-top:16px">
      <strong>라이더가 최종 선택합니다.</strong>
      <span>시스템은 도로 위의 실제 이동 동선을 강제하지 않고 방문 순서만 제안합니다. 라이더는 배차 제안을 수락하거나 거절할 수 있습니다.</span>
    </div>
  `;
}

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
    <div class="notice info" style="margin-bottom:16px">
      <strong>조리시간 반영 기준</strong>
      <span>AI 참고값을 그대로 사용하지 않고, 사장님이 확정한 조리시간에서 주문 접수 후 경과시간을 제외한 remaining_cook_time을 사용합니다.</span>
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
  if (content.type === 'fallback') return renderFallbackContent(content);
  if (content.type === 'cluster') return renderClusterContent(content);
  if (content.type === 'route') return renderRouteContent(content);
  if (content.type === 'cook') return renderCookContent(content);
  return `
    <h2 class="explain-modal-title">${Yogiyo.escape(content.title)}</h2>
    <ul class="explanation-steps">
      ${content.steps.map(s => `<li>${Yogiyo.escape(s)}</li>`).join('')}
    </ul>
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
    openExplanationModal(
      routeExplanationContent(data)
    );
  } catch {
    openExplanationModal(
      routeExplanationContent()
    );
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
