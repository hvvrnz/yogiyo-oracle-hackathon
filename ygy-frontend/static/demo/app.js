if (!Yogiyo.useMock) {
  const controlRoot = document.querySelector('.control-groups');
  if (controlRoot) {
    controlRoot.innerHTML = '<section class="control-subpanel"><h3>실제 서버 조회 모드</h3><p style="color:#b7b7c1;font-size:11px;margin:0;line-height:1.6">실제 Oracle DB의 주문 1~3, 주문이 있는 매장 892, 배정 라이더 rider_102·103·105를 표시합니다. 이 화면에서는 데이터 생성·초기화·가상 시나리오를 실행하지 않습니다.</p></section>';
  }
  Yogiyo.el('demoModeDescription').textContent = '실제 Oracle DB 조회 모드입니다. 각 패널은 현재 데이터 상태를 독립적으로 5초마다 갱신합니다.';
  Yogiyo.el('backendDocsLink').hidden = false;
  Yogiyo.el('connectionText').textContent = '실제 REST 조회 모드';
  Yogiyo.el('summaryStatus').textContent = '읽기 전용';
  Yogiyo.el('summaryOrders').textContent = '주문 1 · 2 · 3';
  Yogiyo.el('summaryDuration').textContent = '5초 폴링';
  Yogiyo.el('summaryStrategy').textContent = '역할별 독립 조회';
  Yogiyo.el('summaryRevenue').textContent = '매장 892';
  Yogiyo.el('summaryRider').textContent = 'rider_102 · 103 · 105';
  Yogiyo.el('summaryVersion').textContent = '실제 API';
  Yogiyo.el('eventList').innerHTML = '<div class="event"><code>REAL_DATA_MODE</code><span>목업 시나리오 제어는 실제 데이터 모드에서 비활성화되어 있습니다.</span><time>REST</time></div>';
} else {
let autoMoveTimer;
let demoActionInFlight = false;

function demoControls() {
  return [...document.querySelectorAll('.controls button, .controls select')];
}

async function runDemoAction(task) {
  if (demoActionInFlight) return false;
  demoActionInFlight = true;
  const controls = demoControls();
  const previousDisabled = controls.map(button => button.disabled);
  controls.forEach(button => {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  });
  try {
    await task();
    return true;
  } finally {
    controls.forEach((button, index) => {
      button.disabled = previousDisabled[index];
      button.removeAttribute('aria-busy');
    });
    demoActionInFlight = false;
  }
}

function configureDemoMode() {
  const isMock = Yogiyo.useMock;
  Yogiyo.el('demoModeDescription').textContent = isMock
    ? '브라우저 mock 상태 기반 통합 시연입니다. 고객·사장님·라이더 화면이 같은 시연 상태를 공유합니다.'
    : '하나의 FastAPI 서버와 공통 상태를 고객·사장님·라이더 화면이 WebSocket으로 공유합니다.';
  Yogiyo.el('backendDocsLink').hidden = isMock;
  Yogiyo.el('connectionText').textContent = isMock ? '브라우저 mock 상태 준비 중' : '서버 연결 중';
}

function stopAutoMove() {
  if (autoMoveTimer) window.clearInterval(autoMoveTimer);
  autoMoveTimer = undefined;
}

function syncAutoMove(state) {
  Yogiyo.el('autoMove').textContent = state.simulation_running ? '자동 시연 일시정지' : '자동 시연 시작';
  if (!state.simulation_running || autoMoveTimer) return;
  autoMoveTimer = window.setInterval(async () => {
    try {
      const ran = await runDemoAction(async () => {
        const latest = await Yogiyo.apiClient.demo.state();
        if (!latest.simulation_running) {
          stopAutoMove();
          return;
        }
        const result = await Yogiyo.apiClient.demo.nextStep();
        Yogiyo.el('simulationAnnouncement').textContent = `자동 시연: ${result.message}`;
        await loadDemo();
      });
      if (!ran) return;
    } catch (error) {
      stopAutoMove();
      Yogiyo.toast(error.message);
    }
  }, 3000);
}

async function loadDemo() {
  try {
    const state = await Yogiyo.apiClient.demo.state();
    const packages = Object.values(state.packages);
    const singles = packages.filter(pkg => pkg.delivery_type === 'SINGLE_DELIVERY');
    const twoBundles = packages.filter(pkg => pkg.delivery_type === 'AI_BUNDLE_2');
    const threeBundles = packages.filter(pkg => pkg.delivery_type === 'AI_BUNDLE_3');
    Yogiyo.el('summaryStatus').textContent = `${packages.length}개 패키지`;
    Yogiyo.el('summaryOrders').textContent = `개별 ${singles.length} · 2건 묶음 ${twoBundles.length} · 3건 묶음 ${threeBundles.length}`;
    Yogiyo.el('summaryDuration').textContent = new Date(state.simulation_clock).toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit', hour12:false});
    Yogiyo.el('summaryStrategy').textContent = state.route_strategy === 'MIXED' ? '혼합 최적화' : '전체 픽업 후 배달';
    Yogiyo.el('summaryRevenue').textContent = packages.map(pkg => `${pkg.package_id}: ${pkg.assigned_rider_id || '제안 중'}`).join(' · ') || '-';
    Yogiyo.el('summaryRider').textContent = Object.entries(state.riders).map(([id, rider]) => `${id} ${rider.status}`).join(' · ');
    Yogiyo.el('summaryVersion').textContent = state.version;
    Yogiyo.el('eventList').innerHTML = state.events.length
      ? state.events.map(item => `<div class="event"><code>${Yogiyo.escape(item.type)}</code><span>${Yogiyo.escape(item.message)}</span><time>${Yogiyo.fmtTime(item.occurred_at)}</time></div>`).join('')
      : '<div class="event"><span>새 시나리오를 시작하세요.</span></div>';
    Yogiyo.el('connectionText').textContent = Yogiyo.useMock
      ? `브라우저 mock 상태 · v${state.version}`
      : `실시간 연결 · v${state.version}`;
    syncAutoMove(state);
  } catch (error) {
    Yogiyo.el('connectionText').textContent = error.message;
  }
}

async function createOrder(customerId, storeId, preference) {
  const result = await Yogiyo.apiClient.orders.create({customer_id:customerId, store_id:storeId, items:[{name:'시연 주문', quantity:1}], delivery_preference:preference});
  await Yogiyo.apiClient.merchant.orderAction(result.order_id, {action:'accept'});
  return result.order_id;
}

async function scenario(count, preference, dispatchAfter=false) {
  stopAutoMove();
  await Yogiyo.apiClient.demo.reset();
  const targets = [['C-001', 'S-001'], ['C-002', 'S-002'], ['C-003', 'S-003']].slice(0, count);
  for (const [customerId, storeId] of targets) await createOrder(customerId, storeId, preference);
  if (dispatchAfter) await Yogiyo.apiClient.demo.dispatchCalculate();
  Yogiyo.toast(`${preference === 'AI_RECOMMENDED' ? 'AI 추천' : '단일'} 주문 ${count}건을 ${dispatchAfter ? '배차 제안까지' : '수락 대기 상태로'} 만들었습니다.`);
  await loadDemo();
}

async function respondCurrentOffer(action) {
  const state = await Yogiyo.apiClient.demo.state();
  const pkg = Object.values(state.packages).find(item => Object.values(item.offers || {}).some(offer => offer.status === 'OFFERED'));
  if (!pkg) throw new Error('응답할 라이더 제안이 없습니다. 먼저 AI 배차를 계산하세요.');
  const riderId = Object.entries(pkg.offers).find(([, offer]) => offer.status === 'OFFERED')[0];
  const result = await Yogiyo.apiClient.rider.offerResponse(riderId, pkg.package_id, {action});
  Yogiyo.toast(`${riderId}: ${result.message}`);
  await loadDemo();
}

async function delayBurger() {
  let state = await Yogiyo.apiClient.demo.state();
  let order = Object.values(state.orders).find(item => item.store_id === 'S-002' && item.status !== 'DELIVERED');
  if (!order) {
    const orderId = await createOrder('C-002', 'S-002', 'AI_RECOMMENDED');
    state = await Yogiyo.apiClient.demo.state();
    order = state.orders[orderId];
  }
  if (order.status === 'MATCHING') await Yogiyo.apiClient.merchant.orderAction(order.order_id, {action:'start'});
  await Yogiyo.apiClient.merchant.orderAction(order.order_id, {action:'delay', delay_min:7});
  Yogiyo.toast('버거 매장 조리 예상시간을 7분 늦췄습니다.');
  await loadDemo();
}

async function addNewOrder() {
  const state = await Yogiyo.apiClient.demo.state();
  const targets = [['C-001', 'S-001'], ['C-002', 'S-002'], ['C-003', 'S-003']];
  const target = targets.find(([customerId]) => !Object.values(state.orders).some(order => order.customer_id === customerId && order.status !== 'DELIVERED'));
  if (!target) throw new Error('세 시연 고객 모두 진행 중인 주문이 있습니다. 주문 완료 또는 전체 초기화 후 다시 시도하세요.');
  await createOrder(target[0], target[1], 'AI_RECOMMENDED');
  Yogiyo.toast(`${target[0]} 신규 주문을 만들었습니다.`);
  await loadDemo();
}

function bindDemoAction(selector, task) {
  document.querySelectorAll(selector).forEach(button => button.addEventListener('click', () => {
    runDemoAction(() => task(button)).catch(error => Yogiyo.toast(error.message));
  }));
}

bindDemoAction('[data-scenario]', button => scenario(Number(button.dataset.count), button.dataset.preference));
bindDemoAction('#applyDataset', () => {
  const dataset = Yogiyo.el('demoDataset').value;
  const config = {single:[1, 'SINGLE'], bundle2:[2, 'AI_RECOMMENDED'], bundle3:[3, 'AI_RECOMMENDED']}[dataset];
  return scenario(config[0], config[1], true);
});
bindDemoAction('#dispatchCalculate', async () => {
  const result = await Yogiyo.apiClient.demo.dispatchCalculate();
  Yogiyo.toast(result.message);
  await loadDemo();
});
bindDemoAction('#resetDemo', async () => {
  stopAutoMove();
  await Yogiyo.apiClient.demo.reset();
  await loadDemo();
});
bindDemoAction('#nextStep', async () => {
  const result = await Yogiyo.apiClient.demo.nextStep();
  Yogiyo.toast(result.message);
  await loadDemo();
});
bindDemoAction('#currentRiderAccept', () => respondCurrentOffer('accept'));
bindDemoAction('#currentRiderDecline', () => respondCurrentOffer('decline'));
bindDemoAction('#burgerDelay', delayBurger);
bindDemoAction('#newOrder', addNewOrder);
bindDemoAction('[data-strategy]', async button => {
  Yogiyo.toast((await Yogiyo.apiClient.demo.strategy({strategy:button.dataset.strategy})).message);
  await loadDemo();
});
bindDemoAction('[data-weather]', async button => {
  Yogiyo.toast((await Yogiyo.apiClient.demo.weather({condition:button.dataset.weather})).message);
  await loadDemo();
});
bindDemoAction('#autoMove', async () => {
  const state = await Yogiyo.apiClient.demo.state();
  Yogiyo.toast((await Yogiyo.apiClient.demo.simulation({running:!state.simulation_running})).message);
  if (state.simulation_running) stopAutoMove();
  await loadDemo();
});

configureDemoMode();
Yogiyo.websocket('demo', 'console', loadDemo);
window.addEventListener('beforeunload', stopAutoMove, {once:true});
loadDemo();

}
