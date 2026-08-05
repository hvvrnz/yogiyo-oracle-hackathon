const Yogiyo = (() => {
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
    const response = await fetch(path, {
      ...options,
      headers: {'Content-Type':'application/json', ...(options.headers || {})}
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || data.message || '요청을 처리하지 못했습니다.');
    return data;
  }

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
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${location.host}/ws/${role}/${entityId}`);
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

  return {qs, el, money, fmtTime, escape, api, toast, websocket, openSheet, closeSheet, renderRouteMap};
})();
