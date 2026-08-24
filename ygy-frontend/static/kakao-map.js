(() => {
  const SDK_PROMISE_KEY =
    '__YGY_KAKAO_MAP_SDK_PROMISE__';

  const mapStates =
    new WeakMap();

  const geocodeCache =
    new Map();

  let enabled = false;


  const clearSvgArtifacts = root => {
    root
      .querySelector('.route-svg')
      ?.remove();

    root
      .querySelectorAll(
        '.map-pin.dynamic, .map-empty'
      )
      .forEach(node =>
        node.remove()
      );
  };


  const setKakaoLayerVisible = (
    root,
    visible
  ) => {
    const layer =
      root.querySelector(
        '.kakao-map-layer'
      );

    if (layer) {
      layer.hidden = !visible;
    }

    root.classList.toggle(
      'kakao-map-active',
      visible
    );
  };


  const loadSdk = appKey => {
    if (window.kakao?.maps) {
      return Promise.resolve(
        window.kakao
      );
    }

    if (window[SDK_PROMISE_KEY]) {
      return window[
        SDK_PROMISE_KEY
      ];
    }

    window[SDK_PROMISE_KEY] =
      new Promise(
        (resolve, reject) => {
          const script =
            document.createElement(
              'script'
            );

          script.id =
            'ygy-kakao-map-sdk';

          script.async = true;

          script.src =
            'https://dapi.kakao.com/v2/maps/sdk.js' +
            '?autoload=false' +
            '&libraries=services' +
            `&appkey=${encodeURIComponent(
              appKey
            )}`;

          script.onload = () => {
            if (
              !window.kakao
                ?.maps
                ?.load
            ) {
              reject(
                new Error(
                  '카카오맵 SDK를 초기화할 수 없습니다.'
                )
              );

              return;
            }

            window.kakao.maps.load(
              () =>
                resolve(
                  window.kakao
                )
            );
          };

          script.onerror = () =>
            reject(
              new Error(
                '카카오맵 SDK를 불러오지 못했습니다. JavaScript 키와 허용 도메인을 확인해 주세요.'
              )
            );

          document.head.appendChild(
            script
          );
        }
      ).catch(error => {
        delete window[
          SDK_PROMISE_KEY
        ];

        throw error;
      });

    return window[
      SDK_PROMISE_KEY
    ];
  };


  const positionOf = point =>
    new window.kakao.maps.LatLng(
      point.lat,
      point.lng
    );


  const routeSignature = route =>
    route
      .map(
        point =>
          `${point.id}:${
            point.lat.toFixed(6)
          },${
            point.lng.toFixed(6)
          }`
      )
      .join('|');


  const clearOverlays = state => {
    state.markers.forEach(
      marker =>
        marker.setMap(null)
    );

    state.markers = [];

    state.polyline?.setMap(null);
    state.polyline = null;
  };

  const placeMarkerSvg = kind => {
  if (kind === 'store') {
    return `
      <svg
        width="21"
        height="21"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.1"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M4 10h16" />
        <path d="M5 10v9h14v-9" />
        <path d="M7 4h10l3 6H4l3-6Z" />
        <path d="M9 19v-5h6v5" />
      </svg>
    `;
  }

  return `
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.1"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v10h13V10" />
      <path d="M9.5 20v-6h5v6" />
    </svg>
  `;
};


const createCustomerPlaceMarker = kind => {
  const marker =
    document.createElement('div');

  marker.className =
    `customer-kakao-marker ${kind}`;

  const isStore =
    kind === 'store';

  marker.innerHTML =
    placeMarkerSvg(kind);

  marker.style.cssText = `
    width: 38px;
    height: 38px;

    display: flex;
    align-items: center;
    justify-content: center;

    border-radius: 14px;

    background:
      ${isStore
        ? '#ffffff'
        : '#ff2f6e'};

    color:
      ${isStore
        ? '#ff2f6e'
        : '#ffffff'};

    border:
      3px solid
      ${isStore
        ? '#ff2f6e'
        : '#ffffff'};

    box-shadow:
      0 4px 12px
      rgba(26, 28, 38, 0.20);

    box-sizing: border-box;
  `;

  return marker;
};

const riderMarkerSvg = () => `
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <circle cx="5.5" cy="17.5" r="2.5" />
    <circle cx="18.5" cy="17.5" r="2.5" />

    <path d="M8 17.5h5l2.2-5H11l-2.3-3H6.5" />
    <path d="M15.2 12.5h3l1.6 2.3" />
    <path d="M6 15.3 8.5 12" />
    <path d="M16.5 9.5h2.5" />
  </svg>
`;

const fitMapOnce = (state, data) => {
  const routeStopMarkers =
    data.markers.filter(
      item =>
        [
          'pickup',
          'dropoff',
          'delivery'
        ].includes(
          String(
            item.meta?.type || ''
          ).toLowerCase()
        )
    );

  const stableMarkers =
    data.markers.filter(
      item =>
        item.kind !== 'rider'
    );

  const points =
    data.route.length
      ? data.route
      : routeStopMarkers.length
        ? routeStopMarkers
        : stableMarkers.length
          ? stableMarkers
          : data.markers;

  if (!points.length) return;
  if (state.layer.clientWidth <= 0 || state.layer.clientHeight <= 0) return;

  const signature = routeSignature(points);

  if (state.hasFitted && state.routeSignature === signature) return;

  if (points.length === 1) {
    state.map.setCenter(positionOf(points[0]));
    state.map.setLevel(4);
  } else {
    const bounds = new window.kakao.maps.LatLngBounds();
    points.forEach(point => bounds.extend(positionOf(point)));
    state.map.setBounds(bounds, 120, 36, 130, 36);
  }

  state.hasFitted = true;
  state.routeSignature = signature;
};


  const ensureState = (
    root,
    data
  ) => {
    let state =
      mapStates.get(root);

    if (state) {
      state.layer.hidden = false;
      return state;
    }

    /*
     * 개발 중 스크립트가 재실행된 경우
     * 이전 layer가 남아 중첩되는 것을 방지합니다.
     */
    root
      .querySelectorAll(
        '.kakao-map-layer'
      )
      .forEach(layer =>
        layer.remove()
      );

    const layer =
      document.createElement(
        'div'
      );

    layer.className =
      'kakao-map-layer';

    root.prepend(layer);

    const firstPoint =
      data.markers[0] ||
      data.route[0] || {
        lat: 37.5665,
        lng: 126.9780,
      };

    state = {
      layer,

      map:
        new window.kakao.maps.Map(
          layer,
          {
            center:
              positionOf(
                firstPoint
              ),

            level: 5,
          }
        ),

      markers: [],
      polyline: null,
      
      riderMarker: null,
      riderPoint: null,

      hasFitted: false,

      routeSignature: '',
    };

    mapStates.set(
      root,
      state
    );

    return state;
  };


  const renderKakaoMap = (
    containerId,
    map
  ) => {
    if (
      !enabled ||
      !window.kakao?.maps
    ) {
      return false;
    }

    const root =
      document.getElementById(
        containerId
      );

    if (!root) {
      return false;
    }

    const data =
      window.Yogiyo.mapData.create(
        map
      );

    const hasPoints =
      [
        ...data.markers,
        ...data.route,
      ].length > 0;

    if (!hasPoints) {
      const state =
        mapStates.get(root);

      if (state) {
        clearOverlays(state);
        state.layer.hidden = true;
      }

      root.classList.remove(
        'kakao-map-active'
      );

      return false;
    }

    clearSvgArtifacts(root);

    setKakaoLayerVisible(
      root,
      true
    );

    const state =
      ensureState(
        root,
        data
      );

    clearOverlays(state);


    if (
      data.route.length > 1
    ) {
      state.polyline =
        new window.kakao.maps
          .Polyline({
            map: state.map,

            path:
              data.route.map(
                positionOf
              ),

            strokeWeight: 5,

            strokeColor:
              '#ff2f6e',

            strokeOpacity: 0.86,

            strokeStyle:
              'solid',
          });
    }


    data.markers.forEach(
      item => {
        const visited =
          Boolean(
            item.meta?.visited
          );

        const sequence =
          item.sequence;

        const kind =
          item.kind;

        const stopType =
          String(
            item.meta?.type || ''
          ).toLowerCase();

        const isRouteStop =
          [
            'pickup',
            'dropoff',
            'delivery',
          ].includes(stopType);

        let content =
          document.createElement(
            'div'
          );


        /*
        * 1. 라이더 현재 위치
        *
        * 기존에는 sequence=0이어서
        * 핑크 원 안에 0이 표시됐습니다.
        *
        * 이제 라이더 SVG 아이콘으로 표시합니다.
        */
        if (kind === 'rider') {
          content.innerHTML =
            riderMarkerSvg();

          content.style.cssText = `
            width: 38px;
            height: 38px;

            display: flex;
            align-items: center;
            justify-content: center;

            border-radius: 50%;

            background: #ff2f6e;
            color: #ffffff;

            border: 3px solid #ffffff;

            box-shadow:
              0 4px 12px
              rgba(255, 47, 110, 0.34);

            box-sizing: border-box;
          `;
        }


/*
 * 2. 라이더 경로의 픽업 / 배달 위치
 *
 * 고객 지도와 동일한 매장·집 마커를 사용합니다.
 * 방문 순서 데이터는 유지하되 지도 마커에는 숫자를 표시하지 않습니다.
 */
else if (
  isRouteStop &&
  (
    kind === 'store' ||
    kind === 'delivery'
  )
) {
  content =
    createCustomerPlaceMarker(
      kind
    );

  /*
   * 방문 완료 지점은 아이콘 형태를 유지하면서
   * 회색으로 표시합니다.
   */
  if (visited) {
    content.style.filter =
      'grayscale(1)';

    content.style.opacity =
      '0.6';
  }
}


        /*
        * 3. 고객 지도용 매장 / 집
        *
        * 아까 수정한 고객용 SVG 마커는
        * 그대로 유지합니다.
        */
        else if (
          kind === 'store' ||
          kind === 'delivery'
        ) {
          content =
            createCustomerPlaceMarker(
              kind
            );
        }


        /*
        * 4. 혹시 모를 기타 마커
        */
        else {
          content.textContent =
            sequence != null
              ? String(sequence)
              : '';

          content.style.cssText = `
            width: 28px;
            height: 28px;

            display: flex;
            align-items: center;
            justify-content: center;

            border-radius: 50%;

            background:
              ${visited
                ? '#999999'
                : '#ff2f6e'};

            color: #ffffff;

            font-size: 14px;
            font-weight: 800;

            border: 2px solid #ffffff;

            box-shadow:
              0 2px 4px
              rgba(0, 0, 0, 0.3);

            box-sizing: border-box;
          `;
        }


        const marker =
          new window.kakao.maps
            .CustomOverlay({
              map: state.map,

              position:
                positionOf(item),

              content,

              zIndex:
                kind === 'rider'
                  ? 3
                  : 2,
            });
        if (kind === 'rider') {
          state.riderMarker =
            marker;

          state.riderPoint = {
            lat: Number(item.lat),
            lng: Number(item.lng),
          };
        }

        state.markers.push(
          marker
        );
      }
    );

    window.requestAnimationFrame(
      () => {
        state.map.relayout();

        fitMapOnce(
          state,
          data
        );
      }
    );

    return true;
  };

  const animateRiderMarker = (
    containerId,
    target,
    durationMs = 900
  ) => {
    const root =
      document.getElementById(
        containerId
      );

    const state =
      root
        ? mapStates.get(root)
        : null;

    const marker =
      state?.riderMarker;

    const from =
      state?.riderPoint;


    const targetLat =
      Number(target?.lat);

    const targetLng =
      Number(target?.lng);


    if (
      !marker ||
      !from ||
      !Number.isFinite(targetLat) ||
      !Number.isFinite(targetLng)
    ) {
      return Promise.resolve(
        false
      );
    }


    return new Promise(resolve => {
      const startTime =
        performance.now();


      /*
      * 처음에는 빠르게,
      * 도착할수록 부드럽게 감속
      */
      const easeOut =
        value =>
          1 -
          Math.pow(
            1 - value,
            3
          );


      const animate = now => {
        const elapsed =
          now - startTime;

        const progress =
          Math.min(
            elapsed /
              durationMs,
            1
          );

        const eased =
          easeOut(progress);


        const lat =
          from.lat +
          (
            targetLat -
            from.lat
          ) *
          eased;

        const lng =
          from.lng +
          (
            targetLng -
            from.lng
          ) *
          eased;


        marker.setPosition(
          new window.kakao.maps
            .LatLng(
              lat,
              lng
            )
        );


        state.riderPoint = {
          lat,
          lng,
        };


        if (progress < 1) {
          window.requestAnimationFrame(
            animate
          );

          return;
        }


        state.riderPoint = {
          lat: targetLat,
          lng: targetLng,
        };

        resolve(true);
      };


      window.requestAnimationFrame(
        animate
      );
    });
  };


  const reverseGeocode = (
    lat,
    lng
  ) => {
    if (
      !enabled ||
      !window.kakao
        ?.maps
        ?.services
        ?.Geocoder ||
      !Number.isFinite(
        Number(lat)
      ) ||
      !Number.isFinite(
        Number(lng)
      )
    ) {
      return Promise.resolve(
        null
      );
    }

    const cacheKey =
      `${Number(lat).toFixed(
        4
      )},${Number(lng).toFixed(
        4
      )}`;

    if (
      geocodeCache.has(
        cacheKey
      )
    ) {
      return geocodeCache.get(
        cacheKey
      );
    }

    const request =
      new Promise(resolve => {
        const geocoder =
          new window.kakao.maps
            .services.Geocoder();

        geocoder.coord2Address(
          Number(lng),
          Number(lat),

          (
            results,
            status
          ) => {
            if (
              status !==
                window.kakao.maps
                  .services
                  .Status.OK ||
              !results?.[0]
            ) {
              resolve(null);
              return;
            }

            const result =
              results[0];

            resolve(
              result
                .road_address
                ?.address_name ||
              result
                .address
                ?.address_name ||
              null
            );
          }
        );
      });

    geocodeCache.set(
      cacheKey,
      request
    );

    return request;
  };


  const configureKakaoMap =
    async () => {
      const appKey =
        String(
          window
            .__YGY_CONFIG__
            ?.kakaoMapJsKey ||
            ''
        ).trim();

      if (!appKey) {
        enabled = false;
        return false;
      }

      try {
        await loadSdk(
          appKey
        );

        enabled = true;

        return true;
      } catch (error) {
        enabled = false;

        console.warn(
          '카카오맵을 사용할 수 없어 SVG 지도를 유지합니다.',
          error
        );

        return false;
      }
    };


  Object.assign(
    window.Yogiyo,
    {
      animateRiderMarker,
      configureKakaoMap,
      renderKakaoMap,
      reverseGeocode,
    }
  );
})();