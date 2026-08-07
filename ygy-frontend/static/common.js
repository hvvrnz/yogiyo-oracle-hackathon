window.Yogiyo = (() => {
  const config = window.__YGY_CONFIG__ || {};
  const withoutTrailingSlash = value => String(value || '').replace(/\/+$/, '');
  const apiBaseUrl = withoutTrailingSlash(config.apiBaseUrl);
  const configuredWsBaseUrl = withoutTrailingSlash(config.wsBaseUrl);
  const apiPaths = {
    customer: '/api/customer/:customerId',
    orders: '/api/orders',
    merchant: '/api/merchant/:storeId',
    merchantOrderAction: '/api/merchant/orders/:orderId/action',
    rider: '/api/rider/:riderId',
    riderAction: '/api/rider/:riderId/action',
    riderPickup: '/api/rider/:riderId/orders/:orderId/pickup',
    riderDeliver: '/api/rider/:riderId/orders/:orderId/deliver',
    explanation: '/api/explanations/:role/:entityId',
    mapsConfig: '/api/config/maps',
    demoDatasets: '/api/demo/datasets',
    demoState: '/api/state',
    demoDataset: '/api/demo/dataset',
    demoRouteStrategy: '/api/demo/route-strategy',
    demoWeather: '/api/demo/weather',
    demoSimulation: '/api/demo/simulation',
    demoNext: '/api/demo/next',
    demoRiderAccept: '/api/demo/rider-accept',
    demoRiderReject: '/api/demo/rider-reject',
    demoRiderTimeout: '/api/demo/rider-timeout',
    demoStoreDelay: '/api/demo/store-delay',
    demoNewOrder: '/api/demo/new-order',
    demoReset: '/api/demo/reset',
    ...config.apiPaths,
  };
  const defaultIds = Object.freeze({
    customer: config.defaultCustomerId || 'C-001',
    merchant: config.defaultStoreId || 'S-001',
    rider: config.defaultRiderId || 'R-001',
  });
  // API 계약이 확정되기 전까지 사용하는 ID 기반 mock 데이터 경계입니다.
  // VITE_USE_MOCK=false 와 VITE_API_BASE_URL을 설정하면 아래 데이터는 건드리지 않고 FastAPI로 전환됩니다.
  const useMock = String(config.useMock ?? 'true').toLowerCase() !== 'false';
  const clone = value => JSON.parse(JSON.stringify(value));
  const now = () => new Date().toISOString();
  const makeMock = () => ({
    customers: {
      'C-001': {display_name:'고객 A', order_id:'O-1001'},
      'C-002': {display_name:'고객 B', order_id:'O-1002'},
      'C-003': {display_name:'고객 C', order_id:'O-1003'},
    },
    stores: {
      'S-001': {name:'요기요 치킨 강남점', category:'치킨', prediction_accuracy_pct:94, congestion:'보통', base_cooking_min:16, order_ids:['O-1001']},
      'S-002': {name:'요기요 버거 역삼점', category:'버거', prediction_accuracy_pct:92, congestion:'혼잡', base_cooking_min:12, order_ids:['O-1002']},
      'S-003': {name:'요기요 한식 선릉점', category:'한식', prediction_accuracy_pct:90, congestion:'여유', base_cooking_min:14, order_ids:['O-1003']},
    },
    orders: {
      'O-1001': {order_id:'O-1001', customer_id:'C-001', store_id:'S-001', status:'DELIVERED', status_label:'이전 주문 완료', menu_summary:'반반치킨 · 콜라', created_at:now(), amount:23900, start_recommendation:'새 주문을 생성해 시연을 시작하세요.', target_ready_label:'-', prediction_confidence_pct:94, predicted_cooking_min:16, expected_rider_wait_min:0, request_note:'치킨무 많이 주세요.', remaining_min:0, items:[{name:'반반치킨',quantity:1},{name:'콜라',quantity:1}]},
      'O-1002': {order_id:'O-1002', customer_id:'C-002', store_id:'S-002', status:'DELIVERED', status_label:'이전 주문 완료', menu_summary:'치즈버거 세트', created_at:now(), amount:15900, start_recommendation:'가상 고객 주문 생성으로 새 주문을 만드세요.', target_ready_label:'-', prediction_confidence_pct:92, predicted_cooking_min:12, expected_rider_wait_min:0, request_note:'피클 빼주세요.', remaining_min:0, items:[{name:'치즈버거',quantity:1},{name:'감자튀김',quantity:1}]},
      'O-1003': {order_id:'O-1003', customer_id:'C-003', store_id:'S-003', status:'DELIVERED', status_label:'이전 주문 완료', menu_summary:'제육볶음 정식', created_at:now(), amount:13800, start_recommendation:'가상 고객 주문 생성으로 새 주문을 만드세요.', target_ready_label:'-', prediction_confidence_pct:90, predicted_cooking_min:14, expected_rider_wait_min:0, request_note:'국물은 따로 포장해 주세요.', remaining_min:0, items:[{name:'제육볶음',quantity:1},{name:'공기밥',quantity:1}]},
    },
    riders: {
      'R-001': {display_name:'민준 라이더', vehicle:'오토바이', status_label:'운행 가능', lat:37.498, lng:127.027},
      'R-002': {display_name:'서연 라이더', vehicle:'오토바이', status_label:'운행 가능', lat:37.503, lng:127.021},
      'R-003': {display_name:'도윤 라이더', vehicle:'전기자전거', status_label:'운행 가능', lat:37.491, lng:127.031},
    },
    packages: {
      'PKG-001': {status:'DRAFT', status_label:'조리 시작 대기', bundle_size:0, order_ids:[], offered_rider_ids:[], offers:{}, rider_id:null, assigned_rider_id:null, hourly_revenue:28500, efficiency_reason:['조리 시작 후 mock LLM이 묶음 가능성을 계산합니다.','',''], package_revenue:53600, estimated_duration_min:38, total_distance_km:7.1, total_wait_min:4, route_overlap_pct:72, extra_distance_km:0.8, route_strategy_label:'혼합 최적화', route_strategy_description:'세 매장의 준비 완료 시점과 이동 동선을 함께 고려합니다.', offer_attempt:1, offered_rider_id:null, offered_rider_name:'', was_rejected:false, fallback_triggered:false, reassignment_note:'', route_changed:false, route_change_note:'', current_step:null, accepted:false,
        steps:[
          {sequence:1,status:'PENDING',is_current:false,order_id:'O-1002',destination:'요기요 버거 역삼점',address:'강남대로 123',distance_km:1.1,duration_min:5,eta_label:'12:18',lat:37.497,lng:127.028,type:'PICKUP'},
          {sequence:2,status:'PENDING',is_current:false,order_id:'O-1001',destination:'요기요 치킨 강남점',address:'테헤란로 108',distance_km:1.4,duration_min:6,eta_label:'12:24',lat:37.500,lng:127.030,type:'PICKUP'},
          {sequence:3,status:'PENDING',is_current:false,order_id:'O-1003',destination:'요기요 한식 선릉점',address:'선릉로 88',distance_km:1.2,duration_min:5,eta_label:'12:29',lat:37.495,lng:127.025,type:'PICKUP'},
          {sequence:4,status:'PENDING',is_current:false,order_id:'O-1002',destination:'고객 B',address:'역삼로 42',distance_km:1.5,duration_min:7,eta_label:'12:36',lat:37.494,lng:127.035,type:'DELIVERY'},
          {sequence:5,status:'PENDING',is_current:false,order_id:'O-1001',destination:'고객 A',address:'테헤란로 120',distance_km:1.0,duration_min:5,eta_label:'12:41',lat:37.502,lng:127.033,type:'DELIVERY'},
          {sequence:6,status:'PENDING',is_current:false,order_id:'O-1003',destination:'고객 C',address:'봉은사로 62',distance_km:0.9,duration_min:4,eta_label:'12:45',lat:37.490,lng:127.029,type:'DELIVERY'},
        ]}
    },
    demo:{version:1, strategy:'optimized', weather:'CLEAR', simulation:false, dataset_id:'baseline', simulation_clock:'2026-08-07T12:00:00.000Z', events:[]}
  });
  const mock = makeMock();
  const mockStorageKey = 'ygy-demo-mock-state-v2';
  const hydrateMock = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(mockStorageKey));
      if (saved?.stores && saved?.orders && saved?.riders && saved?.packages && saved?.demo) Object.assign(mock, saved);
    } catch {}
  };
  hydrateMock();
  const persistMock = () => localStorage.setItem(mockStorageKey, JSON.stringify(mock));
  const weather = condition => condition === 'RAIN'
    ? {condition:'RAIN',label:'비',temperature_c:21,advisory:'강수로 이동 시간이 늘어날 수 있어요.',travel_delay_min:5}
    : {condition:'CLEAR',label:'맑음',temperature_c:25,advisory:'원활한 배달 환경이에요.',travel_delay_min:0};
  const packageFor = () => mock.packages['PKG-001'];
  const ordersForStore = storeId => (mock.stores[storeId]?.order_ids || []).map(id => mock.orders[id]).filter(Boolean);
  const activeRider = () => mock.riders[packageFor().rider_id || packageFor().offered_rider_id];
  const merchantView = storeId => {
    const store = mock.stores[storeId];
    if (!store) throw new Error('존재하지 않는 매장입니다.');
    const orders = ordersForStore(storeId);
    const pkg = packageFor(); const rider = activeRider();
    return {store, summary:{new_count:orders.filter(o=>o.status==='NEW').length,cooking_count:orders.filter(o=>['COOKING','DELAYED','ACCEPTED'].includes(o.status)).length,ready_count:orders.filter(o=>o.status==='READY').length}, orders,
      rider:{assigned:pkg.accepted,arrival_label:pkg.accepted ? `${rider?.display_name || '라이더'} 약 ${storeId === 'S-002' ? 4 : storeId === 'S-001' ? 10 : 15}분 후 도착` : `${rider?.display_name || '최적 라이더'} 배차 제안 중`,remaining_min:pkg.accepted ? (storeId === 'S-002' ? 4 : storeId === 'S-001' ? 10 : 15) : null,distance_km:pkg.accepted ? (storeId === 'S-002' ? 1.1 : storeId === 'S-001' ? 2.5 : 3.7) : null,context:pkg.accepted ? `${rider?.display_name || '라이더'}가 묶음 픽업 경로로 이동 중입니다.` : `${rider?.display_name || '최적 라이더'}에게 3건 묶음 배차를 제안했습니다.`},
      package:{status_label:pkg.status_label,bundle_size:pkg.bundle_size,route_strategy_label:pkg.route_strategy_label,ready_gap_min:3,total_wait_min:pkg.total_wait_min,selected_route_reason:'세 매장의 준비 시점과 이동 동선이 가장 잘 맞습니다.',route_changed:pkg.route_changed,route_change_note:pkg.route_change_note,offer_attempt:pkg.offer_attempt,reassignment_note:pkg.reassignment_note},weather:weather(mock.demo.weather)};
  };
  const riderView = riderId => {
    const rider = mock.riders[riderId];
    if (!rider) throw new Error('존재하지 않는 라이더입니다.');
    const pkg = packageFor(); const offer = pkg.offers?.[riderId]; const isOffered = pkg.status === 'OFFERED' && offer?.status === 'OFFERED'; const isAssigned = pkg.rider_id === riderId;
    const riderPackage = {...pkg, can_accept:isOffered, accepted:isAssigned || pkg.accepted && isAssigned};
    if (!isOffered && !isAssigned) {
      riderPackage.status = offer?.status === 'CANCELLED' ? 'CANCELLED' : 'AVAILABLE';
      riderPackage.status_label = offer?.status === 'CANCELLED' ? '다른 라이더가 먼저 수락했어요 · 다른 배차를 찾고 있어요' : '새 배차를 기다리고 있어요';
      riderPackage.can_accept = false; riderPackage.current_step = null;
      riderPackage.offered_rider_name = isOffered ? pkg.offered_rider_name : '';
    }
    const steps = isOffered || isAssigned ? pkg.steps : [];
    const store_readiness = Object.entries(mock.stores).map(([storeId, store]) => { const order = ordersForStore(storeId)[0]; return {status:order.status === 'READY' ? 'READY' : order.status === 'DELAYED' ? 'DELAYED' : 'COOKING',status_label:order.status === 'READY' ? '준비 완료' : order.status === 'DELAYED' ? '조리 지연' : order.status_label,store_name:store.name,remaining_min:order.status === 'READY' ? 0 : order.remaining_min,ready_at:order.target_ready_label}; });
    return {rider,package:riderPackage,steps,store_readiness,weather:weather(mock.demo.weather)};
  };
  const customerView = customerId => {
    const customer = mock.customers[customerId]; const order = mock.orders[customer?.order_id];
    if (!order) throw new Error('존재하지 않는 고객 또는 주문입니다.');
    const pkg = packageFor(); const rider = activeRider(); const delivered = order.status === 'DELIVERED';
    return {order:{...order,eta_window:delivered ? '배달 완료' : pkg.accepted ? '12:39 ~ 12:44' : '12:43 ~ 12:48',current_message:delivered ? '맛있게 드세요!' : pkg.accepted ? '라이더가 묶음 픽업 경로로 이동 중이에요.' : '라이더 배차를 진행하고 있어요.',status:delivered ? 'DELIVERED' : pkg.accepted ? 'PICKUP_ASSIGNED' : 'PREPARING',status_label:delivered ? '배달 완료' : pkg.accepted ? '라이더 배정 완료' : order.status_label,remaining_min:delivered ? 0 : pkg.accepted ? 22 : 27,progress_index:delivered ? 4 : pkg.accepted ? 2 : 1,bag_time_min:11,bag_time_limit_min:20,quality_margin_min:9,quality_guard_passed:true,eta_updated_label:'방금 업데이트'},
      store:{name:mock.stores[order.store_id].name},package:{ready_gap_min:3,route_overlap_pct:pkg.route_overlap_pct,route_strategy_label:pkg.route_strategy_label,route_strategy_description:pkg.route_strategy_description,route_changed:pkg.route_changed,route_change_note:pkg.route_change_note,offer_attempt:pkg.offer_attempt,reassignment_note:pkg.reassignment_note},rider:{assigned:pkg.accepted,current_step_label:pkg.accepted ? `${rider?.display_name || '라이더'}가 매장으로 이동 중` : '가까운 라이더를 찾는 중',lat:rider?.lat,lng:rider?.lng},weather:weather(mock.demo.weather),route:pkg.steps.map(step => ({...step,is_own:step.order_id === order.order_id && step.type === 'DELIVERY'}))};
  };
  const explanationFor = role => ({headline:'AI 추천 근거',summary:'조리 완료 시점, 이동 동선, 배달 품질 기준을 함께 반영했습니다.',note:'시연용 mock 데이터입니다.',source:'mock',reasons:[{title:'조리 준비 시간',description:'매장 준비 완료 예상 시점과 맞췄습니다.',metric:'3분 차이'},{title:'이동 동선',description:'기존 경로와 겹치는 구간을 우선했습니다.',metric:'72% 중복'},{title:'배달 품질',description:'음식 보관 제한 시간 안에 도착합니다.',metric:'9분 여유'}]});
  const demoState = () => ({version:mock.demo.version,packages:{'PKG-001':packageFor()},riders:mock.riders,events:mock.demo.events});
  const advanceClock = minutes => { mock.demo.simulation_clock = new Date(new Date(mock.demo.simulation_clock).getTime() + minutes * 60000).toISOString(); };
  const addEvent = (type, message, minutes=1) => { advanceClock(minutes); mock.demo.version += 1; mock.demo.events.unshift({type,message,occurred_at:mock.demo.simulation_clock}); persistMock(); };
  function mockApi(path, options={}) {
    const pathname = new URL(path, location.origin).pathname;
    const body = options.body ? JSON.parse(options.body) : {};
    if (pathname === '/api/orders') {
      const customerId = body.customer_id || 'C-001'; const storeId = body.store_id || 'S-001';
      const existing = Object.values(mock.orders).find(order => order.customer_id === customerId && !['DELIVERED'].includes(order.status));
      if (existing) return {message:'진행 중인 주문이 이미 있습니다.', order_id:existing.order_id};
      const id = `O-${1000 + Object.keys(mock.orders).length + 1}`; const store = mock.stores[storeId];
      const order = {order_id:id,customer_id:customerId,store_id:storeId,status:'NEW',status_label:'신규 주문',menu_summary:store.category === '치킨' ? '반반치킨 · 콜라' : store.category === '버거' ? '치즈버거 세트' : '제육볶음 정식',created_at:mock.demo.simulation_clock,amount:store.category === '치킨' ? 23900 : store.category === '버거' ? 15900 : 13800,start_recommendation:'사장님 주문 수락을 기다리고 있어요.',target_ready_label:'조리 시작 후 계산',prediction_confidence_pct:92,predicted_cooking_min:store.base_cooking_min,expected_rider_wait_min:0,request_note:'문 앞에 놓아주세요.',remaining_min:store.base_cooking_min,items:body.items || [{name:'시연 주문',quantity:1}],package_id:null,rider_id:null};
      mock.orders[id]=order; store.order_ids.unshift(id); mock.customers[customerId].order_id=id; addEvent('order.created',`${store.name}에 ${id} 주문이 접수되었습니다.`); return {message:'주문이 접수되었습니다.',order_id:id};
    }
    if (/^\/api\/customer\/[^/]+$/.test(pathname)) return customerView(pathname.split('/').pop());
    if (/^\/api\/merchant\/(S-[^/]+)$/.test(pathname)) return merchantView(pathname.split('/').pop());
    if (/^\/api\/rider\/[^/]+$/.test(pathname)) return riderView(pathname.split('/').pop());
    if (/^\/api\/explanations\//.test(pathname)) return explanationFor(pathname.split('/')[3]);
    if (pathname === '/api/demo/datasets') return {active_dataset_id:mock.demo.dataset_id,datasets:[{dataset_id:'baseline',name:'기본 3건 묶음 시나리오'},{dataset_id:'rain',name:'비·매장 지연 시나리오'}]};
    if (pathname === '/api/state') return demoState();
    if (pathname === '/api/config/maps') return {provider:'demo',client_key:'',has_credentials:false,fallback_provider:'demo'};
    if (/^\/api\/merchant\/orders\//.test(pathname)) {
      const order = mock.orders[pathname.split('/')[4]];
      if (order) { if (body.action==='accept') [order.status,order.status_label]=['ACCEPTED','주문 수락']; if (body.action==='start') { [order.status,order.status_label]=['COOKING','조리 중']; order.cooking_started_at=mock.demo.simulation_clock; } if (body.action==='ready') { [order.status,order.status_label]=['READY','조리 완료']; order.ready_at=mock.demo.simulation_clock; } if (body.action==='delay') { [order.status,order.status_label]=['DELAYED','조리 지연']; order.predicted_cooking_min += body.delay_min; order.remaining_min += body.delay_min; } addEvent('merchant_action',`${order.order_id} ${order.status_label}`); const cooking=Object.values(mock.orders).filter(item => ['COOKING','READY'].includes(item.status) && !item.package_id); if (cooking.length >= 2 && packageFor().status === 'DRAFT') { const pkg=packageFor(); pkg.order_ids=cooking.map(item=>item.order_id); const pickupSteps=cooking.map((item,index)=>({sequence:index+1,status:'PENDING',is_current:false,order_id:item.order_id,destination:mock.stores[item.store_id].name,address:'매장 위치',distance_km:1.1+index*.3,duration_min:5,eta_label:'예상 이동',lat:37.497+index*.002,lng:127.028-index*.002,type:'PICKUP'})); const deliverySteps=cooking.map((item,index)=>({sequence:pickupSteps.length+index+1,status:'PENDING',is_current:false,order_id:item.order_id,destination:mock.customers[item.customer_id].display_name,address:'고객 배송지',distance_km:1.4+index*.2,duration_min:7,eta_label:'예상 도착',lat:37.502-index*.003,lng:127.033+index*.002,type:'DELIVERY'})); pkg.steps=[...pickupSteps,...deliverySteps]; pkg.bundle_size=pkg.order_ids.length; pkg.status='OFFERED'; pkg.status_label=`mock LLM ${pkg.bundle_size}건 묶음 배차 제안`; pkg.offers=Object.fromEntries(Object.keys(mock.riders).map(id=>[id,{status:'OFFERED',offered_at:mock.demo.simulation_clock}])); pkg.offered_rider_ids=Object.keys(mock.riders); pkg.efficiency_reason=['준비 완료 시각 차이 5분 이내','매장·고객 동선이 겹칩니다.','음식 품질 기준을 통과했습니다.']; cooking.forEach(item=>item.package_id='PKG-001'); Object.values(mock.riders).forEach(rider=>rider.status_label='새 묶음 배차 제안 확인 중'); addEvent('package.offer_sent','mock LLM이 조리 중 주문을 묶어 모든 라이더에게 제안했습니다.',0); } }
      return {message:'주문 상태를 반영했습니다.'};
    }
    if (/^\/api\/rider\/R-[^/]+\/orders\/O-[^/]+\/(pickup|deliver)$/.test(pathname)) {
      const [, , , riderId,, orderId, action] = pathname.split('/'); const pkg=packageFor(); const order=mock.orders[orderId]; const step=pkg.steps.find(item=>item.order_id===orderId && ((action==='pickup' && item.type==='PICKUP') || (action==='deliver' && item.type==='DELIVERY')));
      const current=pkg.steps.find(item=>item.is_current); if (!order || pkg.rider_id!==riderId || !step || step!==current) throw new Error('현재 진행 순서가 아닌 주문입니다.');
      if (action==='pickup' && order.status!=='READY') throw new Error('조리 완료 후 픽업할 수 있습니다.'); if (action==='deliver' && order.status!=='PICKED_UP') throw new Error('픽업 완료 후 배달할 수 있습니다.');
      [order.status,order.status_label]=action==='pickup'?['PICKED_UP','픽업 완료']:['DELIVERED','배달 완료']; order[action==='pickup'?'picked_up_at':'delivered_at']=mock.demo.simulation_clock; step.status='COMPLETED'; step.is_current=false; const next=pkg.steps.find(item=>item.status==='PENDING'); if(next){next.is_current=true;pkg.current_step=next;} else {[pkg.status,pkg.status_label]=['COMPLETED','모든 주문 배달 완료'];} addEvent(`order.${action==='pickup'?'picked_up':'delivered'}`,`${orderId} ${order.status_label}`,step.duration_min); return {message:`${order.status_label} 처리했습니다.`};
    }
    if (/^\/api\/rider\/.*\/action$/.test(pathname)) {
      const riderId = pathname.split('/')[3]; const pkg=packageFor();
      if (body.action==='accept' && pkg.status==='OFFERED' && pkg.offers?.[riderId]?.status==='OFFERED') { pkg.accepted=true; pkg.rider_id=riderId; pkg.assigned_rider_id=riderId; pkg.status='ASSIGNED'; pkg.status_label='배차 수락 · 조리 완료 매장 대기'; pkg.offers[riderId].status='ACCEPTED'; Object.entries(pkg.offers).forEach(([id,offer])=>{if(id!==riderId && offer.status==='OFFERED'){offer.status='CANCELLED';mock.riders[id].status_label='다른 라이더가 먼저 수락했어요 · 다른 배차를 찾고 있어요';}}); mock.riders[riderId].status_label='묶음 픽업 대기 중'; const first=pkg.steps.find(step=>mock.orders[step.order_id]?.status==='READY'&&step.type==='PICKUP') || pkg.steps[0]; first.is_current=true; pkg.current_step=first; }
      if (body.action==='reject' && pkg.offered_rider_id === riderId) { const nextId=pkg.offered_rider_ids.find(id => id !== riderId && id !== 'R-003') || 'R-002'; pkg.accepted=false; pkg.rider_id=null; pkg.was_rejected=true; pkg.status='OFFERED'; pkg.status_label='다음 라이더에게 재배차 제안'; pkg.offer_attempt+=1; pkg.offered_rider_id=nextId; pkg.offered_rider_name=mock.riders[nextId].display_name; pkg.fallback_triggered=true; pkg.reassignment_note=`${mock.riders[riderId].display_name}의 응답 후 ${mock.riders[nextId].display_name}에게 재배차합니다.`; mock.riders[riderId].status_label='배차 제안 거절 · 운행 가능'; mock.riders[nextId].status_label='배차 제안 확인 중'; }
      if (body.action==='complete_step' && pkg.rider_id === riderId) { const step=pkg.steps.find(item=>item.is_current); if (step) { step.status='COMPLETED'; step.is_current=false; const order=mock.orders[step.order_id]; if (step.type==='PICKUP') { order.status='PICKED_UP'; order.status_label='픽업 완료'; } else { order.status='DELIVERED'; order.status_label='배달 완료'; } const next=pkg.steps.find(item=>item.status==='PENDING'); if (next) { next.is_current=true; pkg.current_step=next; pkg.status='IN_PROGRESS'; pkg.status_label='배달 진행 중'; } else { pkg.status='COMPLETED'; pkg.status_label='배달 완료'; mock.riders[riderId].status_label='운행 가능'; } } }
      addEvent('rider_action',`라이더 ${riderId} ${body.action} 처리`); return {message:'라이더 상태를 반영했습니다.'};
    }
    if (pathname === '/api/demo/dataset') { mock.demo.dataset_id=body.dataset_id; if (body.dataset_id==='rain') mock.demo.weather='RAIN'; addEvent('dataset','시연 데이터를 적용했습니다.'); return {message:'데이터를 적용했습니다.'}; }
    if (pathname === '/api/demo/route-strategy') { packageFor().route_strategy_label=body.strategy==='pickup_first'?'전체 픽업 후 배달':'혼합 최적화'; packageFor().route_strategy_description=body.strategy==='pickup_first'?'모든 매장을 먼저 방문한 뒤 배달합니다.':'준비 시점과 이동 동선을 함께 고려했습니다.'; addEvent('route_strategy','경로 전략을 변경했습니다.'); return {message:'경로 전략을 변경했습니다.'}; }
    if (pathname === '/api/demo/weather') { mock.demo.weather=body.condition; addEvent('weather',`${body.condition==='RAIN'?'비':'맑음'} 시나리오를 적용했습니다.`); return {message:'날씨를 변경했습니다.'}; }
    if (pathname === '/api/demo/simulation') { mock.demo.simulation=body.running; addEvent('simulation',body.running?'위치 자동 이동을 시작했습니다.':'위치 자동 이동을 멈췄습니다.'); return {message:'시뮬레이션 상태를 변경했습니다.'}; }
    const command = pathname.replace('/api/demo/','');
    if (command==='next') { addEvent('next','다음 시연 단계로 진행했습니다.'); return {message:'다음 단계로 진행했습니다.'}; }
    if (command==='rider-accept') return mockApi(`/api/rider/${packageFor().offered_rider_id}/action`,{body:JSON.stringify({action:'accept'})});
    if (command==='rider-reject' || command==='rider-timeout') return mockApi(`/api/rider/${packageFor().offered_rider_id}/action`,{body:JSON.stringify({action:'reject'})});
    if (command==='store-delay') { const order=mock.orders['O-1002']; order.status='DELAYED'; order.status_label='조리 지연'; order.predicted_cooking_min += 7; order.remaining_min += 7; addEvent('store_delay','버거 매장 조리가 7분 지연되었습니다.'); return {message:'버거 매장 지연을 반영했습니다.'}; }
    if (command==='new-order') return mockApi('/api/orders',{body:JSON.stringify({customer_id:'C-002',store_id:'S-002'})});
    if (command==='reset') { localStorage.removeItem(mockStorageKey); location.reload(); return {message:'초기화했습니다.'}; }
    return {message:'시연용 요청을 처리했습니다.'};
  }
  const pathFor = (name, params={}) => (apiPaths[name] || '').replace(/:([A-Za-z0-9_]+)/g, (_, key) => encodeURIComponent(params[key] ?? ''));
  const apiUrl = path => {
    if (/^https?:\/\//i.test(path)) return path;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${apiBaseUrl}${normalizedPath}`;
  };
  const wsUrl = path => {
    if (/^wss?:\/\//i.test(path)) return path;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    if (configuredWsBaseUrl) return `${configuredWsBaseUrl}${normalizedPath}`;
    if (apiBaseUrl) return `${apiBaseUrl.replace(/^http/i, 'ws')}${normalizedPath}`;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}${normalizedPath}`;
  };
  const qs = (name, fallback) => new URLSearchParams(location.search).get(name) || fallback;
  const el = (id) => document.getElementById(id);
  const money = (value) => `${Number(value || 0).toLocaleString('ko-KR')}원`;
  const fmtTime = (value) => {
    if (!value) return '-';
    try { return new Date(value).toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit', hour12:false}); }
    catch { return value; }
  };
  const escape = (value='') => String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

  async function api(path, options={}) {
    if (useMock) return clone(mockApi(path, options));
    const response = await fetch(apiUrl(path), {
      ...options,
      headers: {'Content-Type':'application/json', ...(options.headers || {})}
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || data.message || '요청을 처리하지 못했습니다.');
    return data;
  }

  // The sole boundary between screen code and the backend. API path changes can be
  // supplied through VITE_API_PATHS without changing a screen's rendering logic.
  const apiClient = Object.freeze({
    customer: { get: customerId => api(pathFor('customer', {customerId})) },
    orders: { create: body => api(pathFor('orders'), {method:'POST', body:JSON.stringify(body)}) },
    merchant: {
      get: storeId => api(pathFor('merchant', {storeId})),
      orderAction: (orderId, body) => api(pathFor('merchantOrderAction', {orderId}), {method:'POST', body:JSON.stringify(body)}),
    },
    rider: {
      get: riderId => api(pathFor('rider', {riderId})),
      action: (riderId, body) => api(pathFor('riderAction', {riderId}), {method:'POST', body:JSON.stringify(body)}),
      pickup: (riderId, orderId) => api(pathFor('riderPickup', {riderId, orderId}), {method:'POST', body:'{}'}),
      deliver: (riderId, orderId) => api(pathFor('riderDeliver', {riderId, orderId}), {method:'POST', body:'{}'}),
    },
    explanation: (role, entityId) => api(pathFor('explanation', {role, entityId})),
    maps: { config: () => api(pathFor('mapsConfig')) },
    demo: {
      datasets: () => api(pathFor('demoDatasets')),
      state: () => api(pathFor('demoState')),
      dataset: body => api(pathFor('demoDataset'), {method:'POST', body:JSON.stringify(body)}),
      routeStrategy: body => api(pathFor('demoRouteStrategy'), {method:'POST', body:JSON.stringify(body)}),
      weather: body => api(pathFor('demoWeather'), {method:'POST', body:JSON.stringify(body)}),
      simulation: body => api(pathFor('demoSimulation'), {method:'POST', body:JSON.stringify(body)}),
      command: (name, body={}) => api(pathFor(`demo${name[0].toUpperCase()}${name.slice(1)}`), {method:'POST', body:JSON.stringify(body)}),
    },
  });

  function toast(message) {
    const node = el('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.remove('show'), 2600);
  }

  function setConnection(online) {
    const node = el('connection');
    if (!node) return;
    node.classList.toggle('online', online);
    const label = node.querySelector('span');
    if (label) label.textContent = online ? '실시간 연결' : '재연결 중';
  }

  function websocket(role, entityId, onUpdate) {
    if (useMock) {
      setConnection(true);
      const onStorage = event => {
        if (event.key !== mockStorageKey) return;
        if (event.newValue === null) { location.reload(); return; }
        hydrateMock(); onUpdate({type:'mock_state_updated', role, entityId});
      };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    }
    let socket;
    let retry;
    let closed = false;
    const connect = () => {
      socket = new WebSocket(wsUrl(`/ws/${role}/${entityId}`));
      socket.onopen = () => { setConnection(true); };
      socket.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          if (data.type !== 'pong') onUpdate(data);
        } catch {}
      };
      socket.onclose = () => {
        setConnection(false);
        if (!closed) retry = setTimeout(connect, 1200);
      };
      socket.onerror = () => socket.close();
    };
    connect();
    const ping = setInterval(() => { if (socket?.readyState === WebSocket.OPEN) socket.send('ping'); }, 20000);
    return () => { closed = true; clearInterval(ping); clearTimeout(retry); socket?.close(); };
  }

  function openSheet() {
    el('sheetBackdrop')?.classList.add('open');
    el('bottomSheet')?.classList.add('open');
  }
  function closeSheet() {
    el('sheetBackdrop')?.classList.remove('open');
    el('bottomSheet')?.classList.remove('open');
  }

  function renderFallbackRouteMap(containerId, points, rider) {
    const root = el(containerId);
    if (!root || !points?.length) return;
    const all = [...points, ...(rider ? [rider] : [])];
    const lats = all.map(p => Number(p.lat));
    const lngs = all.map(p => Number(p.lng));
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const project = p => ({
      x: 12 + ((Number(p.lng) - minLng) / Math.max(.0001, maxLng - minLng)) * 76,
      y: 84 - ((Number(p.lat) - minLat) / Math.max(.0001, maxLat - minLat)) * 68,
    });
    const path = points.map(project);
    const d = path.map((p,i) => `${i?'L':'M'} ${p.x} ${p.y}`).join(' ');
    root.querySelector('.route-svg')?.remove();
    root.querySelectorAll('.map-pin.dynamic').forEach(n => n.remove());
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('class','route-svg');
    svg.setAttribute('viewBox','0 0 100 100');
    svg.innerHTML = `<path d="${d}" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#ff2f6e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 2"/>`;
    root.appendChild(svg);
    points.forEach((point,index) => {
      const pos = project(point);
      const pin = document.createElement('div');
      pin.className = `map-pin dynamic ${point.type === 'PICKUP' ? 'store' : point.is_own ? '' : 'other'}`;
      pin.style.left = `${pos.x}%`; pin.style.top = `${pos.y}%`;
      pin.title = point.label || '';
      pin.innerHTML = `<span>${point.is_own ? '나' : point.type === 'PICKUP' ? '가' : index + 1}</span>`;
      root.appendChild(pin);
    });
    if (rider) {
      const pos = project(rider);
      const pin = document.createElement('div');
      pin.className = 'map-pin dynamic rider';
      pin.style.left = `${pos.x}%`; pin.style.top = `${pos.y}%`;
      pin.title = '라이더 현재 위치'; pin.innerHTML = '<span>🛵</span>';
      root.appendChild(pin);
    }
  }

  function renderRouteMap(containerId, points, rider) {
    const fallback = () => renderFallbackRouteMap(containerId, points, rider);
    if (window.YogiyoMaps?.render) {
      window.YogiyoMaps.render(containerId, points, rider, fallback);
    } else {
      fallback();
    }
  }

  return {qs, el, money, fmtTime, escape, apiUrl, api, apiClient, defaultIds, toast, websocket, openSheet, closeSheet, renderRouteMap, useMock};
})();
