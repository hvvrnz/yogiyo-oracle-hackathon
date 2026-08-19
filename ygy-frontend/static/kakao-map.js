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


  const fitMapOnce = (
    state,
    data
  ) => {
    const signature =
      routeSignature(
        data.route
      );

    if (
      state.hasFitted &&
      state.routeSignature ===
        signature
    ) {
      return;
    }

    const points = [
      ...data.route,
      ...data.markers,
    ];

    if (!points.length) {
      return;
    }

    if (points.length === 1) {
      state.map.setCenter(
        positionOf(points[0])
      );

      state.map.setLevel(4);
    } else {
      const bounds =
        new window.kakao.maps
          .LatLngBounds();

      points.forEach(
        point =>
          bounds.extend(
            positionOf(point)
          )
      );

      state.map.setBounds(
        bounds,
        32,
        32,
        32,
        32
      );
    }

    state.hasFitted = true;
    state.routeSignature =
      signature;
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
        const visited = item.meta?.visited;
        const sequence = item.sequence;
        const kind = item.kind;

        const content = document.createElement('div');

        const isRouteStop = Boolean(item.meta?.type);

    if (isRouteStop && (kind === 'store' || kind === 'delivery')) {
      const activeColor = kind === 'store' ? '#ff9800' : '#2196f3';

      content.textContent = sequence != null ? String(sequence) : '';
      content.style.cssText = `
        width:32px; height:32px; border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        background:${visited ? '#999999' : activeColor};
        color:white; font-size:14px; font-weight:800;
        border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3);
      `;
    } else if (kind === 'store') {
      content.innerHTML = '🏪';
      content.style.cssText = `
        width:32px; height:32px; border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        background:#ff9800; font-size:18px;
        border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3);
      `;
    } else if (kind === 'delivery') {
      content.innerHTML = '🏠';
      content.style.cssText = `
        width:32px; height:32px; border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        background:#2196f3; font-size:18px;
        border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3);
      `;
    } else {

          // 그 외(라이더 배차 경로 등) - 기존 순서 숫자 원
          content.textContent = sequence != null ? String(sequence) : '';
          content.style.cssText = `
            width: 28px; height: 28px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            background: ${visited ? '#999999' : '#ff2f6e'};
            color: white; font-weight: bold; font-size: 14px;
            border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          `;
        }

        const marker =
          new window.kakao.maps
            .CustomOverlay({
              map: state.map,
              position:
                positionOf(
                  item
                ),
              content: content,
              zIndex:
                item.kind ===
                'rider'
                  ? 3
                  : 2,
            });
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
      configureKakaoMap,
      renderKakaoMap,
      reverseGeocode,
    }
  );
})();