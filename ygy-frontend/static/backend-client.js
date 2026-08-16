(() => {
  const config = window.__YGY_CONFIG__ || {};
  const apiBaseUrl = String(config.apiBaseUrl || '').replace(/\/+$/, '');
  const apiPaths = config.apiPaths && typeof config.apiPaths === 'object' ? config.apiPaths : {};
  const defaultIds = Object.freeze({
    customer: String(config.defaultOrderId || '118'),
    merchant: String(config.defaultStoreId || '781'),
    rider: String(config.defaultRiderId || 'rider_102'),
  });

  const endpoint = (name, fallback, params = {}) => {
    const template = String(apiPaths[name] || fallback);
    return template.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, (_, key) => {
      if (!(key in params)) throw new Error(`VITE_API_PATHS.${name}에 필요한 :${key} 값이 없습니다.`);
      return encodeURIComponent(params[key]);
    });
  };
  const parseJson = (value, fallback) => {
    if (value == null || value === '') return fallback;
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return fallback; }
  };
  const asArray = value => Array.isArray(value) ? value : [];
  const toNumber = value => value == null || value === '' ? null : Number(value);
  const normalizeMenuItems = value => asArray(parseJson(value, [])).map(item => ({
    ...item,
    menu: item.menu ?? item.name ?? '메뉴',
    qty: Number(item.qty ?? item.quantity ?? 0),
    price: Number(item.price ?? 0),
  }));
  const normalizeRoute = value => asArray(parseJson(value, [])).map((step, index) => ({
    ...step,
    type: String(step.type || '').toLowerCase(),
    sequence: Number(step.sequence ?? index + 1),
  }));
  const normalizeScoreDetail = value => {
    const detail = parseJson(value, {});
    return detail && typeof detail === 'object' && !Array.isArray(detail) ? detail : {};
  };
  const normalizePackage = pkg => ({
    ...pkg,
    package_id: Number(pkg.package_id),
    bundle_size: Number(pkg.bundle_size ?? 0),
    score: toNumber(pkg.score),
    package_revenue: Number(pkg.package_revenue ?? 0),
    hourly_revenue: Number(pkg.hourly_revenue ?? 0),
    order_ids: asArray(parseJson(pkg.order_ids, [])),
    route_detail: normalizeRoute(pkg.route_detail),
    score_detail: normalizeScoreDetail(pkg.score_detail),
  });
  const normalizeRider = rider => ({
    ...rider,
    lat: toNumber(rider.lat ?? rider.current_lat),
    lng: toNumber(rider.lng ?? rider.current_lng),
    completed_order_count: Number(rider.completed_order_count ?? 0),
  });

  const request = async (path, options = {}) => {
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    if (options.body != null && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    let response;
    try {
      response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
    } catch {
      throw new Error('백엔드 서버에 연결할 수 없습니다. http://localhost:8000 실행 상태를 확인해 주세요.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.detail || data.message || `요청에 실패했습니다. (${response.status})`);
      error.status = response.status;
      error.payload = data;
      throw error;
    }
    return data;
  };

  const apiClient = Object.freeze({
    customers: Object.freeze({
      get: async orderId => {
        const data = await request(endpoint('customer', '/api/customer/:orderId', { orderId }));
        return { ...data, menu_items: normalizeMenuItems(data.menu_items), eta_min: toNumber(data.eta_min) };
      },
      cancel: orderId => request(endpoint('customerCancel', '/api/customer/:orderId', { orderId }), { method: 'DELETE' }),
    }),
    merchants: Object.freeze({
      get: async storeId => {
        const data = await request(endpoint('merchant', '/api/merchant/:storeId', { storeId }));
        return {
          ...data,
          orders: asArray(data.orders).map(order => ({
            ...order,
            menu_items: normalizeMenuItems(order.menu_items),
            route_detail: normalizeRoute(order.route_detail),
            owner_cook_min: toNumber(order.owner_cook_min),
            predicted_cook_min: toNumber(order.predicted_cook_min),
            eta_min: toNumber(order.eta_min),
          })),
        };
      },
      updateCookTime: (orderId, ownerCookMin) => request(
        endpoint('merchantCookTime', '/api/merchant/orders/:orderId/cook-time', { orderId }),
        { method: 'PUT', body: JSON.stringify({ owner_cook_min: Number(ownerCookMin) }) },
      ),
    }),
    riders: Object.freeze({
      list: async () => {
        const data = await request(endpoint('riders', '/api/rider'));
        return { ...data, riders: asArray(data.riders).map(normalizeRider) };
      },
      get: async riderId => {
        const data = await request(endpoint('rider', '/api/rider/:riderId', { riderId }));
        return {
          ...data,
          current_lat: toNumber(data.current_lat),
          current_lng: toNumber(data.current_lng),
          packages: asArray(data.packages).map(normalizePackage),
        };
      },
      getEarnings: async riderId => {
        const data = await request(endpoint('riderEarnings', '/api/rider/:riderId/earnings', { riderId }));
        return {
          ...data,
          total_package_count: Number(data.total_package_count ?? 0),
          completed_count: Number(data.completed_count ?? 0),
          total_revenue: Number(data.total_revenue ?? 0),
          packages: asArray(data.packages).map(normalizePackage),
        };
      },
      profile: async riderId => normalizeRider(await request(endpoint('riderProfile', '/api/rider/:riderId/profile', { riderId }))),
      offers: async riderId => {
        const data = await request(endpoint('riderOffers', '/api/rider/:riderId/offers', { riderId }));
        return { ...data, offers: asArray(data.offers).map(normalizePackage) };
      },
      accept: (riderId, packageId) => request(endpoint('riderAccept', '/api/rider/:riderId/package/:packageId/accept', { riderId, packageId }), { method: 'PUT' }),
      pickup: (riderId, packageId) => request(endpoint('riderPickup', '/api/rider/:riderId/package/:packageId/pickup', { riderId, packageId }), { method: 'PUT' }),
      complete: (riderId, packageId) => request(endpoint('riderComplete', '/api/rider/:riderId/package/:packageId/complete', { riderId, packageId }), { method: 'PUT' }),
    }),
    packages: Object.freeze({
      get: async packageId => normalizePackage(await request(endpoint('package', '/api/package/:packageId', { packageId }))),
    }),
    stores: Object.freeze({
      list: async () => {
        const data = await request(endpoint('stores', '/api/stores'));
        return { ...data, stores: asArray(data.stores).map(store => ({ ...store, lat: toNumber(store.lat), lng: toNumber(store.lng) })) };
      },
    }),
    explanations: Object.freeze({
      context: async packageId => {
        const data = await request(endpoint('explanationContext', '/api/explanation/context/:packageId', { packageId }));
        return {
          ...data,
          package: normalizePackage(data.package || {}),
          orders: asArray(data.orders).map(order => ({ ...order, menu_items: normalizeMenuItems(order.menu_items) })),
        };
      },
      save: body => request(endpoint('explanation', '/api/explanation'), { method: 'POST', body: JSON.stringify(body) }),
      get: packageId => request(endpoint('explanationByPackage', '/api/explanation/:packageId', { packageId })),
    }),
  });

  const poll = (task, onData, { intervalMs = 5000, onError } = {}) => {
    let inFlight = false;
    let stopped = false;
    const run = async () => {
      if (stopped || inFlight) return;
      inFlight = true;
      try { onData?.(await task()); }
      catch (error) { onError?.(error); }
      finally { inFlight = false; }
    };
    run();
    const timer = window.setInterval(run, intervalMs);
    return () => { stopped = true; window.clearInterval(timer); };
  };

  Object.assign(window.Yogiyo, {
    api: request,
    apiClient,
    apiUrl: path => `${apiBaseUrl}${path}`,
    defaultIds,
    poll,
    pollRiders: (onData, options) => poll(() => apiClient.riders.list(), onData, options),
    useMock: false,
  });
})();