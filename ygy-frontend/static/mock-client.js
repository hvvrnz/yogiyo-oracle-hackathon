(() => {
  const storageKey = 'ygy-frontend-api-compatible-mock-v2';
  const clone = value => JSON.parse(JSON.stringify(value));
  const createError = (message, status = 400) => Object.assign(new Error(message), { status });
  const initialState = () => ({
    stores: [
      { store_id: 892, name: '목업 즉석국세트 성수점', category: '한식', region: '성수', lat: 37.5443, lng: 127.0557 },
      { store_id: 781, name: '목업 까르보나라 성수781점', category: '면류', region: '성수', lat: 37.5412, lng: 127.0559 },
      { store_id: 467, name: '목업 치킨샐러드 홍대467점', category: '샐러드', region: '홍대', lat: 37.5564, lng: 126.9237 },
      { store_id: 273, name: '목업 참치샌드위치 노원273점', category: '샌드위치', region: '노원', lat: 37.6542, lng: 127.0612 },
    ],
    orders: {
      1: { order_id: 1, store_id: 892, store_name: '목업 즉석국세트 성수점', store_lat: 37.5443, store_lng: 127.0557, delivery_lat: 37.5398, delivery_lng: 127.0611, menu_items: [{ menu: '즉석국세트', qty: 1, price: 12000 }], amount: 12000, delivery_fee: 3000, status: 'NEW', eta_min: null, package_id: null },
      2: { order_id: 2, store_id: 892, store_name: '목업 즉석국세트 성수점', store_lat: 37.5443, store_lng: 127.0557, delivery_lat: 37.5482, delivery_lng: 127.0468, menu_items: [{ menu: '곰탕', qty: 1, price: 9500 }], amount: 9500, delivery_fee: 3000, status: 'MATCHED', eta_min: 22, package_id: null },
      3: { order_id: 3, store_id: 892, store_name: '목업 즉석국세트 성수점', store_lat: 37.5443, store_lng: 127.0557, delivery_lat: 37.5351, delivery_lng: 127.0583, menu_items: [{ menu: '제육덮밥', qty: 1, price: 10500 }], amount: 10500, delivery_fee: 3000, status: 'MATCHED', eta_min: 20, package_id: null },
      118: { order_id: 118, store_id: 781, store_name: '목업 까르보나라 성수781점', store_lat: 37.5412, store_lng: 127.0559, delivery_lat: 37.5374, delivery_lng: 127.0619, menu_items: [{ menu: '까르보나라', qty: 1, price: 13500 }], amount: 13500, delivery_fee: 3000, status: 'MATCHED', eta_min: 16, package_id: 740 },
      184: { order_id: 184, store_id: 467, store_name: '목업 치킨샐러드 홍대467점', store_lat: 37.5564, store_lng: 126.9237, delivery_lat: 37.5518, delivery_lng: 126.9281, menu_items: [{ menu: '치킨샐러드', qty: 1, price: 11800 }], amount: 11800, delivery_fee: 3000, status: 'MATCHED', eta_min: 19, package_id: 638 },
      226: { order_id: 226, store_id: 273, store_name: '목업 참치샌드위치 노원273점', store_lat: 37.6542, store_lng: 127.0612, delivery_lat: 37.6507, delivery_lng: 127.0564, menu_items: [{ menu: '참치샌드위치', qty: 1, price: 9800 }], amount: 9800, delivery_fee: 3000, status: 'MATCHED', eta_min: 21, package_id: 635 },
    },
    riders: {
      rider_102: { rider_id: 'rider_102', name: '목업 속도광부장', region: '성수', status: 'ASSIGNED', completed_order_count: 4, lat: 37.5417, lng: 127.0522 },
      rider_103: { rider_id: 'rider_103', name: '목업 민첩라이더', region: '홍대', status: 'ASSIGNED', completed_order_count: 2, lat: 37.5537, lng: 126.9261 },
      rider_105: { rider_id: 'rider_105', name: '목업 안전라이더', region: '노원', status: 'ASSIGNED', completed_order_count: 7, lat: 37.6521, lng: 127.0594 },
    },
    packages: {
      740: { package_id: 740, rider_id: 'rider_102', package_type: 'SOLO', status: 'MATCHING', bundle_size: 1, score: 82.5, package_revenue: 4200, hourly_revenue: 12600, order_ids: [118], route_detail: [{ order_id: 118, type: 'pickup', sequence: 1 }, { order_id: 118, type: 'dropoff', sequence: 2 }], score_detail: {}, created_at: '2026-01-01T10:00:00Z' },
      638: { package_id: 638, rider_id: 'rider_103', package_type: 'SOLO', status: 'MATCHING', bundle_size: 1, score: 78.4, package_revenue: 4200, hourly_revenue: 11800, order_ids: [184], route_detail: [{ order_id: 184, type: 'pickup', sequence: 1 }, { order_id: 184, type: 'dropoff', sequence: 2 }], score_detail: {}, created_at: '2026-01-01T10:00:00Z' },
      635: { package_id: 635, rider_id: 'rider_105', package_type: 'SOLO', status: 'MATCHING', bundle_size: 1, score: 74.1, package_revenue: 4200, hourly_revenue: 10900, order_ids: [226], route_detail: [{ order_id: 226, type: 'pickup', sequence: 1 }, { order_id: 226, type: 'dropoff', sequence: 2 }], score_detail: {}, created_at: '2026-01-01T10:00:00Z' },
    },
    explanations: {},
  });
  const load = () => {
    try {
      const stored = JSON.parse(window.localStorage?.getItem(storageKey));
      return stored?.orders && stored?.riders && stored?.packages ? stored : initialState();
    } catch { return initialState(); }
  };
  const state = load();
  const save = () => {
    try { window.localStorage?.setItem(storageKey, JSON.stringify(state)); } catch {}
  };
  const findPackage = packageId => state.packages[String(packageId)] || state.packages[Number(packageId)];
  const profile = riderId => {
    const rider = state.riders[riderId];
    if (!rider) throw createError('해당 라이더를 찾을 수 없습니다.', 404);
    return clone(rider);
  };
  const packageForRider = riderId => Object.values(state.packages).filter(pkg => pkg.rider_id === riderId).map(clone);
  const client = Object.freeze({
    customers: Object.freeze({
      get: async orderId => {
        const order = state.orders[String(orderId)];
        if (!order) throw createError('해당 주문을 찾을 수 없습니다.', 404);
        return clone(order);
      },
      cancel: async orderId => {
        const order = state.orders[String(orderId)];
        if (!order) throw createError('해당 주문을 찾을 수 없습니다.', 404);
        const pkg = order.package_id && findPackage(order.package_id);
        if (pkg && ['PICKED_UP', 'COMPLETED'].includes(pkg.status)) throw createError('이미 픽업된 주문은 취소할 수 없습니다. 고객센터에 문의해 주세요.', 400);
        order.status = 'CANCELLED';
        save();
        return { order_id: order.order_id, status: order.status };
      },
    }),
    merchants: Object.freeze({
      get: async storeId => {
        const store = state.stores.find(item => String(item.store_id) === String(storeId));
        const orders = Object.values(state.orders).filter(order => String(order.store_id) === String(storeId));
        if (!store || !orders.length) throw createError('해당 매장의 주문 내역이 없습니다.', 404);
        return clone({ store_id: store.store_id, orders: orders.map(order => {
          const pkg = order.package_id && findPackage(order.package_id);
          return { order_id: order.order_id, menu_items: order.menu_items, amount: order.amount, status: order.status, owner_cook_min: order.owner_cook_min ?? 15, predicted_cook_min: order.predicted_cook_min ?? 15, package_id: order.package_id, route_detail: pkg?.route_detail || [], rider_id: pkg?.rider_id ?? null };
        }) });
      },
      updateCookTime: async (orderId, ownerCookMin) => {
        const order = state.orders[String(orderId)];
        if (!order) throw createError('해당 주문을 찾을 수 없습니다.', 404);
        order.owner_cook_min = Number(ownerCookMin);
        save();
        return { order_id: order.order_id, owner_cook_min: order.owner_cook_min };
      },
    }),
    riders: Object.freeze({
      list: async () => ({ count: Object.keys(state.riders).length, riders: Object.values(state.riders).map(clone) }),
      profile: async riderId => profile(riderId),
      get: async riderId => {
        const rider = profile(riderId);
        const packages = packageForRider(riderId);
        if (!packages.length) throw createError('해당 라이더의 배정 내역이 없습니다.', 404);
        return { rider_id: riderId, current_lat: rider.lat, current_lng: rider.lng, packages };
      },
      pickup: async (riderId, packageId) => {
        profile(riderId);
        const pkg = findPackage(packageId);
        if (!pkg || pkg.rider_id !== riderId) throw createError('해당 패키지를 찾을 수 없습니다.', 404);
        pkg.status = 'PICKED_UP';
        save();
        return { package_id: pkg.package_id, status: pkg.status };
      },
      complete: async (riderId, packageId) => {
        const rider = profile(riderId);
        const pkg = findPackage(packageId);
        if (!pkg || pkg.rider_id !== riderId) throw createError('해당 패키지를 찾을 수 없습니다.', 404);
        pkg.status = 'COMPLETED';
        rider.completed_order_count += 1;
        rider.status = 'AVAILABLE';
        save();
        return { package_id: pkg.package_id, status: pkg.status };
      },
    }),
    stores: Object.freeze({ list: async () => ({ stores: clone(state.stores) }) }),
    explanations: Object.freeze({
      context: async packageId => ({ package: clone(findPackage(packageId) || {}), orders: [] }),
      save: async body => { state.explanations[body.package_id] = clone(body); save(); return clone(body); },
      get: async packageId => clone(state.explanations[packageId] || null),
    }),
  });
  Object.assign(window.Yogiyo, { apiClient: client, useMock: true, mockState: state, resetMock: () => { Object.assign(state, initialState()); save(); } });
})();
