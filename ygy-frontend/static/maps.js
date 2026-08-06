window.YogiyoMaps = (() => {
  let configPromise;
  let providerLoader;
  const instances = new Map();

  const getConfig = () => {
    if (!configPromise) {
      configPromise = Yogiyo.apiClient.maps.config()
        .catch(() => ({provider:'demo', client_key:'', has_credentials:false, fallback_provider:'demo'}));
    }
    return configPromise;
  };

  const loadScript = (src, globalTest) => new Promise((resolve, reject) => {
    if (globalTest()) return resolve();
    const existing = document.querySelector(`script[data-yogiyo-map-src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => globalTest() ? resolve() : reject(new Error('지도 SDK 초기화 실패')), {once:true});
      existing.addEventListener('error', () => reject(new Error('지도 SDK 로딩 실패')), {once:true});
      return;
    }
    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.dataset.yogiyoMapSrc = src;
    script.src = src;
    script.onload = () => globalTest() ? resolve() : reject(new Error('지도 SDK 초기화 실패'));
    script.onerror = () => reject(new Error('지도 SDK 로딩 실패'));
    document.head.appendChild(script);
  });

  const ensureProvider = async config => {
    if (!config.has_credentials || config.provider === 'demo') return false;
    if (providerLoader) return providerLoader;
    if (config.provider === 'naver') {
      const src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(config.client_key)}`;
      providerLoader = loadScript(src, () => Boolean(window.naver?.maps));
    } else if (config.provider === 'google') {
      const src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.client_key)}&v=weekly`;
      providerLoader = loadScript(src, () => Boolean(window.google?.maps));
    } else {
      return false;
    }
    await providerLoader;
    return true;
  };

  const setStatus = (root, text, tone='info') => {
    const status = root.closest('.map-card')?.querySelector('[data-map-provider-status]');
    if (!status) return;
    status.textContent = text;
    status.dataset.tone = tone;
  };

  const clearExternalInstance = containerId => {
    const instance = instances.get(containerId);
    if (!instance) return;
    if (instance.provider === 'naver') {
      instance.overlays?.forEach(overlay => overlay.setMap?.(null));
    } else if (instance.provider === 'google') {
      instance.overlays?.forEach(overlay => overlay.setMap?.(null));
    }
    instances.delete(containerId);
  };

  const prepareExternalHost = (root, containerId, provider) => {
    root.classList.add('external-map');
    root.querySelectorAll('.route-svg, .map-pin.dynamic').forEach(node => node.remove());
    let host = root.querySelector('.external-map-host');
    const previous = instances.get(containerId);
    if (!host || previous?.provider !== provider) {
      clearExternalInstance(containerId);
      root.querySelector('.external-map-host')?.remove();
      host = document.createElement('div');
      host.className = 'external-map-host';
      root.prepend(host);
    }
    return host;
  };

  const markerKind = point => point.__rider ? 'rider' : point.type === 'PICKUP' ? 'store' : point.is_own ? 'own' : 'other';
  const markerText = (point, index) => point.__rider ? 'R' : point.is_own ? '나' : point.type === 'PICKUP' ? '가' : String(index + 1);
  const markerColor = kind => ({rider:'#3f6fe5', store:'#303039', own:'#ff2f6e', other:'#89909d'}[kind] || '#89909d');

  const renderNaver = (containerId, root, points, rider) => {
    const host = prepareExternalHost(root, containerId, 'naver');
    const allPoints = [...points, ...(rider ? [{...rider, __rider:true, label:'라이더 현재 위치'}] : [])];
    const centerPoint = allPoints[Math.floor(allPoints.length / 2)];
    let instance = instances.get(containerId);
    if (!instance) {
      const map = new naver.maps.Map(host, {
        center: new naver.maps.LatLng(Number(centerPoint.lat), Number(centerPoint.lng)),
        zoom: 14,
        mapTypeControl: false,
        scaleControl: false,
        logoControlOptions: {position: naver.maps.Position.BOTTOM_LEFT},
        zoomControl: true,
        zoomControlOptions: {position: naver.maps.Position.TOP_RIGHT},
      });
      instance = {provider:'naver', map, overlays:[]};
      instances.set(containerId, instance);
    }
    instance.overlays.forEach(overlay => overlay.setMap?.(null));
    instance.overlays = [];

    const path = points.map(point => new naver.maps.LatLng(Number(point.lat), Number(point.lng)));
    const bounds = new naver.maps.LatLngBounds();
    allPoints.forEach(point => bounds.extend(new naver.maps.LatLng(Number(point.lat), Number(point.lng))));
    const outline = new naver.maps.Polyline({
      map: instance.map,
      path,
      strokeColor: '#ffffff',
      strokeOpacity: 0.95,
      strokeWeight: 8,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
    });
    const route = new naver.maps.Polyline({
      map: instance.map,
      path,
      strokeColor: '#ff2f6e',
      strokeOpacity: 0.95,
      strokeWeight: 4,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
    });
    instance.overlays.push(outline, route);

    allPoints.forEach((point, index) => {
      const kind = markerKind(point);
      const marker = new naver.maps.Marker({
        map: instance.map,
        position: new naver.maps.LatLng(Number(point.lat), Number(point.lng)),
        title: point.label || '',
        icon: {
          content: `<div class="external-map-marker ${kind}" aria-label="${String(point.label || '').replace(/"/g,'&quot;')}">${markerText(point, index)}</div>`,
          anchor: new naver.maps.Point(18, 18),
        },
      });
      instance.overlays.push(marker);
    });
    instance.map.fitBounds(bounds);
  };

  const renderGoogle = (containerId, root, points, rider) => {
    const host = prepareExternalHost(root, containerId, 'google');
    const allPoints = [...points, ...(rider ? [{...rider, __rider:true, label:'라이더 현재 위치'}] : [])];
    const centerPoint = allPoints[Math.floor(allPoints.length / 2)];
    let instance = instances.get(containerId);
    if (!instance) {
      const map = new google.maps.Map(host, {
        center: {lat:Number(centerPoint.lat), lng:Number(centerPoint.lng)},
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        gestureHandling: 'cooperative',
      });
      instance = {provider:'google', map, overlays:[]};
      instances.set(containerId, instance);
    }
    instance.overlays.forEach(overlay => overlay.setMap?.(null));
    instance.overlays = [];

    const path = points.map(point => ({lat:Number(point.lat), lng:Number(point.lng)}));
    const bounds = new google.maps.LatLngBounds();
    allPoints.forEach(point => bounds.extend({lat:Number(point.lat), lng:Number(point.lng)}));
    const outline = new google.maps.Polyline({
      map: instance.map,
      path,
      strokeColor: '#ffffff',
      strokeOpacity: 0.95,
      strokeWeight: 9,
      geodesic: true,
    });
    const route = new google.maps.Polyline({
      map: instance.map,
      path,
      strokeColor: '#ff2f6e',
      strokeOpacity: 0.95,
      strokeWeight: 4,
      geodesic: true,
    });
    instance.overlays.push(outline, route);

    allPoints.forEach((point, index) => {
      const kind = markerKind(point);
      const marker = new google.maps.Marker({
        map: instance.map,
        position: {lat:Number(point.lat), lng:Number(point.lng)},
        title: point.label || '',
        label: {text:markerText(point, index), color:'#ffffff', fontSize:'11px', fontWeight:'800'},
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: markerColor(kind),
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: kind === 'rider' ? 3 : 2,
          scale: kind === 'rider' ? 14 : kind === 'other' ? 10 : 12,
        },
      });
      instance.overlays.push(marker);
    });
    instance.map.fitBounds(bounds, 36);
  };

  async function render(containerId, points, rider, fallback) {
    const root = document.getElementById(containerId);
    if (!root || !points?.length) return;
    try {
      const config = await getConfig();
      const ready = await ensureProvider(config);
      if (!ready) {
        clearExternalInstance(containerId);
        root.classList.remove('external-map');
        root.querySelector('.external-map-host')?.remove();
        fallback();
        setStatus(root, '시연용 지도 · API 키 설정 시 실제 지도 전환', 'neutral');
        return;
      }
      if (config.provider === 'naver') {
        renderNaver(containerId, root, points, rider);
        setStatus(root, '네이버 지도', 'good');
      } else {
        renderGoogle(containerId, root, points, rider);
        setStatus(root, '구글 지도', 'good');
      }
    } catch (error) {
      clearExternalInstance(containerId);
      root.classList.remove('external-map');
      root.querySelector('.external-map-host')?.remove();
      fallback();
      setStatus(root, '외부 지도 실패 · 시연용 지도 유지', 'warn');
      console.warn('[YogiyoMaps]', error);
    }
  }

  return {render, getConfig};
})();
