let autoMoveTimer;

function stopAutoMove() {
  if (autoMoveTimer) window.clearInterval(autoMoveTimer);
  autoMoveTimer = undefined;
}

function syncAutoMove(state) {
  Yogiyo.el('autoMove').textContent = state.simulation_running ? '자동 시연 일시정지' : '자동 시연 시작';
  if (!state.simulation_running || autoMoveTimer) return;
  autoMoveTimer = window.setInterval(async () => {
    try {
      const latest = await Yogiyo.apiClient.demo.state();
      if (!latest.simulation_running) return stopAutoMove();
      await Yogiyo.apiClient.demo.nextStep();
      await loadDemo();
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
    Yogiyo.el('summaryDuration').textContent = new Date(state.simulation_clock).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false});
    Yogiyo.el('summaryStrategy').textContent = state.route_strategy === 'MIXED' ? '혼합 최적화' : '전체 픽업 후 배달';
    Yogiyo.el('summaryRevenue').textContent = packages.map(pkg => `${pkg.package_id}: ${pkg.assigned_rider_id || '제안 중'}`).join(' · ') || '-';
    Yogiyo.el('summaryRider').textContent = Object.entries(state.riders).map(([id,rider]) => `${id} ${rider.status}`).join(' · ');
    Yogiyo.el('summaryVersion').textContent = state.version;
    Yogiyo.el('eventList').innerHTML = state.events.length ? state.events.map(item => `<div class="event"><code>${Yogiyo.escape(item.type)}</code><span>${Yogiyo.escape(item.message)}</span><time>${Yogiyo.fmtTime(item.occurred_at)}</time></div>`).join('') : '<div class="event"><span>새 시나리오를 시작하세요.</span></div>';
    Yogiyo.el('connectionText').textContent = `실시간 연결 · v${state.version}`;
    syncAutoMove(state);
  } catch (error) {
    Yogiyo.el('connectionText').textContent = error.message;
  }
}

async function createOrder(customerId, storeId, preference) {
  const result = await Yogiyo.apiClient.orders.create({customer_id:customerId,store_id:storeId,items:[{name:'시연 주문',quantity:1}],delivery_preference:preference});
  await Yogiyo.apiClient.merchant.orderAction(result.order_id,{action:'accept'});
  return result.order_id;
}

async function scenario(count, preference, dispatchAfter=false) {
  await Yogiyo.apiClient.demo.reset();
  const targets = [['C-001','S-001'],['C-002','S-002'],['C-003','S-003']].slice(0,count);
  for (const [customerId,storeId] of targets) await createOrder(customerId,storeId,preference);
  if (dispatchAfter) await Yogiyo.apiClient.demo.dispatchCalculate();
  Yogiyo.toast(`${preference === 'AI_RECOMMENDED' ? 'AI 추천' : '단일'} 주문 ${count}건을 ${dispatchAfter ? '배차 제안까지' : '수락 대기 상태로'} 만들었습니다.`);
  await loadDemo();
}

async function respondCurrentOffer(action) {
  const state = await Yogiyo.apiClient.demo.state();
  const pkg = Object.values(state.packages).find(item => Object.values(item.offers || {}).some(offer => offer.status === 'OFFERED'));
  if (!pkg) throw new Error('응답할 라이더 제안이 없습니다. 먼저 AI 배차를 계산하세요.');
  const riderId = Object.entries(pkg.offers).find(([,offer]) => offer.status === 'OFFERED')[0];
  const result = await Yogiyo.apiClient.rider.offerResponse(riderId,pkg.package_id,{action});
  Yogiyo.toast(`${riderId}: ${result.message}`);
  await loadDemo();
}

async function delayBurger() {
  let state = await Yogiyo.apiClient.demo.state();
  let order = Object.values(state.orders).find(item => item.store_id === 'S-002' && item.status !== 'DELIVERED');
  if (!order) {
    const orderId = await createOrder('C-002','S-002','AI_RECOMMENDED');
    state = await Yogiyo.apiClient.demo.state();
    order = state.orders[orderId];
  }
  if (order.status === 'MATCHING') await Yogiyo.apiClient.merchant.orderAction(order.order_id,{action:'start'});
  await Yogiyo.apiClient.merchant.orderAction(order.order_id,{action:'delay',delay_min:7});
  Yogiyo.toast('버거 매장 조리 예상시간을 7분 늦췄습니다.');
  await loadDemo();
}

async function addNewOrder() {
  const state = await Yogiyo.apiClient.demo.state();
  const targets = [['C-001','S-001'],['C-002','S-002'],['C-003','S-003']];
  const target = targets.find(([customerId]) => !Object.values(state.orders).some(order => order.customer_id === customerId && order.status !== 'DELIVERED'));
  if (!target) throw new Error('세 시연 고객 모두 진행 중인 주문이 있습니다. 주문 완료 또는 전체 초기화 후 다시 시도하세요.');
  await createOrder(target[0],target[1],'AI_RECOMMENDED');
  Yogiyo.toast(`${target[0]} 신규 주문을 만들었습니다.`);
  await loadDemo();
}

document.querySelectorAll('[data-scenario]').forEach(button => button.addEventListener('click', async () => {
  try { await scenario(Number(button.dataset.count),button.dataset.preference); }
  catch (error) { Yogiyo.toast(error.message); }
}));

Yogiyo.el('applyDataset').addEventListener('click', async () => {
  const dataset = Yogiyo.el('demoDataset').value;
  const config = {single:[1,'SINGLE'],bundle2:[2,'AI_RECOMMENDED'],bundle3:[3,'AI_RECOMMENDED']}[dataset];
  try { await scenario(config[0],config[1],true); }
  catch (error) { Yogiyo.toast(error.message); }
});
Yogiyo.el('dispatchCalculate').addEventListener('click', async () => { try { const result=await Yogiyo.apiClient.demo.dispatchCalculate(); Yogiyo.toast(result.message); await loadDemo(); } catch (error) { Yogiyo.toast(error.message); } });
Yogiyo.el('resetDemo').addEventListener('click', async () => { try { stopAutoMove(); await Yogiyo.apiClient.demo.reset(); await loadDemo(); } catch (error) { Yogiyo.toast(error.message); } });
Yogiyo.el('nextStep').addEventListener('click', async () => { try { Yogiyo.toast((await Yogiyo.apiClient.demo.nextStep()).message); await loadDemo(); } catch (error) { Yogiyo.toast(error.message); } });
Yogiyo.el('currentRiderAccept').addEventListener('click', () => respondCurrentOffer('accept').catch(error => Yogiyo.toast(error.message)));
Yogiyo.el('currentRiderDecline').addEventListener('click', () => respondCurrentOffer('decline').catch(error => Yogiyo.toast(error.message)));
Yogiyo.el('burgerDelay').addEventListener('click', () => delayBurger().catch(error => Yogiyo.toast(error.message)));
Yogiyo.el('newOrder').addEventListener('click', () => addNewOrder().catch(error => Yogiyo.toast(error.message)));
document.querySelectorAll('[data-strategy]').forEach(button => button.addEventListener('click', async () => { try { Yogiyo.toast((await Yogiyo.apiClient.demo.strategy({strategy:button.dataset.strategy})).message); await loadDemo(); } catch (error) { Yogiyo.toast(error.message); } }));
document.querySelectorAll('[data-weather]').forEach(button => button.addEventListener('click', async () => { try { Yogiyo.toast((await Yogiyo.apiClient.demo.weather({condition:button.dataset.weather})).message); await loadDemo(); } catch (error) { Yogiyo.toast(error.message); } }));
Yogiyo.el('autoMove').addEventListener('click', async () => { try { const state=await Yogiyo.apiClient.demo.state(); Yogiyo.toast((await Yogiyo.apiClient.demo.simulation({running:!state.simulation_running})).message); if (state.simulation_running) stopAutoMove(); await loadDemo(); } catch (error) { Yogiyo.toast(error.message); } });
Yogiyo.websocket('demo','console',loadDemo);
window.addEventListener('beforeunload',stopAutoMove,{once:true});
(async () => { if (Yogiyo.useMock) await Yogiyo.apiClient.demo.reset(); await loadDemo(); })();
