window.Yogiyo = (() => {
  const config = window.__YGY_CONFIG__ || {};
  const useMock = String(config.useMock ?? 'true').toLowerCase() !== 'false';
  const apiBaseUrl = String(config.apiBaseUrl || '').replace(/\/+$/, '');
  const wsBaseUrl = String(config.wsBaseUrl || '').replace(/\/+$/, '');
  const apiPaths = config.apiPaths && typeof config.apiPaths === 'object' ? config.apiPaths : {};
  const storageKey = 'ygy-demo-mock-state-v3';
  const clone = value => JSON.parse(JSON.stringify(value));
  const now = () => new Date().toISOString();
  const ids = Object.freeze({customer: '1', merchant: '884', rider: 'rider_102'});
  const labels = {SINGLE:'단일 배달', AI_RECOMMENDED:'AI 추천 배달', SINGLE_DELIVERY:'개별 배달', AI_BUNDLE_2:'AI 추천 2건 묶음', AI_BUNDLE_3:'AI 추천 3건 묶음'};
  const stores = {
    'S-001': {name:'요기요 치킨 강남점', category:'치킨', base_cooking_min:16, lat:37.500, lng:127.030},
    'S-002': {name:'요기요 버거 역삼점', category:'버거', base_cooking_min:12, lat:37.497, lng:127.028},
    'S-003': {name:'요기요 한식 선릉점', category:'한식', base_cooking_min:14, lat:37.495, lng:127.025},
  };
  const customerLocations = {
    'C-001': {display_name:'고객 A', lat:37.502, lng:127.033},
    'C-002': {display_name:'고객 B', lat:37.494, lng:127.035},
    'C-003': {display_name:'고객 C', lat:37.490, lng:127.029},
  };
  const serviceMap = Object.freeze({
    bounds: {min_lat:37.488, max_lat:37.506, min_lng:127.018, max_lng:127.038},
    regions: [
      {label:'강남역 권역', points:[{lat:37.506,lng:127.029},{lat:37.506,lng:127.038},{lat:37.498,lng:127.038},{lat:37.498,lng:127.030}]},
      {label:'역삼 권역', points:[{lat:37.503,lng:127.021},{lat:37.503,lng:127.030},{lat:37.494,lng:127.031},{lat:37.494,lng:127.021}]},
      {label:'선릉 권역', points:[{lat:37.496,lng:127.021},{lat:37.496,lng:127.030},{lat:37.488,lng:127.032},{lat:37.488,lng:127.021}]},
    ],
  });
  const customerStoreIds = {'C-001':'S-001','C-002':'S-002','C-003':'S-003'};
  const menuFor = storeId => ({
    'S-001': {summary:'반반치킨 · 콜라', amount:23900, items:[{name:'반반치킨',quantity:1},{name:'콜라',quantity:1}]},
    'S-002': {summary:'치즈버거 세트', amount:15900, items:[{name:'치즈버거',quantity:1},{name:'감자튀김',quantity:1}]},
    'S-003': {summary:'제육볶음 정식', amount:13800, items:[{name:'제육볶음',quantity:1},{name:'공기밥',quantity:1}]},
  }[storeId]);
  const makeMock = () => ({
    customers: clone(customerLocations), stores: Object.fromEntries(Object.entries(stores).map(([id, store]) => [id, {...store, order_ids:[]}])),
    orders: {}, packages: {},
    riders: {
      'R-001': {rider_id:'R-001',display_name:'민준 라이더',vehicle:'오토바이',lat:37.498,lng:127.027,status:'AVAILABLE',status_label:'운행 가능',active_package_id:null},
      'R-002': {rider_id:'R-002',display_name:'서연 라이더',vehicle:'오토바이',lat:37.503,lng:127.021,status:'AVAILABLE',status_label:'운행 가능',active_package_id:null},
      'R-003': {rider_id:'R-003',display_name:'도윤 라이더',vehicle:'전기자전거',lat:37.491,lng:127.031,status:'AVAILABLE',status_label:'운행 가능',active_package_id:null},
    },
    demo: {version:1, weather:'CLEAR', simulation_clock:'2026-08-07T12:00:00.000Z', route_strategy:'PICKUPS_FIRST', simulation_running:false, events:[]},
  });
  const mock = makeMock();
  const hydrate = () => { try { const saved = JSON.parse(localStorage.getItem(storageKey)); if (saved?.orders && saved?.packages && saved?.demo) Object.assign(mock, saved); } catch {} };
  hydrate();
  const persist = () => localStorage.setItem(storageKey, JSON.stringify(mock));
  const clock = () => mock.demo.simulation_clock;
  const advance = (minutes=1) => { mock.demo.simulation_clock = new Date(new Date(clock()).getTime() + minutes * 60000).toISOString(); };
  const event = (type, message, minutes=1) => { advance(minutes); mock.demo.version += 1; mock.demo.events.unshift({type,message,occurred_at:clock()}); persist(); };
  const weather = () => mock.demo.weather === 'RAIN'
    ? {condition:'RAIN',label:'비',temperature_c:21,advisory:'강수로 이동 시간이 늘어날 수 있어요.',travel_delay_min:5,travel_speed_kmh:16}
    : {condition:'CLEAR',label:'맑음',temperature_c:25,advisory:'원활한 배달 환경이에요.',travel_delay_min:0,travel_speed_kmh:24};
  const qualityLimitFor = order => ({'S-001':25,'S-002':18,'S-003':22}[order.store_id] || 20);
  const activeOrders = () => Object.values(mock.orders).filter(order => !['DELIVERED'].includes(order.status));
  const statusLabel = status => ({NEW:'신규 주문',ACCEPTED:'주문 수락',MATCHING:'AI 추천 배달 분석 중',COOKING:'조리 중',READY:'조리 완료',PICKED_UP:'픽업 완료',DELIVERED:'배달 완료'}[status] || status);
  const setStatus = (order, status) => { order.status = status; order.status_label = statusLabel(status); };
  const packageForOrder = order => mock.packages[order.package_id] || null;
  const haversineKm = (from, to) => {
    const radians = value => value * Math.PI / 180;
    const earthRadiusKm = 6371;
    const latDelta = radians(to.lat - from.lat);
    const lngDelta = radians(to.lng - from.lng);
    const a = Math.sin(latDelta / 2) ** 2
      + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(lngDelta / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  const travelDurationMin = distanceKm => Math.max(1, Math.ceil(distanceKm / weather().travel_speed_kmh * 60));
  const estimatedRiderFor = orders => {
    const firstStore = mock.stores[orders[0].store_id];
    return Object.values(mock.riders)
      .filter(rider => rider.status !== 'ASSIGNED')
      .sort((left, right) => haversineKm(left, firstStore) - haversineKm(right, firstStore))[0]
      || Object.values(mock.riders)[0];
  };
  const routeFor = (orders, rider=estimatedRiderFor(orders)) => {
    const pickups = orders.map(order => ({status:'PENDING',is_current:false,order_id:order.order_id,destination:mock.stores[order.store_id].name,address:'매장 위치',type:'PICKUP',lat:order.store_lat,lng:order.store_lng}));
    const deliveries = orders.map(order => ({status:'PENDING',is_current:false,order_id:order.order_id,destination:mock.customers[order.customer_id].display_name,address:'고객 배송지',type:'DELIVERY',lat:order.customer_lat,lng:order.customer_lng}));
    const steps = mock.demo.route_strategy === 'MIXED' ? orders.flatMap((_, index) => [pickups[index], deliveries[index]]) : [...pickups, ...deliveries];
    let previousPoint = rider;
    return steps.map((step, index) => {
      const distance_km = Number(haversineKm(previousPoint, step).toFixed(2));
      previousPoint = step;
      return {...step, sequence:index + 1, distance_km, duration_min:travelDurationMin(distance_km)};
    });
  };
  const refreshPackageMetrics = pkg => {
    pkg.route_steps.forEach(step => { step.duration_min = travelDurationMin(step.distance_km); });
    pkg.total_distance_km = Number(pkg.route_steps.reduce((sum, step) => sum + step.distance_km, 0).toFixed(2));
    pkg.package_revenue = Math.round(pkg.route_steps.filter(step => step.type === 'DELIVERY').reduce((sum, step) => sum + 3000 + Math.max(0, step.distance_km - 1) * 500, 0));
    const orders = pkg.order_ids.map(orderId => mock.orders[orderId]).filter(Boolean);
    const origin = pkg.route_origin || mock.riders[pkg.assigned_rider_id] || estimatedRiderFor(orders);
    const standaloneDistance = orders.reduce((sum, order) => {
      const store = mock.stores[order.store_id];
      const customer = mock.customers[order.customer_id];
      return sum + haversineKm(origin, store) + haversineKm(store, customer);
    }, 0);
    const firstOrder = orders[0];
    const firstStore = firstOrder && mock.stores[firstOrder.store_id];
    const firstCustomer = firstOrder && mock.customers[firstOrder.customer_id];
    const firstOrderDistance = firstOrder ? haversineKm(origin, firstStore) + haversineKm(firstStore, firstCustomer) : 0;
    const cookingMinutes = orders.map(order => order.predicted_cooking_min || 0);
    pkg.route_saving_pct = orders.length > 1 && standaloneDistance > 0 ? Math.max(0, Math.round((1 - pkg.total_distance_km / standaloneDistance) * 100)) : 0;
    pkg.additional_distance_km = Number(Math.max(0, pkg.total_distance_km - firstOrderDistance).toFixed(2));
    pkg.ready_gap_min = cookingMinutes.length ? Math.max(...cookingMinutes) - Math.min(...cookingMinutes) : 0;
  };
  const recalcEta = pkg => {
    refreshPackageMetrics(pkg);
    let minutes = weather().travel_delay_min;
    const pickupAt = {};
    let totalWait = 0;
    pkg.route_steps.forEach(step => {
      const order = mock.orders[step.order_id];
      if (!order || step.status === 'COMPLETED') return;
      const arrivalMinutes = minutes + step.duration_min;
      step.arrival_at = new Date(new Date(clock()).getTime() + arrivalMinutes * 60000).toISOString();
      const waitMin = step.type === 'PICKUP' && order.status !== 'READY'
        ? Math.max(0, (order.remaining_cooking_min || 0) - arrivalMinutes)
        : 0;
      step.wait_min = Math.round(waitMin);
      totalWait += waitMin;
      minutes = arrivalMinutes + waitMin;
      if (step.type === 'PICKUP') pickupAt[order.order_id] = minutes;
      if (step.type === 'DELIVERY') order.eta_at = step.arrival_at;
      if (step.type === 'DELIVERY') {
        const bagTime = Math.max(0, Math.round(minutes - (pickupAt[order.order_id] ?? 0)));
        const limit = qualityLimitFor(order);
        order.bag_time_min = bagTime;
        order.bag_time_limit_min = limit;
        order.quality_margin_min = limit - bagTime;
        order.quality_guard_passed = bagTime <= limit;
      }
      step.eta_label = new Date(step.arrival_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false});
    });
    pkg.total_wait_min = Math.round(totalWait);
    pkg.estimated_duration_min = Math.round(minutes);
    pkg.hourly_revenue = pkg.estimated_duration_min > 0 ? Math.round(pkg.package_revenue / pkg.estimated_duration_min * 60) : 0;
  };
  const routeStrategy = () => mock.demo.route_strategy === 'MIXED'
    ? {label:'혼합 최적화 경로',description:'각 주문의 조리 완료 시점에 맞춰 픽업과 배달을 교차합니다.'}
    : {label:'전체 픽업 후 배달',description:'모든 매장을 먼저 방문한 뒤 고객 배송을 진행합니다.'};
  const makePackage = (orders, type) => {
    const id = `PKG-${String(Object.keys(mock.packages).length + 1).padStart(3,'0')}`;
    const routeRider = estimatedRiderFor(orders);
    const route_steps = routeFor(orders, routeRider); const isBundle = type.startsWith('AI_BUNDLE_'); const bundleSize = orders.length;
    const pkg = {package_id:id, delivery_type:type, delivery_type_label:labels[type], order_ids:orders.map(order => order.order_id), status:'OFFERED', assigned_rider_id:null,
      // A rider may receive more than one offer at once; only an already assigned
      // rider is excluded from new packages.
      offers:Object.fromEntries(Object.keys(mock.riders).filter(riderId => mock.riders[riderId].status !== 'ASSIGNED').map(riderId => [riderId,{status:'OFFERED',offered_at:clock(),responded_at:null}])),
      bundle_reasons:isBundle ? [`${bundleSize}개 주문의 조리 완료 예상 시각 차이가 허용 범위 안입니다.`,`${bundleSize}개 매장과 고객 위치의 이동 동선이 겹칩니다.`,`${bundleSize}개 주문 모두 음식 품질 제한 시간을 충족합니다.`] : [orders[0].delivery_preference === 'SINGLE' ? '고객이 단일 배달을 선택했습니다.' : '현재 AI 추천 주문이 한 건이라 개별 배달로 진행합니다.'],
      route_steps, route_origin:{lat:routeRider.lat,lng:routeRider.lng}, estimated_duration_min:0, total_distance_km:0, package_revenue:0, hourly_revenue:0, total_wait_min:0, route_saving_pct:0, additional_distance_km:0, ready_gap_min:0, route_strategy_label:routeStrategy().label, route_strategy_description:routeStrategy().description};
    mock.packages[id] = pkg;
    orders.forEach(order => { order.package_id=id; order.resolved_delivery_type=type; order.resolved_delivery_label=labels[type]; order.status='MATCHING'; order.status_label='라이더 배차 제안 중'; });
    Object.keys(pkg.offers).forEach(riderId => { mock.riders[riderId].status='OFFERED'; mock.riders[riderId].status_label='새 배차 제안 확인 중'; });
    recalcEta(pkg); return pkg;
  };
  const dispatch = () => {
    const candidates = activeOrders().filter(order => ['ACCEPTED','MATCHING','COOKING','READY'].includes(order.status) && !order.package_id);
    const singles = candidates.filter(order => order.delivery_preference === 'SINGLE');
    const ai = candidates.filter(order => order.delivery_preference === 'AI_RECOMMENDED');
    const created = singles.map(order => makePackage([order], 'SINGLE_DELIVERY'));
    for (let index=0; index<ai.length; index+=3) { const group=ai.slice(index,index+3); const type=group.length === 3 ? 'AI_BUNDLE_3' : group.length === 2 ? 'AI_BUNDLE_2' : 'SINGLE_DELIVERY'; created.push(makePackage(group, type)); }
    event('dispatch.calculated', created.length ? `${created.length}개 패키지를 모든 가용 라이더에게 동시에 제안했습니다.` : '배차 계산할 수락 주문이 없습니다.');
    return {message:created.length ? 'AI 배차 계산을 완료했습니다.' : '배차 대기 주문이 없습니다.', package_ids:Object.keys(mock.packages)};
  };
  const recalcAllPackages = () => Object.values(mock.packages).filter(pkg => pkg.status !== 'COMPLETED').forEach(recalcEta);
  const setRouteStrategy = strategy => {
    mock.demo.route_strategy = strategy === 'MIXED' ? 'MIXED' : 'PICKUPS_FIRST';
    const info = routeStrategy();
    Object.values(mock.packages).filter(pkg => pkg.status === 'OFFERED').forEach(pkg => {
      const orders = pkg.order_ids.map(orderId => mock.orders[orderId]);
      const routeRider = estimatedRiderFor(orders);
      pkg.route_steps = routeFor(orders, routeRider);
      pkg.route_origin = {lat:routeRider.lat,lng:routeRider.lng};
      pkg.route_strategy_label = info.label;
      pkg.route_strategy_description = info.description;
      recalcEta(pkg);
    });
    event('demo.strategy_changed',`${info.label} 전략을 적용했습니다.`);
    return {message:`${info.label} 전략을 적용했습니다.`};
  };
  const moveRiderToward = (rider, target, ratio=.55) => {
    rider.lat += (target.lat - rider.lat) * ratio;
    rider.lng += (target.lng - rider.lng) * ratio;
  };
  const startAutomatedScenario = () => {
    [['C-001','S-001'],['C-002','S-002'],['C-003','S-003']].forEach(([customerId, storeId]) => {
      const created = mockApi('/api/orders', {body:JSON.stringify({customer_id:customerId,store_id:storeId,delivery_preference:'AI_RECOMMENDED'})});
      mockApi(`/api/merchant/orders/${created.order_id}/action`, {body:JSON.stringify({action:'accept'})});
    });
    dispatch();
    event('demo.auto_scenario_started','자동 시연용 AI 추천 3건 주문을 만들고 배차를 제안했습니다.',0);
  };
  const advanceSimulation = () => {
    advance(1);
    const offeredPackage = Object.values(mock.packages).find(pkg => Object.values(pkg.offers).some(offer => offer.status === 'OFFERED'));
    if (offeredPackage) {
      const riderId = Object.entries(offeredPackage.offers).find(([, offer]) => offer.status === 'OFFERED')[0];
      mockApi(`/api/rider/${riderId}/packages/${offeredPackage.package_id}/offer-response`, {body:JSON.stringify({action:'accept'})});
      return {message:`${riderId}가 AI 추천 배차를 수락했습니다.`};
    }
    const activePackage = Object.values(mock.packages).find(pkg => ['ASSIGNED','IN_PROGRESS'].includes(pkg.status));
    if (activePackage) {
      const step = activePackage.route_steps.find(item => item.is_current);
      const rider = mock.riders[activePackage.assigned_rider_id];
      const order = step && mock.orders[step.order_id];
      if (!step || !rider || !order) throw new Error('자동 시연에 필요한 현재 경로 정보를 찾지 못했습니다.');
      moveRiderToward(rider, step);
      if (step.type === 'PICKUP') {
        if (order.status === 'MATCHING') {
          mockApi(`/api/merchant/orders/${order.order_id}/action`, {body:JSON.stringify({action:'start'})});
          return {message:`${order.order_id} 조리를 시작하고 라이더가 픽업 매장으로 이동했습니다.`};
        }
        if (order.status === 'COOKING') {
          mockApi(`/api/merchant/orders/${order.order_id}/action`, {body:JSON.stringify({action:'ready'})});
          return {message:`${order.order_id} 조리가 완료되어 픽업 준비가 됐습니다.`};
        }
        mockApi(`/api/rider/${rider.rider_id}/orders/${order.order_id}/pickup`, {body:'{}'});
        return {message:`${order.order_id} 픽업을 완료하고 다음 경로로 이동합니다.`};
      }
      mockApi(`/api/rider/${rider.rider_id}/orders/${order.order_id}/deliver`, {body:'{}'});
      return {message:`${order.order_id} 배달을 완료하고 다음 경로로 이동합니다.`};
    }
    if (activeOrders().some(order => !order.package_id)) {
      const result = dispatch();
      return {message:result.message};
    }
    if (Object.values(mock.packages).some(pkg => pkg.status === 'COMPLETED')) {
      mock.demo.simulation_running = false;
      event('demo.auto_completed','모든 주문의 픽업과 배달이 완료되어 자동 시연을 멈췄습니다.',0);
      return {message:'자동 시연이 모든 주문 배달까지 완료됐습니다.'};
    }
    startAutomatedScenario();
    return {message:'자동 시연용 AI 추천 3건 주문과 배차 제안을 만들었습니다.'};
  };
  const orderForCustomer = customerId => Object.values(mock.orders).filter(order => order.customer_id === customerId).sort((a,b) => b.created_at.localeCompare(a.created_at))[0];
  const customerView = customerId => {
    const defaultStoreId = customerStoreIds[customerId] || 'S-001';
    const defaultMenu = menuFor(defaultStoreId);
    const order = orderForCustomer(customerId) || {order_id:'새 주문 없음',customer_id:customerId,store_id:defaultStoreId,status:'DELIVERED',status_label:'주문을 만들어 시연을 시작하세요.',menu_summary:defaultMenu.summary,amount:0,items:[],request_note:'-',delivery_preference:'AI_RECOMMENDED',delivery_preference_label:labels.AI_RECOMMENDED};
    const pkg = packageForOrder(order); const rider = pkg && mock.riders[pkg.assigned_rider_id];
    const eta = order.eta_at ? new Date(order.eta_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}) : '배차 계산 중';
    const message = order.status === 'MATCHING' && !pkg ? `AI 추천 배달 분석 중 · 현재 AI 추천 주문: ${activeOrders().filter(item => item.delivery_preference === 'AI_RECOMMENDED' && !item.package_id).length}건 · 2~3건 묶음 조건을 확인하고 있어요.` : String(order.resolved_delivery_type || '').startsWith('AI_BUNDLE_') ? `AI 추천 결과: 조리 시간, 매장 위치, 고객 위치를 반영한 ${pkg.order_ids.length}건 묶음 배차입니다.` : order.resolved_delivery_type ? 'AI 추천 결과: 현재 묶음 조건이 충족되지 않아 개별 배달로 배정합니다.' : order.status_label;
    const qualityLimit = order.bag_time_limit_min ?? qualityLimitFor(order);
    const bagTime = order.bag_time_min ?? 0;
    return {order:{...order,eta_window:order.status === 'DELIVERED' ? '배달 완료' : eta,current_message:message,delivery_sequence:pkg ? pkg.order_ids.indexOf(order.order_id)+1 : '-',eta_updated_label:`${new Date(clock()).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})} 기준`,remaining_min:order.status === 'DELIVERED'?0:Math.max(0,Math.round((new Date(order.eta_at || clock())-new Date(clock()))/60000)),progress_index:{NEW:0,ACCEPTED:1,MATCHING:1,COOKING:2,READY:3,PICKED_UP:4,DELIVERED:6}[order.status] ?? 0,bag_time_min:bagTime,bag_time_limit_min:qualityLimit,quality_margin_min:order.quality_margin_min ?? qualityLimit-bagTime,quality_guard_passed:order.quality_guard_passed ?? bagTime<=qualityLimit},store:mock.stores[order.store_id],package:pkg || {ready_gap_min:0,route_saving_pct:0,route_strategy_label:'배차 분석 대기',route_strategy_description:'주문 수락 후 배차 계산을 실행합니다.',bundle_reasons:[]},rider:{assigned:Boolean(rider),current_step_label:rider ? `${rider.display_name} 배정 완료` : '라이더 배차를 기다리고 있어요',...(rider || {})},weather:weather(),route:(pkg?.route_steps || []).map(step => ({...step,is_own:step.order_id === order.order_id && step.type === 'DELIVERY'}))};
  };
  const merchantView = storeId => {
    const store=mock.stores[storeId]; if (!store) throw new Error('존재하지 않는 매장입니다.'); const orders=store.order_ids.map(id => mock.orders[id]).filter(Boolean); const pkg=orders.map(packageForOrder).find(Boolean); const rider=pkg && mock.riders[pkg.assigned_rider_id];
    const delayMinutes=orders.reduce((sum,order)=>sum+Math.max(0,(order.predicted_cooking_min||store.base_cooking_min)-store.base_cooking_min),0);
    const predictionAccuracy=Math.max(70,96-delayMinutes);
    const congestion=orders.length>=3?'혼잡':orders.length>=2?'보통':'여유';
    const pickupStep = pkg?.route_steps.find(step => step.type === 'PICKUP' && step.order_id && mock.orders[step.order_id]?.store_id === storeId && step.status !== 'COMPLETED');
    const riderDistance = rider && pickupStep ? Number(haversineKm(rider, pickupStep).toFixed(2)) : null;
    const routeArrival = pickupStep?.arrival_at ? Math.max(0, Math.ceil((new Date(pickupStep.arrival_at) - new Date(clock())) / 60000)) : 0;
    const riderArrival = riderDistance == null ? null : Math.max(travelDurationMin(riderDistance), routeArrival);
    return {store:{...store,prediction_accuracy_pct:predictionAccuracy,congestion},summary:{new_count:orders.filter(o=>o.status==='NEW').length,cooking_count:orders.filter(o=>['COOKING','MATCHING','ACCEPTED'].includes(o.status)).length,ready_count:orders.filter(o=>o.status==='READY').length},orders,rider:{assigned:Boolean(rider),arrival_label:rider?`${rider.display_name} 매장 이동 중`:'라이더 배차 제안 중',remaining_min:riderArrival,distance_km:riderDistance,context:rider?`${rider.display_name}의 현재 좌표와 다음 픽업 경로를 기준으로 계산했습니다.`:'수락 후 AI 배차 계산을 실행하세요.'},package:pkg || {status_label:'배차 분석 대기',bundle_size:0,route_strategy_label:'-',ready_gap_min:0,total_wait_min:0,selected_route_reason:'수락한 주문의 고객 배송 선택을 분석합니다.'},weather:weather()};
  };
  const riderView = riderId => {
    const rider=mock.riders[riderId]; if (!rider) throw new Error('존재하지 않는 라이더입니다.'); const offered=Object.values(mock.packages).filter(pkg => pkg.offers[riderId]?.status === 'OFFERED'); const assigned=Object.values(mock.packages).filter(pkg => pkg.assigned_rider_id === riderId && pkg.status !== 'COMPLETED'); const packages=[...assigned,...offered].map(pkg => ({...pkg,can_accept:pkg.offers[riderId]?.status==='OFFERED',accepted:pkg.assigned_rider_id===riderId,current_step:pkg.route_steps.find(step=>step.is_current) || null})); const primary=packages[0] || {status:'AVAILABLE',status_label:rider.status==='WAITING'?'다른 라이더가 먼저 수락했어요 · 다른 배차를 찾고 있어요':'새 배차를 기다리고 있어요',delivery_type_label:'-',order_ids:[],bundle_reasons:[],estimated_duration_min:0,total_distance_km:0,package_revenue:0,hourly_revenue:0,route_steps:[],can_accept:false,accepted:false};
    const readiness=Object.values(mock.orders).filter(order => primary.order_ids.includes(order.order_id)).map(order => ({status:order.status,status_label:order.status_label,store_name:mock.stores[order.store_id].name,remaining_min:order.remaining_cooking_min || 0,ready_at:order.ready_at || '조리 완료 대기'}));
    return {rider,package:primary,packages,steps:primary.route_steps,store_readiness:readiness,weather:weather()};
  };
  const state = () => ({version:mock.demo.version,simulation_clock:clock(),route_strategy:mock.demo.route_strategy,simulation_running:mock.demo.simulation_running,orders:mock.orders,packages:mock.packages,riders:mock.riders,events:mock.demo.events});
  const hasOpenOffer = riderId => Object.values(mock.packages).some(pkg => pkg.status === 'OFFERED' && pkg.offers[riderId]?.status === 'OFFERED');
  const syncRiderOfferStatus = (riderId, {waitingWhenEmpty=false}={}) => {
    const rider = mock.riders[riderId];
    if (!rider || rider.active_package_id) return;
    if (hasOpenOffer(riderId)) {
      rider.status = 'OFFERED';
      rider.status_label = '새 배차 제안 확인 중';
    } else if (waitingWhenEmpty) {
      rider.status = 'WAITING';
      rider.status_label = '다른 라이더가 먼저 수락했어요 · 다른 배차를 찾고 있어요';
    } else {
      rider.status = 'AVAILABLE';
      rider.status_label = '운행 가능';
    }
  };
  const mockApi = (path, options={}) => {
    const pathname=new URL(path,location.origin).pathname; const body=options.body?JSON.parse(options.body):{};
    if (pathname === '/api/orders') { const store=mock.stores[body.store_id || 'S-001']; const customerId=body.customer_id || 'C-001'; const existing=activeOrders().find(order=>order.customer_id===customerId); if(existing) throw new Error('진행 중인 주문이 이미 있습니다.'); const menu=menuFor(body.store_id || 'S-001'); const id=`O-${1001+Object.keys(mock.orders).length}`; const preference=body.delivery_preference || 'AI_RECOMMENDED'; const customer=mock.customers[customerId]; const order={order_id:id,customer_id:customerId,store_id:body.store_id || 'S-001',delivery_preference:preference,delivery_preference_label:labels[preference],resolved_delivery_type:null,resolved_delivery_label:null,package_id:null,rider_id:null,status:'NEW',status_label:'신규 주문',created_at:clock(),accepted_at:null,cooking_started_at:null,ready_at:null,picked_up_at:null,delivered_at:null,eta_at:null,predicted_cooking_min:store.base_cooking_min,remaining_cooking_min:store.base_cooking_min,store_lat:store.lat,store_lng:store.lng,customer_lat:customer.lat,customer_lng:customer.lng,menu_summary:menu.summary,items:body.items?.length?body.items:menu.items,amount:menu.amount,request_note:'문 앞에 놓아주세요.'}; mock.orders[id]=order; store.order_ids.unshift(id); event('order.created',`${store.name}에 ${labels[preference]} ${id} 주문이 접수되었습니다.`); return {message:'주문이 접수되었습니다.',order_id:id}; }
    if (/^\/api\/customer\//.test(pathname)) return customerView(pathname.split('/').pop());
    if (/^\/api\/merchant\/(S-)/.test(pathname)) return merchantView(pathname.split('/').pop());
    if (/^\/api\/rider\/R-\d+$/.test(pathname)) return riderView(pathname.split('/').pop());
    if (pathname === '/api/state') return state();
    if (/^\/api\/merchant\/orders\/[^/]+\/action$/.test(pathname)) { const order=mock.orders[pathname.split('/')[4]]; if(!order) throw new Error('주문을 찾을 수 없습니다.'); if(body.action==='accept'){setStatus(order,'MATCHING');order.accepted_at=clock();} if(body.action==='start'){setStatus(order,'COOKING');order.cooking_started_at=clock();} if(body.action==='ready'){setStatus(order,'READY');order.ready_at=clock();order.remaining_cooking_min=0;} if(body.action==='delay'){order.remaining_cooking_min+=Number(body.delay_min||5);order.predicted_cooking_min+=Number(body.delay_min||5);} recalcAllPackages(); event('merchant.action',`${order.order_id} ${order.status_label} · 관련 ETA를 다시 계산했습니다.`); return {message:'주문 상태와 ETA를 반영했습니다.'}; }
    if (pathname === '/api/demo/dispatch-calculate') return dispatch();
    if (/^\/api\/rider\/R-\d+\/packages\/PKG-\d+\/offer-response$/.test(pathname)) {
      const [, , , riderId,, packageId] = pathname.split('/');
      const pkg = mock.packages[packageId];
      const rider = mock.riders[riderId];
      if (!pkg || pkg.offers[riderId]?.status !== 'OFFERED') throw new Error('이미 다른 라이더가 수락했어요.');
      if (body.action === 'accept') {
        if (rider.active_package_id && rider.active_package_id !== packageId) throw new Error('이미 진행 중인 배차가 있어 추가 배차를 수락할 수 없습니다.');
        pkg.offers[riderId] = {...pkg.offers[riderId], status:'ACCEPTED', responded_at:clock()};
        pkg.assigned_rider_id = riderId;
        pkg.status = 'ASSIGNED';
        pkg.route_steps = routeFor(pkg.order_ids.map(orderId => mock.orders[orderId]), rider);
        pkg.route_origin = {lat:rider.lat,lng:rider.lng};
        pkg.route_steps.find(step => step.status === 'PENDING').is_current = true;
        pkg.order_ids.forEach(id => mock.orders[id].rider_id = riderId);

        Object.values(mock.packages).forEach(otherPkg => {
          if (otherPkg.package_id === packageId) return;
          if (otherPkg.offers[riderId]?.status === 'OFFERED') otherPkg.offers[riderId].status = 'CANCELLED';
        });
        Object.keys(pkg.offers).filter(id => id !== riderId).forEach(id => {
          if (pkg.offers[id].status === 'OFFERED') pkg.offers[id].status = 'CANCELLED';
        });

        rider.status = 'ASSIGNED';
        rider.active_package_id = packageId;
        rider.status_label = '배차 배정 완료';
        Object.keys(mock.riders).filter(id => id !== riderId).forEach(id => syncRiderOfferStatus(id, {waitingWhenEmpty:true}));
        recalcEta(pkg);
        event('rider.accepted',`${riderId}가 ${packageId}를 수락하고 중복 제안을 정리했습니다.`);
        return {message:'배차를 수락했습니다.'};
      }
      pkg.offers[riderId].status = 'DECLINED';
      pkg.offers[riderId].responded_at = clock();
      syncRiderOfferStatus(riderId);
      event('rider.declined',`${riderId}가 배차를 거절했습니다.`);
      return {message:'배차를 거절했습니다.'};
    }
    if (/^\/api\/rider\/R-\d+\/orders\/O-\d+\/(pickup|deliver)$/.test(pathname)) { const parts=pathname.split('/');const riderId=parts[3],orderId=parts[5],action=parts[6];const order=mock.orders[orderId],pkg=packageForOrder(order),step=pkg?.route_steps.find(s=>s.order_id===orderId && s.type===(action==='pickup'?'PICKUP':'DELIVERY'));if(!pkg||pkg.assigned_rider_id!==riderId||!step?.is_current)throw new Error('현재 진행 순서가 아닌 주문입니다.');if(action==='pickup'&&order.status!=='READY')throw new Error('조리 완료 후 픽업할 수 있습니다.');if(action==='deliver'&&order.status!=='PICKED_UP')throw new Error('픽업 완료 후 배달할 수 있습니다.');step.status='COMPLETED';step.is_current=false;if(action==='pickup'){setStatus(order,'PICKED_UP');order.picked_up_at=clock();}else{setStatus(order,'DELIVERED');order.delivered_at=clock();}mock.riders[riderId].lat=step.lat;mock.riders[riderId].lng=step.lng;advance(step.duration_min);const next=pkg.route_steps.find(s=>s.status==='PENDING');if(next){next.is_current=true;pkg.status='IN_PROGRESS';}else{pkg.status='COMPLETED';mock.riders[riderId].status='AVAILABLE';mock.riders[riderId].active_package_id=null;mock.riders[riderId].status_label='운행 가능';}recalcEta(pkg);event(`rider.${action}`,`${orderId} ${action==='pickup'?'픽업':'배달'} 완료`,0);return {message:action==='pickup'?'픽업을 완료했습니다.':'배달을 완료했습니다.'}; }
    if (pathname === '/api/demo/reset') { Object.assign(mock,makeMock()); persist(); return {message:'새 시연 상태로 초기화했습니다.'}; }
    if (pathname === '/api/demo/weather') { mock.demo.weather=body.condition==='RAIN'?'RAIN':'CLEAR';recalcAllPackages();event('weather.changed',`${weather().label} 시나리오를 적용하고 모든 ETA를 다시 계산했습니다.`);return {message:'날씨와 ETA를 변경했습니다.'}; }
    if (pathname === '/api/demo/strategy') return setRouteStrategy(body.strategy);
    if (pathname === '/api/demo/next-step') return advanceSimulation();
    if (pathname === '/api/demo/simulation') { mock.demo.simulation_running=Boolean(body.running);event('demo.simulation',mock.demo.simulation_running?'라이더 위치 자동 이동을 시작했습니다.':'라이더 위치 자동 이동을 일시정지했습니다.',0);return {message:mock.demo.simulation_running?'자동 이동을 시작했습니다.':'자동 이동을 일시정지했습니다.'}; }
    if (pathname === '/api/explanations/customer' || /^\/api\/explanations\//.test(pathname)) return {headline:'AI 추천 근거',summary:'조리 시간, 매장 위치, 고객 위치와 품질 제한을 함께 반영합니다.',note:'시연용 mock 데이터입니다.',source:'mock',reasons:[{title:'2~3건 조건',description:'AI 추천 주문은 점수가 허용될 때 2건 또는 3건으로 묶습니다.',metric:'최대 3건'},{title:'이동 동선',description:'매장과 고객 위치를 반영합니다.',metric:'경로 최적화'},{title:'음식 품질',description:'예상 가방 체류시간을 확인합니다.',metric:'품질 기준'}]};
    throw new Error(`지원하지 않는 mock API: ${pathname}`);
  };
  const endpoint = (name, fallback, params={}) => {
    const template = String((useMock ? null : apiPaths[name]) || fallback);
    return template.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, (_, key) => {
      if (!(key in params)) throw new Error(`VITE_API_PATHS.${name}에 필요한 :${key} 값이 없습니다.`);
      return encodeURIComponent(params[key]);
    });
  };
  const api = async (path, options={}) => { if(useMock) return clone(mockApi(path,options)); const response=await fetch(`${apiBaseUrl}${path}`,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.detail||data.message||'요청을 처리하지 못했습니다.');return data; };
  const apiClient = Object.freeze({customer:{get:id=>api(endpoint('customer','/api/customer/:customerId',{customerId:id}))},orders:{create:body=>api(endpoint('orders','/api/orders'),{method:'POST',body:JSON.stringify(body)})},merchant:{get:id=>api(endpoint('merchant','/api/merchant/:storeId',{storeId:id})),orderAction:(id,body)=>api(endpoint('merchantOrderAction','/api/merchant/orders/:orderId/action',{orderId:id}),{method:'POST',body:JSON.stringify(body)})},rider:{get:id=>api(endpoint('rider','/api/rider/:riderId',{riderId:id})),offerResponse:(riderId,packageId,body)=>api(endpoint('riderOfferResponse','/api/rider/:riderId/packages/:packageId/offer-response',{riderId,packageId}),{method:'POST',body:JSON.stringify(body)}),pickup:(riderId,orderId)=>api(endpoint('riderPickup','/api/rider/:riderId/orders/:orderId/pickup',{riderId,orderId}),{method:'POST',body:'{}'}),deliver:(riderId,orderId)=>api(endpoint('riderDeliver','/api/rider/:riderId/orders/:orderId/deliver',{riderId,orderId}),{method:'POST',body:'{}'})},explanation:(role,id)=>api(endpoint('explanation','/api/explanations/:role/:entityId',{role,entityId:id})),demo:{state:()=>api(endpoint('demoState','/api/state')),dispatchCalculate:()=>api(endpoint('demoDispatchCalculate','/api/demo/dispatch-calculate'),{method:'POST',body:'{}'}),reset:()=>api(endpoint('demoReset','/api/demo/reset'),{method:'POST',body:'{}'}),weather:body=>api(endpoint('demoWeather','/api/demo/weather'),{method:'POST',body:JSON.stringify(body)}),strategy:body=>api(endpoint('demoStrategy','/api/demo/strategy'),{method:'POST',body:JSON.stringify(body)}),nextStep:()=>api(endpoint('demoNextStep','/api/demo/next-step'),{method:'POST',body:'{}'}),simulation:body=>api(endpoint('demoSimulation','/api/demo/simulation'),{method:'POST',body:JSON.stringify(body)})}});
  const qs=(name,fallback)=>new URLSearchParams(location.search).get(name)||fallback; const el=id=>document.getElementById(id); const money=value=>`${Number(value||0).toLocaleString('ko-KR')}원`; const fmtTime=value=>value?new Date(value).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}):'-'; const escape=(value='')=>String(value).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const toast=message=>{const node=el('toast');if(!node)return;node.textContent=message;node.classList.add('show');clearTimeout(node._timer);node._timer=setTimeout(()=>node.classList.remove('show'),2600);}; const setConnection=online=>{const node=el('connection');if(!node)return;node.classList.toggle('online',online);const label=node.querySelector('span');if(label)label.textContent=online?'실시간 연결':'재연결 중';};
  const cleanups=[];
  const websocket=(role,entityId,onUpdate)=>{if(useMock){setConnection(true);const listener=e=>{if(e.key===storageKey&&e.newValue){hydrate();onUpdate({type:'mock_state_updated',role,entityId});}};window.addEventListener('storage',listener);const stop=()=>window.removeEventListener('storage',listener);cleanups.push(stop);return stop;} const path=endpoint('websocket','/ws/:role/:entityId',{role,entityId});const origin=wsBaseUrl ? wsBaseUrl.replace(/^http:/,'ws:').replace(/^https:/,'wss:') : `${location.protocol==='https:'?'wss':'ws'}://${location.host}`;let socket;let retryTimer;let pingTimer;let stopped=false;let attempts=0;const connect=()=>{if(stopped)return;setConnection(false);socket=new WebSocket(`${origin}${path}`);socket.onopen=()=>{attempts=0;setConnection(true);pingTimer=window.setInterval(()=>{if(socket.readyState===WebSocket.OPEN)socket.send('ping');},20000);};socket.onmessage=event=>{let message;try{message=JSON.parse(event.data);}catch{message=event.data;}if(message?.type==='pong'||message==='pong')return;onUpdate(message);};socket.onerror=()=>socket.close();socket.onclose=()=>{window.clearInterval(pingTimer);if(stopped)return;setConnection(false);const delay=Math.min(1000*2**attempts,30000);attempts+=1;retryTimer=window.setTimeout(connect,delay);};};const stop=()=>{stopped=true;window.clearTimeout(retryTimer);window.clearInterval(pingTimer);socket?.close();};cleanups.push(stop);connect();return stop;};
  const pendingButtons = new WeakSet();
  const withPending = async (button, task) => {
    if (!button || pendingButtons.has(button)) return;
    const wasDisabled = button.disabled;
    pendingButtons.add(button);
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try { return await task(); }
    finally {
      pendingButtons.delete(button);
      button.disabled = wasDisabled;
      button.removeAttribute('aria-busy');
    }
  };
  let sheetTrigger = null;
  const focusableInSheet = sheet => [...sheet.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(node => !node.hidden && node.getAttribute('aria-hidden') !== 'true');
  const openSheet = (trigger=document.activeElement) => {
    const backdrop = el('sheetBackdrop');
    const sheet = el('bottomSheet');
    if (!sheet) return;
    sheetTrigger = trigger instanceof HTMLElement ? trigger : null;
    sheet.removeAttribute('inert');
    backdrop?.classList.add('open');
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => (el('sheetClose') || focusableInSheet(sheet)[0])?.focus(), 0);
  };
  const closeSheet = () => {
    const backdrop = el('sheetBackdrop');
    const sheet = el('bottomSheet');
    backdrop?.classList.remove('open');
    sheet?.classList.remove('open');
    sheet?.setAttribute('aria-hidden', 'true');
    sheet?.setAttribute('inert', '');
    const trigger = sheetTrigger;
    sheetTrigger = null;
    if (trigger?.isConnected) window.setTimeout(() => trigger.focus(), 0);
  };
  const bindSheet = () => {
    const backdrop = el('sheetBackdrop');
    const closeButton = el('sheetClose');
    const sheet = el('bottomSheet');
    if (!sheet || sheet.dataset.accessibilityBound === 'true') return;
    sheet.dataset.accessibilityBound = 'true';
    closeButton?.addEventListener('click', closeSheet);
    backdrop?.addEventListener('click', closeSheet);
    const onKeydown = event => {
      if (!sheet.classList.contains('open')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSheet();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = focusableInSheet(sheet);
      if (!focusable.length) { event.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !sheet.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !sheet.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeydown);
    cleanups.push(() => {
      closeButton?.removeEventListener('click', closeSheet);
      backdrop?.removeEventListener('click', closeSheet);
      document.removeEventListener('keydown', onKeydown);
      delete sheet.dataset.accessibilityBound;
    });
  };
  const renderRouteMap = (containerId, points=[], rider) => {
    const root = el(containerId);
    if (!root) return;
    root.querySelector('.route-svg')?.remove();
    root.querySelectorAll('.map-pin.dynamic').forEach(node => node.remove());
    const {min_lat, max_lat, min_lng, max_lng} = serviceMap.bounds;
    const project = point => ({
      x: Math.max(5, Math.min(95, 5 + (point.lng - min_lng) / (max_lng - min_lng) * 90)),
      y: Math.max(5, Math.min(95, 95 - (point.lat - min_lat) / (max_lat - min_lat) * 90)),
    });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'route-svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    const svgNode = (name, attributes={}) => {
      const node = document.createElementNS('http://www.w3.org/2000/svg', name);
      Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
      return node;
    };
    serviceMap.regions.forEach(region => {
      const polygon = svgNode('polygon', {class:'map-zone', points:region.points.map(point => { const pos = project(point); return `${pos.x},${pos.y}`; }).join(' ')});
      const center = region.points.reduce((sum, point) => ({lat:sum.lat + point.lat / region.points.length, lng:sum.lng + point.lng / region.points.length}), {lat:0,lng:0});
      const label = svgNode('text', {class:'map-zone-label', x:project(center).x, y:project(center).y});
      label.textContent = region.label;
      svg.append(polygon, label);
    });
    Object.values(stores).forEach(store => {
      const pos = project(store);
      const marker = svgNode('circle', {class:'map-store-anchor', cx:pos.x, cy:pos.y, r:2.6});
      const label = svgNode('text', {class:'map-store-label', x:pos.x + 3.5, y:pos.y - 2.5});
      label.textContent = store.category;
      svg.append(marker, label);
    });
    if (points.length) {
      const d = points.map((point, index) => { const pos = project(point); return `${index ? 'L' : 'M'} ${pos.x} ${pos.y}`; }).join(' ');
      svg.append(svgNode('path', {class:'map-route-line', d, fill:'none'}));
    }
    root.appendChild(svg);
    points.forEach((point, index) => {
      const pos = project(point);
      const pin = document.createElement('div');
      pin.className = `map-pin dynamic ${point.type === 'PICKUP' ? 'store' : ''}`;
      pin.style.left = `${pos.x}%`;
      pin.style.top = `${pos.y}%`;
      pin.innerHTML = `<span>${point.type === 'PICKUP' ? '가' : index + 1}</span>`;
      root.appendChild(pin);
    });
    if (rider?.lat != null && rider?.lng != null) {
      const pos = project(rider);
      const pin = document.createElement('div');
      pin.className = 'map-pin dynamic rider';
      pin.style.left = `${pos.x}%`;
      pin.style.top = `${pos.y}%`;
      pin.innerHTML = '<span>🏍</span>';
      root.appendChild(pin);
    }
  };
  const dispose=()=>{while(cleanups.length)cleanups.pop()();};
  return {qs,el,money,fmtTime,escape,api,apiUrl:path=>`${apiBaseUrl}${path}`,apiClient,defaultIds:ids,toast,websocket,withPending,openSheet,closeSheet,bindSheet,renderRouteMap,useMock,labels,dispose};
})();
