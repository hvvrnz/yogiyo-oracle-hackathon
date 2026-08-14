(() => {
  const SDK_PROMISE_KEY = '__YGY_KAKAO_MAP_SDK_PROMISE__';
  const mapStates = new WeakMap();
  let enabled = false;

  const clearSvgArtifacts = root => {
    root.querySelector('.route-svg')?.remove();
    root.querySelectorAll('.map-pin.dynamic, .map-empty').forEach(node => node.remove());
  };

  const loadSdk = appKey => {
    if (window.kakao?.maps) return Promise.resolve(window.kakao);
    if (window[SDK_PROMISE_KEY]) return window[SDK_PROMISE_KEY];
    window[SDK_PROMISE_KEY] = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id = 'ygy-kakao-map-sdk';
      script.async = true;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=${encodeURIComponent(appKey)}`;
      script.onload = () => {
        if (!window.kakao?.maps?.load) {
          reject(new Error('카카오맵 SDK를 초기화할 수 없습니다.'));
          return;
        }
        window.kakao.maps.load(() => resolve(window.kakao));
      };
      script.onerror = () => reject(new Error('카카오맵 SDK를 불러오지 못했습니다. JavaScript 키와 허용 도메인을 확인해 주세요.'));
      document.head.appendChild(script);
    }).catch(error => {
      delete window[SDK_PROMISE_KEY];
      throw error;
    });
    return window[SDK_PROMISE_KEY];
  };

  const positionOf = point => new window.kakao.maps.LatLng(point.lat, point.lng);
  const routeSignature = route => route.map(point => `${point.id}:${point.lat.toFixed(6)},${point.lng.toFixed(6)}`).join('|');

  const clearOverlays = state => {
    state.markers.forEach(marker => marker.setMap(null));
    state.markers = [];
    state.polyline?.setMap(null);
    state.polyline = null;
  };

  const fitMapOnce = (state, data) => {
    const signature = routeSignature(data.route);
    if (state.hasFitted && state.routeSignature === signature) return;
    const points = [...data.route, ...data.markers];
    if (!points.length) return;
    if (points.length === 1) {
      state.map.setCenter(positionOf(points[0]));
      state.map.setLevel(4);
    } else {
      const bounds = new window.kakao.maps.LatLngBounds();
      points.forEach(point => bounds.extend(positionOf(point)));
      state.map.setBounds(bounds, 32, 32, 32, 32);
    }
    state.hasFitted = true;
    state.routeSignature = signature;
  };

  const ensureState = (root, data) => {
    let state = mapStates.get(root);
    if (state) return state;
    const layer = document.createElement('div');
    layer.className = 'kakao-map-layer';
    root.prepend(layer);
    const firstPoint = data.markers[0] || data.route[0] || { lat: 37.5665, lng: 126.9780 };
    state = {
      map: new window.kakao.maps.Map(layer, { center: positionOf(firstPoint), level: 5 }),
      markers: [],
      polyline: null,
      hasFitted: false,
      routeSignature: '',
    };
    mapStates.set(root, state);
    return state;
  };

  const renderKakaoMap = (containerId, map) => {
    if (!enabled || !window.kakao?.maps) return false;
    const root = document.getElementById(containerId);
    if (!root) return true;
    const data = window.Yogiyo.mapData.create(map);
    if (![...data.markers, ...data.route].length) return false;

    clearSvgArtifacts(root);
    root.classList.add('kakao-map-active');
    const state = ensureState(root, data);
    clearOverlays(state);

    if (data.route.length > 1) {
      state.polyline = new window.kakao.maps.Polyline({
        map: state.map,
        path: data.route.map(positionOf),
        strokeWeight: 5,
        strokeColor: '#ff2f6e',
        strokeOpacity: 0.86,
        strokeStyle: 'solid',
      });
    }
    data.markers.forEach(item => {
      const marker = new window.kakao.maps.Marker({
        map: state.map,
        position: positionOf(item),
        title: item.label,
        zIndex: item.kind === 'rider' ? 3 : 2,
      });
      state.markers.push(marker);
    });

    window.requestAnimationFrame(() => {
      state.map.relayout();
      fitMapOnce(state, data);
    });
    return true;
  };

  const configureKakaoMap = async () => {
    const appKey = String(window.__YGY_CONFIG__?.kakaoMapJsKey || '').trim();
    if (!appKey) return false;
    try {
      await loadSdk(appKey);
      enabled = true;
      return true;
    } catch (error) {
      enabled = false;
      console.warn('카카오맵을 사용할 수 없어 SVG 지도를 유지합니다.', error);
      return false;
    }
  };

  Object.assign(window.Yogiyo, { configureKakaoMap, renderKakaoMap });
})();
