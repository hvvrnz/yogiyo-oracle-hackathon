let datasetsLoaded = false;

Yogiyo.el('backendDocsLink').href = Yogiyo.apiUrl('/docs');

async function loadDatasets() {
  const payload = await Yogiyo.apiClient.demo.datasets();
  const select = Yogiyo.el('datasetSelect');
  select.innerHTML = payload.datasets.map(item => `<option value="${Yogiyo.escape(item.dataset_id)}" ${item.dataset_id === payload.active_dataset_id ? 'selected' : ''}>${Yogiyo.escape(item.name)}</option>`).join('');
  datasetsLoaded = true;
}

async function loadDemo() {
  try {
    if (!datasetsLoaded) await loadDatasets();
    const state = await Yogiyo.apiClient.demo.state();
    const pkg = state.packages['PKG-001'];
    Yogiyo.el('summaryStatus').textContent = pkg.status_label;
    Yogiyo.el('summaryOrders').textContent = `${pkg.bundle_size}건`;
    Yogiyo.el('summaryDuration').textContent = `${pkg.estimated_duration_min}분`;
    Yogiyo.el('summaryStrategy').textContent = pkg.route_strategy_label;
    Yogiyo.el('summaryRevenue').textContent = Yogiyo.money(pkg.hourly_revenue);
    const activeRiderId = pkg.rider_id || pkg.offered_rider_id || Yogiyo.defaultIds.rider;
    const activeRider = state.riders[activeRiderId];
    Yogiyo.el('summaryRider').textContent = activeRider ? `${activeRider.display_name} · ${pkg.offer_attempt || 0}차` : '후보 없음';
    Yogiyo.el('summaryVersion').textContent = state.version;
    Yogiyo.el('eventList').innerHTML = state.events.length ? state.events.map(event => `<div class="event"><code>${Yogiyo.escape(event.type)}</code><span>${Yogiyo.escape(event.message)}</span><time>${Yogiyo.fmtTime(event.occurred_at)}</time></div>`).join('') : '<div class="event"><span>이벤트가 없습니다.</span></div>';
    Yogiyo.el('connectionText').textContent = `실시간 연결 · v${state.version}`;
  } catch (error) { Yogiyo.el('connectionText').textContent = error.message; }
}

async function post(request) {
  try {
    const result = await request();
    await loadDemo();
    document.querySelectorAll('.phone-frame').forEach(frame => frame.contentWindow?.location.reload());
    return result;
  } catch (error) { alert(error.message); }
}

Yogiyo.el('applyDataset').addEventListener('click', async () => {
  const datasetId = Yogiyo.el('datasetSelect').value;
  if (!datasetId) return;
  await post(() => Yogiyo.apiClient.demo.dataset({dataset_id: datasetId}));
  datasetsLoaded = false;
  await loadDemo();
});
document.querySelectorAll('[data-command]').forEach(button => button.addEventListener('click', () => post(() => Yogiyo.apiClient.demo.command(button.dataset.command))));
document.querySelectorAll('[data-virtual-order]').forEach(button => button.addEventListener('click', () => post(() => Yogiyo.apiClient.orders.create({customer_id:button.dataset.virtualOrder, store_id:button.dataset.store, items:[{name:'가상 고객 시연 주문',quantity:1}]}))));
document.querySelectorAll('[data-route-strategy]').forEach(button => button.addEventListener('click', () => post(() => Yogiyo.apiClient.demo.routeStrategy({strategy:button.dataset.routeStrategy}))));
document.querySelectorAll('[data-weather]').forEach(button => button.addEventListener('click', () => post(() => Yogiyo.apiClient.demo.weather({condition:button.dataset.weather}))));
document.querySelectorAll('[data-simulation]').forEach(button => button.addEventListener('click', () => post(() => Yogiyo.apiClient.demo.simulation({running:button.dataset.simulation === 'true'}))));
Yogiyo.websocket('demo','console',loadDemo);
loadDemo();
