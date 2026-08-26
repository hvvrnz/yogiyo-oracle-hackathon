import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const mapDataSource = readFileSync(
  new URL('../static/map-data.js', import.meta.url),
  'utf8'
);

const kakaoMapSource = readFileSync(
  new URL('../static/kakao-map.js', import.meta.url),
  'utf8'
);

const riderSource = readFileSync(
  new URL('../static/rider/app.js', import.meta.url),
  'utf8'
);

const commonCssSource = readFileSync(
  new URL('../static/common.css', import.meta.url),
  'utf8'
);

test('조리 완료 주문은 해당 픽업 마커에 완료 상태를 전달한다', () => {
  const context = {
    window: {
      Yogiyo: {}
    }
  };

  vm.runInNewContext(
    mapDataSource,
    context
  );

  const map =
    context.window.Yogiyo.mapData
      .fromRouteDetail(
        [
          {
            order_id: 101,
            type: 'pickup',
            lat: 37.5,
            lng: 127.0,
            sequence: 1
          },
          {
            order_id: 101,
            type: 'delivery',
            lat: 37.51,
            lng: 127.01,
            sequence: 2
          }
        ],
        [],
        ['101']
      );

  assert.equal(
    map.markers[0].meta.cookCompleted,
    true
  );
  assert.equal(
    map.markers[1].meta.cookCompleted,
    false
  );
});

test('카카오 매장 마커는 조리 완료 시 연두색 배경을 사용한다', () => {
  const markerStart =
    kakaoMapSource.indexOf(
      'const createCustomerPlaceMarker'
    );
  const markerEnd =
    kakaoMapSource.indexOf(
      '\nconst riderMarkerSvg',
      markerStart
    );
  const markerSource =
    kakaoMapSource.slice(
      markerStart,
      markerEnd
    );

  assert.match(
    markerSource,
    /isCookCompleted/
  );
  assert.match(
    markerSource,
    /var\(--cook-complete\)/
  );
  assert.match(
    commonCssSource,
    /--cook-complete:\s*#d9f99d/
  );
  assert.match(
    kakaoMapSource,
    /item\.meta\s*\?\.cookCompleted/
  );
});

test('조리 완료 상태가 바뀌면 라이더 지도를 다시 렌더링한다', () => {
  const refreshStart =
    riderSource.indexOf(
      'async function refreshActivePackageCookStatus()'
    );
  const refreshEnd =
    riderSource.indexOf(
      '\nfunction renderCookTimeGrid',
      refreshStart
    );
  const refreshSource =
    riderSource.slice(
      refreshStart,
      refreshEnd
    );

  const tickerStart =
    riderSource.indexOf(
      'stopCookTimeTicker ='
    );
  const tickerEnd =
    riderSource.indexOf(
      "\nwindow.addEventListener(\n  'beforeunload'",
      tickerStart
    );
  const tickerSource =
    riderSource.slice(
      tickerStart,
      tickerEnd
    );

  assert.match(
    refreshSource,
    /riderPackages/
  );
  assert.match(
    tickerSource,
    /refreshActivePackageCookStatus/
  );
  assert.match(
    tickerSource,
    /cookCompletionSignature/
  );
  assert.match(
    tickerSource,
    /Yogiyo\.renderMap\(/
  );
});
