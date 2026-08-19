import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';


const read = path =>
  readFileSync(
    new URL(
      path,
      import.meta.url
    ),
    'utf8'
  );


test(
  '프런트 API 클라이언트는 최종 시연 API만 제공한다',
  () => {
    const client =
      read(
        '../static/backend-client.js'
      );

    const requiredPaths = [
      '/api/demo/reset',

      '/api/demo/customer/order',

      '/api/demo/merchant/next-to-cook',
      '/api/demo/merchant/cook-start',

      '/api/demo/rider/offers',
      '/api/demo/merchant/cook-complete',
      '/api/demo/rider/profile',

      '/api/demo/rider/package/${encodeURIComponent(packageId)}/accept',

      '/api/demo/rider/next-stop',
      '/api/demo/rider/arrive',

      '/api/demo/stores',
    ];


    for (
      const path of requiredPaths
    ) {
      assert.match(
        client,

        new RegExp(
          path.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
          )
        )
      );
    }


    for (
      const forbidden of [
        '/api/demo/merchant/orders',
        '/api/demo/rider/packages',
      ]
    ) {
      assert.doesNotMatch(
        client,
        new RegExp(
          forbidden.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
          )
        )
      );
    }


    assert.doesNotMatch(
      client,
      /rejectMerchantOrder/
    );

    assert.doesNotMatch(
      client,
      /completeMerchantOrder/
    );

    assert.doesNotMatch(
      client,
      /riderPackages/
    );
  }
);


test(
  '고객 화면은 최종 시연 주문과 라이더 위치 API만 사용한다',
  () => {
    const source =
      read(
        '../static/customer/app.js'
      );

    const html =
      read(
        '../static/customer/index.html'
      );


    assert.match(
      source,
      /apiClient\.demo\.customerOrder\(\)/
    );

    assert.match(
      source,
      /apiClient\.demo\.riderProfile\(\)/
    );

    assert.match(
      source,
      /시연 주문 API · 5초 갱신/
    );

    assert.match(
      source,
      /delivery_address/
    );

    assert.match(
      source,
      /배차 수락 대기/
    );

    assert.match(
      source,
      /consumer_text/
    );

    assert.match(
      source,
      /fromRouteDetail/
    );

    assert.match(
      source,
      /fromCustomerOrder/
    );


    assert.doesNotMatch(
      source,
      /futureSlot/i
    );

    assert.doesNotMatch(
      source,
      /createOrderButton/
    );

    assert.doesNotMatch(
      source,
      /주문 취소/
    );

    assert.doesNotMatch(
      html,
      /Future Slot/
    );

    assert.doesNotMatch(
      html,
      /주문 취소/
    );

    assert.doesNotMatch(
      source,
      /apiClient\.(customers|merchants|riders|packages|explanations)/
    );

    assert.doesNotMatch(
      source,
      /reverseGeocode/
    );
  }
);


test(
  '사장님 화면은 조리 시작 및 조리 완료 API 흐름을 처리한다',
  () => {
    const source =
      read(
        '../static/merchant/app.js'
      );


    for (
      const method of [
        'merchantOrders',
        'merchantCookStart',
        'merchantCookComplete',
      ]
    ) {
      assert.match(
        source,

        new RegExp(
          `apiClient\\.demo\\.${method}`
        )
      );
    }


    assert.match(
      source,
      /수락하고 조리 시작/
    );

    assert.match(
      source,
      /apiClient\.demo\.stores\(\)/
    );

    assert.match(
      source,
      /merchant_text/
    );


    assert.doesNotMatch(
      source,
      /rejectMerchantOrder/
    );

    assert.doesNotMatch(
      source,
      /completeMerchantOrder/
    );

    assert.doesNotMatch(
      source,
      /data-order-reject/
    );

    assert.doesNotMatch(
      source,
      /data-order-complete/
    );

    assert.doesNotMatch(
      source,
      /demoTrigger|updateCookTime|apiClient\.merchants/
    );
  }
);


test(
  '라이더 화면은 offer → accept → next-stop → arrive 흐름만 사용한다',
  () => {
    const source =
      read(
        '../static/rider/app.js'
      );


    for (
      const method of [
        'riderProfile',
        'riderOffers',
        'acceptPackage',
        'riderNextStop',
        'riderArrive',
      ]
    ) {
      assert.match(
        source,

        new RegExp(
          `apiClient\\.demo\\.${method}`
        )
      );
    }


    assert.doesNotMatch(
      source,
      /apiClient\.demo\.riderPackages/
    );

    assert.doesNotMatch(
      source,
      /riderPackages/
    );

    assert.doesNotMatch(
      source,
      /declinedPackageIds/
    );

    assert.doesNotMatch(
      source,
      /score_detail/
    );

    assert.doesNotMatch(
      source,
      /futureSlot/i
    );


    assert.match(
      source,
      /data-rider-arrive/
    );

    assert.match(
      source,
      /completeCurrentStop/
    );

    assert.match(
      source,
      /픽업 완료/
    );

    assert.match(
      source,
      /배달 완료/
    );

    assert.match(
      source,
      /profile\.status === 'BUSY'/
    );

    assert.match(
      source,
      /rider_text/
    );

    assert.match(
      source,
      /fromRouteDetail/
    );

    assert.match(
      source,
      /riderMapData/
    );

    assert.match(
      source,
      /sessionStorage/
    );


    assert.doesNotMatch(
      source,
      /apiClient\.demo\.(pickupPackage|completePackage)/
    );

    assert.doesNotMatch(
      source,
      /apiClient\.(customers|merchants|riders|packages|explanations)/
    );
  }
);


test(
  '통합 시연은 시작 시 최종 reset API를 호출한다',
  () => {
    const source =
      read(
        '../static/demo/app.js'
      );


    assert.match(
      source,
      /apiClient\.demo\.reset\(\)/
    );

    assert.match(
      source,
      /DEMO_RESET/
    );

    assert.match(
      source,
      /90001/
    );

    assert.match(
      source,
      /80001/
    );

    assert.match(
      source,
      /rider_12/
    );


    assert.doesNotMatch(
      source,
      /884/
    );

    assert.doesNotMatch(
      source,
      /rider_2/
    );

    assert.doesNotMatch(
      source,
      /apiClient\.(customers|merchants|riders)/
    );
  }
);


test(
  '지도 데이터 계층은 레거시 API를 직접 호출하지 않는다',
  () => {
    const source =
      read(
        '../static/map-data.js'
      );


    assert.match(
      source,
      /fromCustomerOrder/
    );

    assert.match(
      source,
      /fromRouteDetail/
    );

    assert.match(
      source,
      /fromRiderProfile/
    );


    assert.doesNotMatch(
      source,
      /apiClient\./
    );

    assert.doesNotMatch(
      source,
      /pollRider/
    );
  }
);


test(
  '카카오맵 렌더러는 SDK 실패 시 SVG fallback을 허용한다',
  () => {
    const source =
      read(
        '../static/kakao-map.js'
      );


    assert.match(
      source,
      /dapi\.kakao\.com\/v2\/maps\/sdk\.js/
    );

    assert.match(
      source,
      /autoload=false/
    );

    assert.match(
      source,
      /libraries=services/
    );

    assert.match(
      source,
      /configureKakaoMap/
    );

    assert.match(
      source,
      /renderKakaoMap/
    );

    assert.match(
      source,
      /return false/
    );

    assert.match(
      source,
      /kakao-map-layer/
    );
  }
);


test(
  '세 역할 화면의 LLM 안내는 전용 파란색 토큰을 사용한다',
  () => {
    const styles =
      read(
        '../static/common.css'
      );


    assert.match(
      styles,
      /--info: #61616b/
    );

    assert.match(
      styles,
      /--llm: #3f6fe5/
    );

    assert.match(
      styles,
      /\.llm-guidance \{ background:var\(--llm-soft\); color:var\(--llm\)/
    );

    assert.match(
      styles,
      /\.offer-ai-guidance \{ grid-column:1 \/ -1; width:100%/
    );
  }
);