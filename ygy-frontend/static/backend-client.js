(() => {
  const config = window.__YGY_CONFIG__ || {};
  const apiBaseUrl = String(config.apiBaseUrl || '').replace(/\/+$/, '');
  const defaultIds = Object.freeze({ customer: '90001', merchant: '889', rider: 'rider_12' });

  const parseJson = (value, fallback) => {
    if (value == null || value === '') return fallback;
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return fallback; }
  };
  const asArray = value => Array.isArray(value) ? value : [];
  const toNumber = value => value == null || value === '' ? null : Number(value);
  const normalizeMenuItems = value => asArray(parseJson(value, [])).map(item => ({ ...item, menu: item.menu ?? item.name ?? '메뉴', qty: Number(item.qty ?? item.quantity ?? 0), price: Number(item.price ?? 0) }));
  const normalizeRoute = value => asArray(parseJson(value, [])).map((step, index) => ({ ...step, type: String(step.type || '').toLowerCase(), sequence: Number(step.sequence ?? index + 1) }));
  const normalizePackage = pkg => ({ ...pkg, package_id: Number(pkg.package_id), bundle_size: Number(pkg.bundle_size ?? 0), score: toNumber(pkg.score), package_revenue: Number(pkg.package_revenue ?? 0), hourly_revenue: Number(pkg.hourly_revenue ?? 0), order_ids: asArray(parseJson(pkg.order_ids, [])), route_detail: normalizeRoute(pkg.route_detail), score_detail: parseJson(pkg.score_detail, {}) || {} });
  const normalizeOrder = order => ({ ...order, menu_items: normalizeMenuItems(order.menu_items), route_detail: normalizeRoute(order.route_detail), eta_min: toNumber(order.eta_min) });
  const normalizeRider = rider => ({ ...rider, lat: toNumber(rider.lat ?? rider.current_lat), lng: toNumber(rider.lng ?? rider.current_lng), completed_order_count: Number(rider.completed_order_count ?? 0) });

  const request = async (path, options = {}) => {
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    let response;
    try {
      response = await fetch(
        `${apiBaseUrl}${path}`,
        {
          ...options,
          headers
        }
      );
    } catch {
      throw new Error(
        '백엔드 서버에 연결할 수 없습니다. 서버 실행 상태와 API 연결 설정을 확인해 주세요.'
      );
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
    demo: Object.freeze({
      reset: () => request('/api/demo/reset', { method: 'POST' }),
      customerOrder: async () => normalizeOrder(await request('/api/demo/customer/order')),
      merchantNextToCook: async () => {
        const data = await request('/api/demo/merchant/next-to-cook');
        return data?.order_id == null ? data : normalizeOrder(data);
      },
      merchantCookStart: ownerCookMin => request('/api/demo/merchant/cook-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_cook_min: Number(ownerCookMin) }),
      }),
      merchantCookComplete: () =>
        request('/api/demo/merchant/cook-complete', {
          method: 'POST',
      }),
      merchantOrders: async () => {
        const data = await request('/api/demo/merchant/next-to-cook');

        if (data?.order_id == null) {
          return { ...data, orders: [] };
        }

        return {
          ...data,
          orders: [normalizeOrder(data)]
        };
      },

      merchantCompleted: async () => {
        const data = await request('/api/demo/merchant/completed');

        return {
          ...data,
          orders: asArray(data.orders).map(normalizeOrder),
        };
      },

      riderOffers: async () => {
        const data = await request('/api/demo/rider/offers');
        return { ...data, offers: asArray(data.offers).map(normalizePackage) };
      },
      riderProfile: async () => normalizeRider(await request('/api/demo/rider/profile')),
      acceptPackage: packageId => request(`/api/demo/rider/package/${encodeURIComponent(packageId)}/accept`, { method: 'PUT' }),
      riderNextStop: () => request('/api/demo/rider/next-stop'),
      riderArrive: () => request('/api/demo/rider/arrive', { method: 'POST' }),
      stores: async () => {
        const data = await request('/api/demo/stores');
        return { ...data, stores: asArray(data.stores).map(store => ({ ...store, lat: toNumber(store.lat), lng: toNumber(store.lng) })) };
      },
    }),
  });

  Object.assign(
    window.Yogiyo,
    {
      api: request,
      apiClient,
      apiUrl:
        path =>
          `${apiBaseUrl}${path}`,
      defaultIds,
      useMock: false
    }
  );
})();
