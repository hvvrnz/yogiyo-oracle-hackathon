const mockMode = Yogiyo.useMock;
const controlRoot = document.querySelector('.control-groups');
if (controlRoot) {
  controlRoot.innerHTML = mockMode
    ? '<section class="control-subpanel"><h3>개발용 목업 모드</h3><p style="color:#b7b7c1;font-size:11px;margin:0;line-height:1.6">브라우저에 저장된 목업 주문·매장·라이더 데이터를 사용합니다. 고객 취소, 사장님 조리시간 변경, 라이더 패키지 처리도 실제 화면과 같은 API 인터페이스로 동작합니다.</p></section>'
    : '<section class="control-subpanel"><h3>실제 서버 조회 모드</h3><p style="color:#b7b7c1;font-size:11px;margin:0;line-height:1.6">실제 Oracle DB의 주문 1~3, 주문이 있는 매장 892, 배정 라이더 rider_102·103·105를 표시합니다. 데이터 생성·초기화·가상 시나리오는 실행하지 않습니다.</p></section>';
}
Yogiyo.el('demoModeDescription').textContent = mockMode
  ? '개발용 목업 모드입니다. 화면별 상태 변경은 브라우저 목업 데이터에만 반영됩니다.'
  : '실제 Oracle DB 조회 모드입니다. 각 패널은 현재 데이터 상태를 독립적으로 5초마다 갱신합니다.';
Yogiyo.el('backendDocsLink').hidden = mockMode;
Yogiyo.el('connectionText').textContent = mockMode ? '개발용 목업 데이터' : '실제 REST 조회 모드';
Yogiyo.el('summaryStatus').textContent = mockMode ? '목업 데이터' : '읽기 전용';
Yogiyo.el('summaryOrders').textContent = '주문 1 · 2 · 3';
Yogiyo.el('summaryDuration').textContent = '5초 폴링';
Yogiyo.el('summaryStrategy').textContent = mockMode ? '브라우저 저장소' : '역할별 독립 조회';
Yogiyo.el('summaryRevenue').textContent = '매장 892';
Yogiyo.el('summaryRider').textContent = 'rider_102 · 103 · 105';
Yogiyo.el('summaryVersion').textContent = mockMode ? 'VITE_USE_MOCK=true' : '실제 API';
Yogiyo.el('eventList').innerHTML = mockMode
  ? '<div class="event"><code>MOCK_MODE</code><span>백엔드 없이 개발용 목업 데이터로 화면 흐름을 확인하고 있습니다.</span><time>LOCAL</time></div>'
  : '<div class="event"><code>REAL_DATA_MODE</code><span>목업 시나리오 제어는 실제 데이터 모드에서 비활성화되어 있습니다.</span><time>REST</time></div>';
