(() => {
  const storageKey = 'ygy-frontend-api-compatible-mock-v5';
  const clone = value => JSON.parse(JSON.stringify(value));
  const createError = (message, status = 400) => Object.assign(new Error(message), { status });
  const initialState = () => ({
    stores: [
      { store_id: 889, name: '목업 강남889점', category: '한식', region: '강남', lat: 37.4982, lng: 127.0276 },
      { store_id: 894, name: '목업 강남894점', category: '치킨', region: '강남', lat: 37.5014, lng: 127.0310 },
      { store_id: 884, name: '목업 홍대884점', category: '분식', region: '홍대', lat: 37.5568, lng: 126.9239 },
      { store_id: 892, name: '목업 즉석국세트 성수점', category: '한식', region: '성수', lat: 37.5443, lng: 127.0557 },
      { store_id: 781, name: '목업 까르보나라 성수781점', category: '면류', region: '성수', lat: 37.5412, lng: 127.0559 },
      { store_id: 467, name: '목업 치킨샐러드 홍대467점', category: '샐러드', region: '홍대', lat: 37.5564, lng: 126.9237 },
      { store_id: 273, name: '목업 참치샌드위치 노원273점', category: '샌드위치', region: '노원', lat: 37.6542, lng: 127.0612 },
    ],
    orders: {
      8941: { order_id: 8941, store_id: 894, store_name: '목업 강남894점', store_lat: 37.5014, store_lng: 127.0310, delivery_lat: 37.5056, delivery_lng: 127.0361, menu_items: [{ menu: '후라이드치킨', qty: 1, price: 19000 }], amount: 19000, delivery_fee: 3500, status: 'NEW', owner_cook_min: null, eta_min: null, package_id: null, rider_id: null },
      8891: { order_id: 8891, store_id: 889, store_name: '목업 강남889점', store_lat: 37.4982, store_lng: 127.0276, delivery_lat: 37.4938, delivery_lng: 127.0334, menu_items: [{ menu: '제육덮밥', qty: 1, price: 12000 }], amount: 12000, delivery_fee: 3000, status: 'COOKING', owner_cook_min: 20, eta_min: null, package_id: 990, rider_id: null },
      8892: { order_id: 8892, store_id: 889, store_name: '목업 강남889점', store_lat: 37.4982, store_lng: 127.0276, delivery_lat: 37.5015, delivery_lng: 127.0387, menu_items: [{ menu: '비빔밥', qty: 1, price: 11000 }], amount: 11000, delivery_fee: 3000, status: 'COOKING', owner_cook_min: 20, eta_min: null, package_id: 990, rider_id: null },
      1: { order_id: 1, store_id: 892, store_name: '목업 즉석국세트 성수점', store_lat: 37.5443, store_lng: 127.0557, delivery_lat: 37.5398, delivery_lng: 127.0611, menu_items: [{ menu: '즉석국세트', qty: 1, price: 12000 }], amount: 12000, delivery_fee: 3000, status: 'NEW', eta_min: null, package_id: null, rider_id: null },
      2: { order_id: 2, store_id: 892, store_name: '목업 즉석국세트 성수점', store_lat: 37.5443, store_lng: 127.0557, delivery_lat: 37.5482, delivery_lng: 127.0468, menu_items: [{ menu: '곰탕', qty: 1, price: 9500 }], amount: 9500, delivery_fee: 3000, status: 'MATCHED', eta_min: 22, package_id: null, rider_id: null },
      3: { order_id: 3, store_id: 892, store_name: '목업 즉석국세트 성수점', store_lat: 37.5443, store_lng: 127.0557, delivery_lat: 37.5351, delivery_lng: 127.0583, menu_items: [{ menu: '제육덮밥', qty: 1, price: 10500 }], amount: 10500, delivery_fee: 3000, status: 'MATCHED', eta_min: 20, package_id: null, rider_id: null },
      118: { order_id: 118, store_id: 781, store_name: '목업 까르보나라 성수781점', store_lat: 37.5412, store_lng: 127.0559, delivery_lat: 37.5374, delivery_lng: 127.0619, menu_items: [{ menu: '까르보나라', qty: 1, price: 13500 }], amount: 13500, delivery_fee: 3000, status: 'MATCHED', eta_min: 16, package_id: 740, rider_id: 'rider_102' },
      184: { order_id: 184, store_id: 467, store_name: '목업 치킨샐러드 홍대467점', store_lat: 37.5564, store_lng: 126.9237, delivery_lat: 37.5518, delivery_lng: 126.9281, menu_items: [{ menu: '치킨샐러드', qty: 1, price: 11800 }], amount: 11800, delivery_fee: 3000, status: 'MATCHED', eta_min: 19, package_id: 638, rider_id: 'rider_103' },
      226: { order_id: 226, store_id: 273, store_name: '목업 참치샌드위치 노원273점', store_lat: 37.6542, store_lng: 127.0612, delivery_lat: 37.6507, delivery_lng: 127.0564, menu_items: [{ menu: '참치샌드위치', qty: 1, price: 9800 }], amount: 9800, delivery_fee: 3000, status: 'MATCHED', eta_min: 21, package_id: 635, rider_id: 'rider_105' },
    },
    riders: {
      rider_12: { rider_id: 'rider_12', name: '목업 강남 라이더', region: '강남', status: 'AVAILABLE', completed_order_count: 3, lat: 37.4997, lng: 127.0292 },
      rider_13: { rider_id: 'rider_13', name: '목업 강남 라이더 13', region: '강남', status: 'AVAILABLE', completed_order_count: 1, lat: 37.5008, lng: 127.0304 },
      rider_19: { rider_id: 'rider_19', name: '목업 강남 라이더 19', region: '강남', status: 'AVAILABLE', completed_order_count: 2, lat: 37.4973, lng: 127.0264 },
      rider_23: { rider_id: 'rider_23', name: '목업 강남 라이더 23', region: '강남', status: 'AVAILABLE', completed_order_count: 4, lat: 37.5021, lng: 127.0330 },
      rider_31: { rider_id: 'rider_31', name: '목업 강남 라이더 31', region: '강남', status: 'AVAILABLE', completed_order_count: 0, lat: 37.4959, lng: 127.0281 },
      rider_2: { rider_id: 'rider_2', name: '목업 홍대 라이더', region: '홍대', status: 'AVAILABLE', completed_order_count: 5, lat: 37.5552, lng: 126.9261 },
      rider_5: { rider_id: 'rider_5', name: '목업 홍대 라이더 5', region: '홍대', status: 'AVAILABLE', completed_order_count: 2, lat: 37.5575, lng: 126.9223 },
      rider_6: { rider_id: 'rider_6', name: '목업 홍대 라이더 6', region: '홍대', status: 'AVAILABLE', completed_order_count: 6, lat: 37.5540, lng: 126.9280 },
      rider_102: { rider_id: 'rider_102', name: '목업 속도광부장', region: '성수', status: 'ASSIGNED', completed_order_count: 4, lat: 37.5417, lng: 127.0522 },
      rider_103: { rider_id: 'rider_103', name: '목업 민첩라이더', region: '홍대', status: 'ASSIGNED', completed_order_count: 2, lat: 37.5537, lng: 126.9261 },
      rider_105: { rider_id: 'rider_105', name: '목업 안전라이더', region: '노원', status: 'ASSIGNED', completed_order_count: 7, lat: 37.6521, lng: 127.0594 },
    },
    packages: {
      990: { package_id: 990, rider_id: null, package_type: 'BUNDLE', status: 'OFFERED', bundle_size: 2, score: 72.4, package_revenue: 6800, hourly_revenue: 20400, order_ids: [8891, 8892], route_detail: [{ order_id: 8891, type: 'pickup', sequence: 1 }, { order_id: 8892, type: 'pickup', sequence: 2 }, { order_id: 8891, type: 'dropoff', sequence: 3 }, { order_id: 8892, type: 'dropoff', sequence: 4 }], score_detail: {}, created_at: '2026-08-16T10:00:00Z' },
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
  const nextPackageId = () => Math.max(0, ...Object.keys(state.packages).map(Number)) + 1;
  const createOfferForOrder = order => {
    if (order.package_id) return;
    const packageId = nextPackageId();
    state.packages[packageId] = {
      package_id: packageId,
      rider_id: null,
      package_type: 'SOLO',
      status: 'OFFERED',
      bundle_size: 1,
      score: 64.8,
      package_revenue: Number(order.delivery_fee || 3000),
      hourly_revenue: 18000,
      order_ids: [order.order_id],
      route_detail: [
        { order_id: order.order_id, type: 'pickup', sequence: 1 },
        { order_id: order.order_id, type: 'dropoff', sequence: 2 },
      ],
      score_detail: { timeline: [] },
      created_at: new Date().toISOString(),
    };
    order.package_id = packageId;
  };
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
        if (['PICKED_UP', 'DELIVERED', 'COMPLETED'].includes(order.status)) throw createError('이미 픽업된 주문은 취소할 수 없습니다. 고객센터에 문의해 주세요.', 400);
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
          const rider = pkg?.rider_id ? state.riders[pkg.rider_id] : null;
          return { order_id: order.order_id, menu_items: order.menu_items, amount: order.amount, status: order.status, owner_cook_min: order.owner_cook_min ?? 15, predicted_cook_min: order.predicted_cook_min ?? 15, package_id: order.package_id, route_detail: pkg?.route_detail || [], rider_id: pkg?.rider_id ?? null, rider_name: rider?.name ?? null, eta_min: order.eta_min };
        }) });
      },
      updateCookTime: async (orderId, ownerCookMin) => {
        const order = state.orders[String(orderId)];
        if (!order) throw createError('해당 주문을 찾을 수 없습니다.', 404);
        order.owner_cook_min = Number(ownerCookMin);
        order.status = 'COOKING';
        save();
        // 실제 30초 클러스터링을 기다리는 대신, 목업에서는 짧은 지연 뒤 제안을 만든다.
        window.setTimeout(() => {
          if (order.status === 'COOKING' && !order.package_id) {
            createOfferForOrder(order);
            save();
          }
        }, 1000);
        return { order_id: order.order_id, status: order.status, owner_cook_min: order.owner_cook_min };
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
      getEarnings: async riderId => {
        profile(riderId);
        const packages = packageForRider(riderId);
        const completedPackages = packages.filter(pkg => pkg.status === 'COMPLETED');
        return {
          rider_id: riderId,
          total_package_count: packages.length,
          completed_count: completedPackages.length,
          total_revenue: completedPackages.reduce((total, pkg) => total + Number(pkg.package_revenue || 0), 0),
          packages,
        };
      },
      offers: async riderId => {
        profile(riderId);
        return { rider_id: riderId, offers: Object.values(state.packages).filter(pkg => pkg.status === 'OFFERED').map(clone) };
      },
      accept: async (riderId, packageId) => {
        const rider = profile(riderId);
        const pkg = findPackage(packageId);
        if (!pkg) throw createError('해당 패키지를 찾을 수 없습니다.', 404);
        if (pkg.status !== 'OFFERED') throw createError('이미 다른 라이더가 수락한 배차입니다.', 409);
        pkg.rider_id = riderId;
        pkg.status = 'MATCHING';
        pkg.order_ids.forEach(orderId => {
          const order = state.orders[String(orderId)];
          if (order) {
            order.status = 'MATCHED';
            order.rider_id = riderId;
          }
        });
        rider.status = 'BUSY';
        save();
        return { package_id: pkg.package_id, rider_id: riderId, status: pkg.status };
      },
      pickup: async (riderId, packageId) => {
        profile(riderId);
        const pkg = findPackage(packageId);
        if (!pkg || pkg.rider_id !== riderId) throw createError('해당 패키지를 찾을 수 없습니다.', 404);
        pkg.status = 'PICKED_UP';
        pkg.order_ids.forEach(orderId => {
          const order = state.orders[String(orderId)];
          if (order) order.status = 'PICKED_UP';
        });
        save();
        return { package_id: pkg.package_id, status: pkg.status };
      },
      complete: async (riderId, packageId) => {
        const rider = profile(riderId);
        const pkg = findPackage(packageId);
        if (!pkg || pkg.rider_id !== riderId) throw createError('해당 패키지를 찾을 수 없습니다.', 404);
        pkg.status = 'COMPLETED';
        pkg.order_ids.forEach(orderId => {
          const order = state.orders[String(orderId)];
          if (order) order.status = 'DELIVERED';
        });
        rider.completed_order_count += 1;
        rider.status = 'AVAILABLE';
        save();
        return { package_id: pkg.package_id, status: pkg.status };
      },
    }),
    packages: Object.freeze({
      get: async packageId => {
        const pkg = findPackage(packageId);
        if (!pkg) throw createError('해당 패키지를 찾을 수 없습니다.', 404);
        return clone(pkg);
      },
    }),
    stores: Object.freeze({ list: async () => ({ stores: clone(state.stores) }) }),
    explanations: Object.freeze({
      context: async packageId => ({ package: clone(findPackage(packageId) || {}), orders: [] }),
      save: async body => { state.explanations[body.package_id] = clone(body); save(); return clone(body); },
      get: async packageId => clone(state.explanations[packageId] || null),
    }),
  });
  Object.assign(window.Yogiyo, {
    apiClient: client,
    useMock: true,
    mockState: state,
    pollRiders: (onData, options) => window.Yogiyo.poll(() => client.riders.list(), onData, options),
    resetMock: () => { Object.assign(state, initialState()); save(); },
  });
})();
