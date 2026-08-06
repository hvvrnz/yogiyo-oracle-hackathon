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
  // API 계약이 확정되기 전까지 사용하는 단일 mock 데이터 경계입니다.
  // VITE_USE_MOCK=false 와 VITE_API_BASE_URL을 설정하면 아래 데이터는 건드리지 않고 FastAPI로 전환됩니다.
  const useMock = String(config.useMock ?? 'true').toLowerCase() !== 'false';
  const clone = value => JSON.parse(JSON.stringify(value));
  const now = () => new Date().toISOString();
  const mock = {
    merchant: {
      store: {name:'요기요 버거 강남점', category:'버거', prediction_accuracy_pct:92, congestion:'보통', base_cooking_min:12},
      orders: [
        {order_id:'O-1001', status:'NEW', status_label:'신규 주문', menu_summary:'치즈버거 세트', created_at:now(), amount:15900, start_recommendation:'지금 접수하면 라이더 도착 전에 준비할 수 있어요.', target_ready_label:'12:25', prediction_confidence_pct:92, predicted_cooking_min:12, expected_rider_wait_min:2, request_note:'피클 빼주세요.'},
        {order_id:'O-1002', status:'COOKING', status_label:'조리 중', menu_summary:'와퍼 세트 2개', created_at:now(), amount:24800, start_recommendation:'라이더 도착까지 7분 남았어요.', target_ready_label:'12:21', prediction_confidence_pct:88, predicted_cooking_min:10, expected_rider_wait_min:1, request_note:'문 앞에 놓아주세요.'}
      ]
    },
    rider: {
      rider:{display_name:'민준 라이더', vehicle:'오토바이', status_label:'배차 제안 확인 중', lat:37.498, lng:127.027},
      package:{status:'OFFERED', status_label:'3건 묶음 배차 제안', bundle_size:3, hourly_revenue:28500, efficiency_reason:['동선 겹침','대기 시간 최소화','예상 수익이 높아요'], package_revenue:14200, estimated_duration_min:31, total_distance_km:5.8, total_wait_min:3, route_overlap_pct:72, extra_distance_km:0.6, route_strategy_label:'혼합 최적화', route_strategy_description:'준비 완료 시점과 이동 동선을 함께 고려했습니다.', offer_attempt:1, offered_rider_id:'R-001', offered_rider_name:'민준 라이더', was_rejected:false, fallback_triggered:false, reassignment_note:'', route_changed:false, route_change_note:'', current_step:null, accepted:false, can_accept:true},
      steps:[
        {sequence:1,status:'PENDING',is_current:false,destination:'요기요 버거 강남점',address:'강남대로 123',distance_km:1.2,duration_min:5,eta_label:'12:18',lat:37.497,lng:127.028,type:'PICKUP'},
        {sequence:2,status:'PENDING',is_current:false,destination:'고객 A',address:'테헤란로 120',distance_km:2.4,duration_min:11,eta_label:'12:29',lat:37.502,lng:127.033,type:'DELIVERY'},
        {sequence:3,status:'PENDING',is_current:false,destination:'고객 B',address:'역삼로 42',distance_km:2.2,duration_min:10,eta_label:'12:39',lat:37.494,lng:127.035,type:'DELIVERY'}
      ]
    },
    demo:{version:1, strategy:'optimized', weather:'CLEAR', simulation:false, dataset_id:'baseline', events:[]}
  };
  const mockStorageKey = 'ygy-demo-mock-state-v1';
  try {
    const saved = JSON.parse(localStorage.getItem(mockStorageKey));
    if (saved?.merchant && saved?.rider && saved?.demo) {
      Object.assign(mock.merchant, saved.merchant);
      Object.assign(mock.rider, saved.rider);
      Object.assign(mock.demo, saved.demo);
    }
  } catch {}
  const persistMock = () => localStorage.setItem(mockStorageKey, JSON.stringify(mock));
  const weather = condition => condition === 'RAIN'
    ? {condition:'RAIN',label:'비',temperature_c:21,advisory:'강수로 이동 시간이 늘어날 수 있어요.',travel_delay_min:5}
    : {condition:'CLEAR',label:'맑음',temperature_c:25,advisory:'원활한 배달 환경이에요.',travel_delay_min:0};
  const packageFor = () => mock.rider.package;
  const merchantView = () => {
    const orders = mock.merchant.orders;
    return {store:mock.merchant.store, summary:{new_count:orders.filter(o=>o.status==='NEW').length,cooking_count:orders.filter(o=>['COOKING','DELAYED','ACCEPTED'].includes(o.status)).length,ready_count:orders.filter(o=>o.status==='READY').length}, orders,
      rider:{assigned:packageFor().accepted,arrival_label:packageFor().accepted?'약 5분 후 도착':'배차 제안 중',remaining_min:packageFor().accepted?5:null,distance_km:packageFor().accepted?1.2:null,context:packageFor().accepted?'라이더가 매장으로 이동 중입니다.':'최적 라이더에게 배차를 제안했습니다.'},
      package:{status_label:packageFor().status_label,bundle_size:packageFor().bundle_size,route_strategy_label:packageFor().route_strategy_label,ready_gap_min:3,total_wait_min:packageFor().total_wait_min,selected_route_reason:'준비 시점과 이동 동선이 가장 잘 맞습니다.',route_changed:packageFor().route_changed,route_change_note:packageFor().route_change_note,offer_attempt:packageFor().offer_attempt,reassignment_note:packageFor().reassignment_note},weather:weather(mock.demo.weather)};
  };
  const riderView = () => ({rider:mock.rider.rider,package:packageFor(),steps:mock.rider.steps,store_readiness:[{status:'COOKING',status_label:'조리 중',store_name:'요기요 버거 강남점',remaining_min:4,ready_at:'12:18'}],weather:weather(mock.demo.weather)});
  const customerView = () => ({
    order:{order_id:'O-1001',eta_window:packageFor().accepted?'12:29 ~ 12:34':'12:33 ~ 12:38',current_message:packageFor().accepted?'라이더가 매장으로 이동 중이에요.':'라이더 배차를 진행하고 있어요.',delivery_sequence:1,eta_updated_label:'방금 업데이트',status:packageFor().accepted?'PICKUP_ASSIGNED':'PREPARING',status_label:packageFor().accepted?'라이더 배정 완료':'주문 확인·조리 중',menu_summary:'치즈버거 세트',remaining_min:packageFor().accepted?18:23,progress_index:packageFor().accepted?2:1,bag_time_min:11,bag_time_limit_min:20,quality_margin_min:9,quality_guard_passed:true,amount:15900,request_note:'피클 빼주세요.',items:[{name:'치즈버거',quantity:1},{name:'감자튀김',quantity:1}]},
    store:{name:'요기요 버거 강남점'},package:{ready_gap_min:3,route_overlap_pct:72,route_strategy_label:packageFor().route_strategy_label,route_strategy_description:packageFor().route_strategy_description,route_changed:packageFor().route_changed,route_change_note:packageFor().route_change_note,offer_attempt:packageFor().offer_attempt,reassignment_note:packageFor().reassignment_note},rider:{assigned:packageFor().accepted,current_step_label:packageFor().accepted?'매장으로 이동 중':'가까운 라이더를 찾는 중',lat:mock.rider.rider.lat,lng:mock.rider.rider.lng},weather:weather(mock.demo.weather),route:mock.rider.steps.map(step=>({...step,is_own:step.sequence===2}))
  });
  const explanationFor = role => ({headline:'AI 추천 근거',summary:'조리 완료 시점, 이동 동선, 배달 품질 기준을 함께 반영했습니다.',note:'시연용 mock 데이터입니다.',source:'mock',reasons:[{title:'조리 준비 시간',description:'매장 준비 완료 예상 시점과 맞췄습니다.',metric:'3분 차이'},{title:'이동 동선',description:'기존 경로와 겹치는 구간을 우선했습니다.',metric:'72% 중복'},{title:'배달 품질',description:'음식 보관 제한 시간 안에 도착합니다.',metric:'9분 여유'}]});
  const demoState = () => ({version:mock.demo.version,packages:{'PKG-001':packageFor()},riders:{'R-001':mock.rider.rider},events:mock.demo.events});
  const addEvent = (type, message) => { mock.demo.version += 1; mock.demo.events.unshift({type,message,occurred_at:now()}); persistMock(); };
  function mockApi(path, options={}) {
    const pathname = new URL(path, location.origin).pathname;
    const body = options.body ? JSON.parse(options.body) : {};
    if (/^\/api\/customer\/[^/]+$/.test(pathname)) return customerView();
    if (/^\/api\/merchant\/(S-[^/]+)$/.test(pathname)) return merchantView();
    if (/^\/api\/rider\/[^/]+$/.test(pathname)) return riderView();
    if (/^\/api\/explanations\//.test(pathname)) return explanationFor(pathname.split('/')[3]);
    if (pathname === '/api/demo/datasets') return {active_dataset_id:mock.demo.dataset_id,datasets:[{dataset_id:'baseline',name:'기본 3건 묶음 시나리오'},{dataset_id:'rain',name:'비·매장 지연 시나리오'}]};
    if (pathname === '/api/state') return demoState();
    if (pathname === '/api/config/maps') return {provider:'demo',client_key:'',has_credentials:false,fallback_provider:'demo'};
    if (/^\/api\/merchant\/orders\//.test(pathname)) {
      const order = mock.merchant.orders.find(item => item.order_id === pathname.split('/')[4]);
      if (order) { if (body.action==='accept') [order.status,order.status_label]=['ACCEPTED','주문 수락']; if (body.action==='start') [order.status,order.status_label]=['COOKING','조리 중']; if (body.action==='ready') [order.status,order.status_label]=['READY','조리 완료']; if (body.action==='delay') { [order.status,order.status_label]=['DELAYED','조리 지연']; order.predicted_cooking_min += body.delay_min; } addEvent('merchant_action',`${order.order_id} ${order.status_label}`); }
      return {message:'주문 상태를 반영했습니다.'};
    }
    if (/^\/api\/rider\/.*\/action$/.test(pathname)) {
      const pkg=packageFor(); if (body.action==='accept') { pkg.accepted=true; pkg.can_accept=false; pkg.status='ASSIGNED'; pkg.status_label='배차 수락 · 매장 이동'; mock.rider.rider.status_label='매장으로 이동 중'; mock.rider.steps[0].is_current=true; } if (body.action==='reject') { pkg.can_accept=false; pkg.was_rejected=true; pkg.status='REASSIGNING'; pkg.status_label='다음 라이더 탐색 중'; pkg.offer_attempt=2; pkg.offered_rider_name='서연 라이더'; pkg.reassignment_note='첫 제안이 거절되어 다음 후보에게 재배차합니다.'; } if (body.action==='complete_step') { const step=mock.rider.steps.find(item=>item.is_current); if (step) { step.status='COMPLETED'; step.is_current=false; const next=mock.rider.steps.find(item=>item.status==='PENDING'); if (next) { next.is_current=true; pkg.current_step=next; pkg.status='IN_PROGRESS'; pkg.status_label='배달 진행 중'; } else { pkg.status='COMPLETED'; pkg.status_label='배달 완료'; } } } addEvent('rider_action',`라이더 ${body.action} 처리`); return {message:'라이더 상태를 반영했습니다.'};
    }
    if (pathname === '/api/demo/dataset') { mock.demo.dataset_id=body.dataset_id; if (body.dataset_id==='rain') mock.demo.weather='RAIN'; addEvent('dataset','시연 데이터를 적용했습니다.'); return {message:'데이터를 적용했습니다.'}; }
    if (pathname === '/api/demo/route-strategy') { packageFor().route_strategy_label=body.strategy==='pickup_first'?'전체 픽업 후 배달':'혼합 최적화'; packageFor().route_strategy_description=body.strategy==='pickup_first'?'모든 매장을 먼저 방문한 뒤 배달합니다.':'준비 시점과 이동 동선을 함께 고려했습니다.'; addEvent('route_strategy','경로 전략을 변경했습니다.'); return {message:'경로 전략을 변경했습니다.'}; }
    if (pathname === '/api/demo/weather') { mock.demo.weather=body.condition; addEvent('weather',`${body.condition==='RAIN'?'비':'맑음'} 시나리오를 적용했습니다.`); return {message:'날씨를 변경했습니다.'}; }
    if (pathname === '/api/demo/simulation') { mock.demo.simulation=body.running; addEvent('simulation',body.running?'위치 자동 이동을 시작했습니다.':'위치 자동 이동을 멈췄습니다.'); return {message:'시뮬레이션 상태를 변경했습니다.'}; }
    const command = pathname.replace('/api/demo/','');
    if (command==='next') { addEvent('next','다음 시연 단계로 진행했습니다.'); return {message:'다음 단계로 진행했습니다.'}; }
    if (command==='rider-accept') return mockApi('/api/rider/R-001/action',{body:JSON.stringify({action:'accept'})});
    if (command==='rider-reject' || command==='rider-timeout') return mockApi('/api/rider/R-001/action',{body:JSON.stringify({action:'reject'})});
    if (command==='store-delay') { const order=mock.merchant.orders[0]; order.status='DELAYED'; order.status_label='조리 지연'; order.predicted_cooking_min += 7; addEvent('store_delay','버거 매장 조리가 7분 지연되었습니다.'); return {message:'매장 지연을 반영했습니다.'}; }
    if (command==='new-order') { mock.merchant.orders.unshift({...mock.merchant.orders[0],order_id:`O-${1000+mock.merchant.orders.length+1}`,status:'NEW',status_label:'신규 주문',menu_summary:'신규 시연 주문'}); addEvent('new_order','신규 주문을 생성했습니다.'); return {message:'신규 주문을 만들었습니다.'}; }
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
    if (useMock) { setConnection(true); return () => {}; }
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
