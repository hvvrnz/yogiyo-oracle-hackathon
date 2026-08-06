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

  return {qs, el, money, fmtTime, escape, apiUrl, api, apiClient, defaultIds, toast, websocket, openSheet, closeSheet, renderRouteMap};
})();
