function setLandingContent(id, value) {
  Yogiyo.el(id).textContent = value;
}

function setLandingMarkup(id, value) {
  Yogiyo.el(id).innerHTML = value;
}

if (!Yogiyo.useMock) {
  setLandingContent('landingKicker', '요기요 X 오라클 해커톤 · 실시간 연동 시연');
  setLandingContent('landingDescription', '고객에게는 도착시간과 묶음 이유를, 사장님에게는 조리 완료 목표와 라이더 도착시각을, 라이더에게는 효율적인 수익과 이동 순서를 실시간으로 제공합니다.');
  setLandingMarkup('landingChips', '<span class="chip">최대 3건 배칭</span><span class="chip">90개 유효 경로 비교</span><span class="chip">품질·ETA 가드레일</span><span class="chip">실시간 WebSocket</span><span class="chip">2가지 경로 전략</span><span class="chip">SVG 경로 지도</span>');
  setLandingContent('landingDataTitle', '연동 데이터 구성');
  setLandingMarkup('landingDataLines', '<div class="data-line"><strong>공공데이터포털</strong><span>음식점명·업종·주소·위경도</span></div><div class="data-line"><strong>카카오모빌리티</strong><span>도로 거리·예상 시간·경로 좌표 연동</span></div><div class="data-line"><strong>시연용 경로 지도</strong><span>개인정보를 노출하지 않는 SVG 경로·상태 표현</span></div><div class="data-line"><strong>기상청</strong><span>실시간 날씨 및 이동 지연 보정 연동</span></div><div class="data-line"><strong>FastAPI 데이터 계약</strong><span>주문·조리·배차·라이더 상태를 역할별 화면에 전달</span></div>');
  setLandingContent('landingArchitectureTitle', '하나의 서버, 세 역할, 하나의 상태');
  setLandingMarkup('landingFlow', '<div class="flow-node"><strong>고객·사장님·라이더</strong>REST + WebSocket</div><div class="arrow">→</div><div class="flow-node"><strong>FastAPI</strong>인증·명령·상태 전달</div><div class="arrow">→</div><div class="flow-node"><strong>Redis / Kafka / Oracle</strong>실서비스 교체 경계</div>');
  setLandingContent('landingFoot', '같은 데이터 계약을 유지한 채 실제 OCI·카카오·기상청 서비스로 연동하도록 설계했습니다.');
}
