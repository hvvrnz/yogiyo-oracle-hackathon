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
    title: hasOwnData ? 'AI가 이 매장의 조리 이력을 어떻게 반영했나요?' : 'AI가 조리시간을 어떻게 참고했나요?',
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
          { label: '유사 기록', value: `${reference.recent_case_count}건` },
          { label: '평균 조리시간', value: `${reference.avg_cook_min}분` },
          { label: '임베딩 방식', value: 'Cohere Embed · 1024차원' },
        ],
  };
}

function renderCookContent(content) {
  const metrics = content.metrics.map(m => `
    <div><span>${Yogiyo.escape(m.label)}</span><strong>${Yogiyo.escape(m.value)}</strong></div>
  `).join('');

  const matchBlock = content.hasOwnData
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
    ${casesTable}
  `;
}

function fallbackExplanationContent() {
  return {
    type: 'fallback',
    title: 'Vector Search Fallback 단계',
    subtitle: '자체 데이터가 부족한 매장도 단계적으로 검색 범위를 넓혀 유사 사례를 찾아요.',
    steps: [
      { num: 1, label: '자체 매장 이력', detail: 'get_cases_by_time_slot / get_store_average', matched: false },
      { num: 2, label: '같은 지역 + 같은 브랜드', detail: 'get_similar_cases_by_brand(same_region=True)', matched: false, note: '' },
      { num: 3, label: '타 지역 + 같은 브랜드', detail: 'get_similar_cases_by_brand(same_region=False)', matched: false, note: ''},
      { num: 4, label: '같은 지역 + 같은 카테고리(다른 브랜드)', detail: 'get_similar_cases_by_region_category(exclude_brand=...)', matched: true, note: '버거퀸 강남점🍔' },
      { num: 5, label: '전체 카테고리(다른 브랜드)', detail: 'get_similar_cases_by_category(exclude_brand=...)', matched: false },
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
  `;
}

function clusterExplanationContent() {
  return {
    type: 'cluster',
    title: '주문 클러스터링 로직',
    subtitle: '자체 개발한 밀도 기반 알고리즘이에요 (ML 모델 아님). 30초 윈도우마다 다시 계산해요.',
    gate: '서로 다른 권역(region)이면 애초에 후보에서 제외돼요 (무한대 점수 처리).',
    formula: [
      '매장 간 거리 + 배달지 간 거리 + 교차거리(평균) — km 단위 그대로 합산',
      '조리시간 차이는 "고정값"이 아니라, 그 순간까지 남은 조리시간(remaining_cook_time)의 차이를 사용해요',
      '이 남은시간 차이(분)를 라이더 평균속도(시속 20km)로 나눠 "km 환산 거리"로 바꿔 더해요',
      '카테고리 긴급도가 다르면 페널티(km 환산)를 추가해요',
    ],
    keyInsight: {
      title: '왜 30분짜리 주문도 결국 묶이는가',
      body: '접수 직후엔 30분 남은 주문과 10분짜리 주문의 차이가 크니 묶이기 어려워요. 하지만 30초 윈도우마다 클러스터링을 다시 계산하기 때문에, 20분이 지나 남은 시간이 10분이 되면 그 시점에 접수된 다른 짧은 주문들과 조리시간이 비슷해지면서 자연스럽게 묶일 기회를 얻어요. 긴 조리시간 주문을 처음부터 포기하지 않고, 시간이 지나며 계속 짝을 찾을 기회를 주는 구조예요.',
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
      { label: '평균점수 초과 시', value: '단건(SOLO)으로 분리' },
    ],
  };
}

// =========================

function dataPipelineExplanationContent() {
  return {
    type: 'pipeline',
    title: '실측 데이터가 쌓이는 구조',
    subtitle: '예측 → 실행 → 기록, 이 사이클이 반복되면서 다음 예측의 근거가 늘어나요.',
    stages: [
      { num: 1, label: '예측', detail: '사장님 입력 조리시간(owner_cook_min)' },
      { num: 2, label: '실행', detail: 'cook-complete 호출 시각 = 실제 조리완료' },
      { num: 3, label: '기록', detail: 'vector_cases.actual_cook_time에 저장' },
    ],
    example: { before: '입력 20분', after: '실제 14분', note: '이 (요일·시간대·매장) 조합의 새 사례로 vector_cases에 쌓여요.' },
    hardProblem: {
      title: '메뉴가 수천 개인데, 메뉴마다 조리시간을 어떻게 알아내나요?',
      body: '사장님은 메뉴 하나하나가 아니라 "치즈버거세트+콜라+너겟"처럼 주문 전체에 조리시간 하나만 입력해요. 콜라 같은 사이드는 단품으로 팔리지 않아서, "콜라만 시켰을 때 몇 분"이라는 기록 자체가 존재할 수 없어요.',
      answer: '이건 회귀분석으로 사후에 풀 수 있어요. 메뉴 구성이 서로 다른 주문들의 (구성, 총 조리시간) 데이터가 충분히 쌓이면, 각 메뉴가 전체 조리시간에 기여하는 정도를 통계적으로 분리해낼 수 있어요. 콜라를 단품으로 시킨 기록이 하나도 없어도, 콜라가 낀 여러 조합 주문들만으로 콜라의 몫을 추정할 수 있습니다.',
    },
    schemaLink: 'vector_cases의 menu_name 컬럼에는 "치즈버거세트 1개 외 2개"처럼 동시조리 중 가장 오래 걸린 대표 메뉴가 기록돼요 — 실제로는 이 자리에 전체 메뉴 구성(JSON)을 저장해두면, 나중에 회귀 모델을 그 위에 얹을 수 있어요.',
  };
}
function renderPipelineContent(content) {
  const stages = content.stages.map((s, i) => `
    <div class="pipeline-stage">
      <span class="pipeline-stage-num">${s.num}</span>
      <strong>${Yogiyo.escape(s.label)}</strong>
      <p>${Yogiyo.escape(s.detail)}</p>
    </div>
    ${i < content.stages.length - 1 ? '<div class="pipeline-arrow">→</div>' : '<div class="pipeline-arrow loop">↺</div>'}
  `).join('');

  return `
    <h2 class="explain-modal-title">${Yogiyo.escape(content.title)}</h2>
    <p class="explain-modal-subtitle">${Yogiyo.escape(content.subtitle)}</p>
    <div class="pipeline-cycle">${stages}</div>
    <div class="pipeline-example">
      <strong>${Yogiyo.escape(content.example.before)} → ${Yogiyo.escape(content.example.after)}</strong>
      <p>${Yogiyo.escape(content.example.note)}</p>
    </div>
    <div class="schema-block">
      <h3>${Yogiyo.escape(content.hardProblem.title)}</h3>
      <p class="schema-note">${Yogiyo.escape(content.hardProblem.body)}</p>
      <div class="candidate-insight" style="text-align:left; margin-top:10px">${Yogiyo.escape(content.hardProblem.answer)}</div>
    </div>
    <p class="schema-note" style="margin-top:14px">${Yogiyo.escape(content.schemaLink)}</p>
  `;
}

// =====================

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
  if (content.type === 'pipeline') return renderPipelineContent(content);
  if (content.type === 'cook') return renderCookContent(content);
  return `
    <h2 class="explain-modal-title">${Yogiyo.escape(content.title)}</h2>
    <ul class="explanation-steps">
      ${content.steps.map(s => `<li>${Yogiyo.escape(s)}</li>`).join('')}
    </ul>
  `;
}

function renderCandidatesContent(content) {
  const cards = content.candidates.map(c => `
    <div class="candidate-card${c.selected ? ' selected' : ''}">
      <div class="candidate-card-head">
        <strong>${Yogiyo.escape(c.label)}</strong>
        ${c.selected ? '<span class="candidate-badge">✓ 최종 선택</span>' : ''}
      </div>
      <ul class="candidate-items">
        ${c.items.map(i => `<li>${Yogiyo.escape(i)}</li>`).join('')}
      </ul>
      <p class="candidate-route">${Yogiyo.escape(c.routeText)}</p>
      <p class="candidate-reason">${Yogiyo.escape(c.reason)}</p>
      <div class="candidate-metrics">
        <div><span>라이더 대기</span><strong>${c.waitMin}분</strong></div>
        <div><span>음식 방치</span><strong>${c.sittingMin}분</strong></div>
        <div><span>총 수행시간</span><strong>${c.totalMin}분</strong></div>
      </div>
    </div>
  `).join('');

  return `
    <h2 class="explain-modal-title">${Yogiyo.escape(content.title)}</h2>
    <p class="explain-modal-subtitle">${Yogiyo.escape(content.subtitle || '')}</p>
    <div class="candidate-grid">${cards}</div>
    ${content.insight ? `<div class="candidate-insight">${Yogiyo.escape(content.insight)}</div>` : ''}
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
      openExplanationModal({ title: '조리시간 예측 결과', steps: ['아직 참고할 조리시간 데이터가 없어요. 조리 시작 전 단계에서 다시 확인해 주세요.'] });
      return;
    }
    openExplanationModal(cookTimeExplanationContent(data.cook_reference));
  } catch {
    openExplanationModal({ title: '조리시간 예측 결과', steps: ['데이터를 불러오지 못했습니다.'] });
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
  pipeline: () => openExplanationModal(dataPipelineExplanationContent()),
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