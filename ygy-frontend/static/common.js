window.Yogiyo = (() => {
  const config = window.__YGY_CONFIG__ || {};
  const withoutTrailingSlash = value => String(value || '').replace(/\/+$/, '');
  const apiBaseUrl = withoutTrailingSlash(config.apiBaseUrl);
  const configuredWsBaseUrl = withoutTrailingSlash(config.wsBaseUrl);
  const apiPaths = {
    customer: '/api/customer/:customerId',
    merchant: '/api/merchant/:storeId',
    merchantOrderAction: '/api/merchant/orders/:orderId/action',
    rider: '/api/rider/:riderId',
    riderAction: '/api/rider/:riderId/action',
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
      'O-1001': {order_id:'O-1001', customer_id:'C-001', store_id:'S-001', status:'COOKING', status_label:'조리 중', menu_summary:'반반치킨 · 콜라', created_at:now(), amount:23900, start_recommendation:'라이더 도착 6분 전 조리 완료를 목표로 합니다.', target_ready_label:'12:22', prediction_confidence_pct:94, predicted_cooking_min:16, expected_rider_wait_min:2, request_note:'치킨무 많이 주세요.', remaining_min:16, items:[{name:'반반치킨',quantity:1},{name:'콜라',quantity:1}]},
      'O-1002': {order_id:'O-1002', customer_id:'C-002', store_id:'S-002', status:'NEW', status_label:'신규 주문', menu_summary:'치즈버거 세트', created_at:now(), amount:15900, start_recommendation:'지금 접수하면 묶음 픽업 시간에 맞출 수 있어요.', target_ready_label:'12:18', prediction_confidence_pct:92, predicted_cooking_min:12, expected_rider_wait_min:3, request_note:'피클 빼주세요.', remaining_min:12, items:[{name:'치즈버거',quantity:1},{name:'감자튀김',quantity:1}]},
      'O-1003': {order_id:'O-1003', customer_id:'C-003', store_id:'S-003', status:'ACCEPTED', status_label:'주문 수락', menu_summary:'제육볶음 정식', created_at:now(), amount:13800, start_recommendation:'5분 후 조리를 시작하면 대기 시간을 줄일 수 있어요.', target_ready_label:'12:25', prediction_confidence_pct:90, predicted_cooking_min:14, expected_rider_wait_min:1, request_note:'국물은 따로 포장해 주세요.', remaining_min:14, items:[{name:'제육볶음',quantity:1},{name:'공기밥',quantity:1}]},
    },
    riders: {
      'R-001': {display_name:'민준 라이더', vehicle:'오토바이', status_label:'배차 제안 확인 중', lat:37.498, lng:127.027},
      'R-002': {display_name:'서연 라이더', vehicle:'오토바이', status_label:'운행 가능 · 재배차 대기', lat:37.503, lng:127.021},
      'R-003': {display_name:'도윤 라이더', vehicle:'전기자전거', status_label:'다른 주문 배달 중', lat:37.491, lng:127.031},
    },
    packages: {
      'PKG-001': {status:'OFFERED', status_label:'3건 묶음 배차 제안', bundle_size:3, order_ids:['O-1001','O-1002','O-1003'], offered_rider_ids:['R-001','R-002','R-003'], rider_id:null, hourly_revenue:28500, efficiency_reason:['동선 겹침','대기 시간 최소화','예상 수익이 높아요'], package_revenue:53600, estimated_duration_min:38, total_distance_km:7.1, total_wait_min:4, route_overlap_pct:72, extra_distance_km:0.8, route_strategy_label:'혼합 최적화', route_strategy_description:'세 매장의 준비 완료 시점과 이동 동선을 함께 고려했습니다.', offer_attempt:1, offered_rider_id:'R-001', offered_rider_name:'민준 라이더', was_rejected:false, fallback_triggered:false, reassignment_note:'', route_changed:false, route_change_note:'', current_step:null, accepted:false,
        steps:[
          {sequence:1,status:'PENDING',is_current:false,order_id:'O-1002',destination:'요기요 버거 역삼점',address:'강남대로 123',distance_km:1.1,duration_min:5,eta_label:'12:18',lat:37.497,lng:127.028,type:'PICKUP'},
          {sequence:2,status:'PENDING',is_current:false,order_id:'O-1001',destination:'요기요 치킨 강남점',address:'테헤란로 108',distance_km:1.4,duration_min:6,eta_label:'12:24',lat:37.500,lng:127.030,type:'PICKUP'},
          {sequence:3,status:'PENDING',is_current:false,order_id:'O-1003',destination:'요기요 한식 선릉점',address:'선릉로 88',distance_km:1.2,duration_min:5,eta_label:'12:29',lat:37.495,lng:127.025,type:'PICKUP'},
          {sequence:4,status:'PENDING',is_current:false,order_id:'O-1002',destination:'고객 B',address:'역삼로 42',distance_km:1.5,duration_min:7,eta_label:'12:36',lat:37.494,lng:127.035,type:'DELIVERY'},
          {sequence:5,status:'PENDING',is_current:false,order_id:'O-1001',destination:'고객 A',address:'테헤란로 120',distance_km:1.0,duration_min:5,eta_label:'12:41',lat:37.502,lng:127.033,type:'DELIVERY'},
          {sequence:6,status:'PENDING',is_current:false,order_id:'O-1003',destination:'고객 C',address:'봉은사로 62',distance_km:0.9,duration_min:4,eta_label:'12:45',lat:37.490,lng:127.029,type:'DELIVERY'},
        ]}
    },
    demo:{version:1, strategy:'optimized', weather:'CLEAR', simulation:false, dataset_id:'baseline', events:[]}
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
    const pkg = packageFor(); const isOffered = pkg.status === 'OFFERED' && pkg.offered_rider_id === riderId; const isAssigned = pkg.rider_id === riderId;
    const riderPackage = {...pkg, can_accept:isOffered, accepted:isAssigned || pkg.accepted && isAssigned};
    if (!isOffered && !isAssigned) {
      riderPackage.status = riderId === 'R-002' ? 'AVAILABLE' : 'BUSY';
      riderPackage.status_label = riderId === 'R-002' ? '재배차 후보 대기' : '다른 주문 배달 중';
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
  const addEvent = (type, message) => { mock.demo.version += 1; mock.demo.events.unshift({type,message,occurred_at:now()}); persistMock(); };
  function mockApi(path, options={}) {
    const pathname = new URL(path, location.origin).pathname;
    const body = options.body ? JSON.parse(options.body) : {};
    if (/^\/api\/customer\/[^/]+$/.test(pathname)) return customerView(pathname.split('/').pop());
    if (/^\/api\/merchant\/(S-[^/]+)$/.test(pathname)) return merchantView(pathname.split('/').pop());
    if (/^\/api\/rider\/[^/]+$/.test(pathname)) return riderView(pathname.split('/').pop());
    if (/^\/api\/explanations\//.test(pathname)) return explanationFor(pathname.split('/')[3]);
    if (pathname === '/api/demo/datasets') return {active_dataset_id:mock.demo.dataset_id,datasets:[{dataset_id:'baseline',name:'기본 3건 묶음 시나리오'},{dataset_id:'rain',name:'비·매장 지연 시나리오'}]};
    if (pathname === '/api/state') return demoState();
    if (pathname === '/api/config/maps') return {provider:'demo',client_key:'',has_credentials:false,fallback_provider:'demo'};
    if (/^\/api\/merchant\/orders\//.test(pathname)) {
      const order = mock.orders[pathname.split('/')[4]];
      if (order) { if (body.action==='accept') [order.status,order.status_label]=['ACCEPTED','주문 수락']; if (body.action==='start') [order.status,order.status_label]=['COOKING','조리 중']; if (body.action==='ready') [order.status,order.status_label]=['READY','조리 완료']; if (body.action==='delay') { [order.status,order.status_label]=['DELAYED','조리 지연']; order.predicted_cooking_min += body.delay_min; order.remaining_min += body.delay_min; } addEvent('merchant_action',`${order.order_id} ${order.status_label}`); }
      return {message:'주문 상태를 반영했습니다.'};
    }
    if (/^\/api\/rider\/.*\/action$/.test(pathname)) {
      const riderId = pathname.split('/')[3]; const pkg=packageFor();
      if (body.action==='accept' && pkg.offered_rider_id === riderId) { pkg.accepted=true; pkg.rider_id=riderId; pkg.status='ASSIGNED'; pkg.status_label='배차 수락 · 첫 매장 이동'; mock.riders[riderId].status_label='묶음 픽업 경로 이동 중'; pkg.steps[0].is_current=true; pkg.current_step=pkg.steps[0]; }
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
    if (command==='new-order') { const order=mock.orders['O-1002']; const id=`O-${1000+Object.keys(mock.orders).length+1}`; mock.orders[id]={...order,order_id:id,status:'NEW',status_label:'신규 주문',menu_summary:'버거 매장 신규 시연 주문',created_at:now()}; mock.stores['S-002'].order_ids.unshift(id); addEvent('new_order','버거 매장에 신규 주문을 생성했습니다.'); return {message:'신규 주문을 만들었습니다.'}; }
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
    merchant: {
      get: storeId => api(pathFor('merchant', {storeId})),
      orderAction: (orderId, body) => api(pathFor('merchantOrderAction', {orderId}), {method:'POST', body:JSON.stringify(body)}),
    },
    rider: {
      get: riderId => api(pathFor('rider', {riderId})),
      action: (riderId, body) => api(pathFor('riderAction', {riderId}), {method:'POST', body:JSON.stringify(body)}),
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
