(() => {
  const finiteNumber = value => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  const coordinate = (lat, lng) => {
    const normalizedLat = finiteNumber(lat);
    const normalizedLng = finiteNumber(lng);
    return normalizedLat == null || normalizedLng == null ? null : { lat: normalizedLat, lng: normalizedLng };
  };
  const marker = ({ id, kind = 'place', label, lat, lng, sequence, meta = {} }) => {
    const position = coordinate(lat, lng);
    return position ? { id: String(id), kind, label: String(label || ''), sequence: finiteNumber(sequence), ...position, meta } : null;
  };
  const valid = value => value != null;
  const orderBySequence = points => points.slice().sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0));
  const uniqueMarkers = markers => [...new Map(markers.filter(valid).map(item => [item.id, item])).values()];

  const createMapData = ({ markers = [], route = [] } = {}) => {
    const normalizedMarkers = uniqueMarkers(markers);
    const normalizedRoute = orderBySequence(route.filter(valid));
    return Object.freeze({ markers: normalizedMarkers, route: normalizedRoute });
  };

  const fromCustomerOrder = order => {
    if (!order) return createMapData();
    const pickup = marker({
      id: `store:${order.order_id}`,
      kind: 'store',
      label: order.store_name || '매장',
      lat: order.store_lat,
      lng: order.store_lng,
      sequence: 1,
    });
    const delivery = marker({
      id: `delivery:${order.order_id}`,
      kind: 'delivery',
      label: '배달지',
      lat: order.delivery_lat,
      lng: order.delivery_lng,
      sequence: 2,
    });
    return createMapData({ markers: [pickup, delivery], route: [pickup, delivery] });
  };

  const fromRiderProfile = profile => {
    if (!profile) return createMapData();
    const rider = marker({
      id: `rider:${profile.rider_id || profile.id || 'current'}`,
      kind: 'rider',
      label: profile.name || profile.rider_id || '라이더',
      lat: profile.lat ?? profile.current_lat,
      lng: profile.lng ?? profile.current_lng,
      meta: { selected: Boolean(profile.meta?.selected) },
    });
    return createMapData({ markers: [rider] });
  };

  const fromRiders = (riders, { selectedRiderId } = {}) => createMapData({
    markers: (Array.isArray(riders) ? riders : []).map(rider => marker({
      id: `rider:${rider.rider_id || rider.id || 'unknown'}`,
      kind: 'rider',
      label: rider.name || rider.rider_id || '라이더',
      lat: rider.lat ?? rider.current_lat,
      lng: rider.lng ?? rider.current_lng,
      meta: { selected: String(rider.rider_id || rider.id || '') === String(selectedRiderId || '') },
    })),
  });

  const fromStores = stores => createMapData({
    markers: (Array.isArray(stores) ? stores : []).map(store => marker({
      id: `store:${store.store_id}`,
      kind: 'store',
      label: store.name || `매장 ${store.store_id}`,
      lat: store.lat,
      lng: store.lng,
    })),
  });

  const fromRouteDetail = routeDetail => {
    const route = (Array.isArray(routeDetail) ? routeDetail : []).map((step, index) => marker({
      id: `route:${step.order_id ?? index}:${step.type ?? 'stop'}:${step.sequence ?? index + 1}`,
      kind: String(step.type || '').toLowerCase() === 'pickup' ? 'store' : 'delivery',
      label: step.label || `주문 ${step.order_id ?? '-'}`,
      lat: step.lat,
      lng: step.lng,
      sequence: step.sequence ?? index + 1,
      meta: { orderId: step.order_id, type: step.type },
    }));
    return createMapData({ markers: route, route });
  };

  const combine = (...maps) => createMapData({
    markers: maps.flatMap(map => map?.markers || []),
    route: maps.flatMap(map => map?.route || []),
  });

  const boundsFor = points => {
    if (!points.length) return null;
    const latitudes = points.map(point => point.lat);
    const longitudes = points.map(point => point.lng);
    const minimumLat = Math.min(...latitudes);
    const maximumLat = Math.max(...latitudes);
    const minimumLng = Math.min(...longitudes);
    const maximumLng = Math.max(...longitudes);
    const latPadding = Math.max((maximumLat - minimumLat) * 0.18, 0.001);
    const lngPadding = Math.max((maximumLng - minimumLng) * 0.18, 0.001);
    return {
      minLat: minimumLat - latPadding,
      maxLat: maximumLat + latPadding,
      minLng: minimumLng - lngPadding,
      maxLng: maximumLng + lngPadding,
    };
  };

  const renderSvgMap = (containerId, map) => {
    const root = document.getElementById(containerId);
    if (!root) return;
    root.querySelector('.route-svg')?.remove();
    root.querySelectorAll('.map-pin.dynamic, .map-empty').forEach(node => node.remove());
    const data = createMapData(map);
    const points = [...data.markers, ...data.route];
    const bounds = boundsFor(points);
    if (!bounds) {
      const empty = document.createElement('div');
      empty.className = 'map-empty subtext';
      empty.textContent = '표시할 좌표가 없습니다.';
      root.appendChild(empty);
      return;
    }
    const project = point => ({
      x: Math.max(7, Math.min(93, 7 + (point.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng) * 86)),
      y: Math.max(7, Math.min(93, 93 - (point.lat - bounds.minLat) / (bounds.maxLat - bounds.minLat) * 86)),
    });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'route-svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    if (data.route.length > 1) {
      const route = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      route.setAttribute('class', 'map-route-line');
      route.setAttribute('fill', 'none');
      route.setAttribute('d', data.route.map((point, index) => {
        const position = project(point);
        return `${index ? 'L' : 'M'} ${position.x} ${position.y}`;
      }).join(' '));
      svg.appendChild(route);
    }
    root.appendChild(svg);
    data.markers.forEach((item, index) => {
      const position = project(item);
      const pin = document.createElement('div');
      const riderRole = item.kind === 'rider' ? (item.meta?.selected ? 'selected-rider' : 'other-rider') : '';
      pin.className = `map-pin dynamic ${item.kind === 'store' ? 'store' : item.kind === 'rider' ? 'rider' : ''} ${riderRole}`;
      pin.style.left = `${position.x}%`;
      pin.style.top = `${position.y}%`;
      pin.setAttribute('aria-label', item.label);
      pin.title = item.label;
      const icon = document.createElement('span');
      icon.textContent = item.kind === 'rider' ? '🏍' : item.kind === 'store' ? '가' : String(item.sequence || index + 1);
      pin.appendChild(icon);
      root.appendChild(pin);
    });
  };

  const pollRider = (riderId, onData, options) => window.Yogiyo.poll(
    () => window.Yogiyo.apiClient.riders.profile(riderId),
    profile => onData(fromRiderProfile(profile), profile),
    options,
  );

  window.Yogiyo.mapData = Object.freeze({
    coordinate,
    marker,
    create: createMapData,
    fromCustomerOrder,
    fromRiderProfile,
    fromRiders,
    fromStores,
    fromRouteDetail,
    combine,
    pollRider,
  });
  window.Yogiyo.renderMap = renderSvgMap;
})();
