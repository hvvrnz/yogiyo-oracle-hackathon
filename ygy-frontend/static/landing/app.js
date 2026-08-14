function setLandingContent(id, value) {
  Yogiyo.el(id).textContent = value;
}

function setLandingMarkup(id, value) {
  Yogiyo.el(id).innerHTML = value;
}

if (!Yogiyo.useMock) {
  setLandingContent('landingKicker', '요기요 X 오라클 해커톤 · 실시간 연동 시연');
  setLandingContent('landingDescription', '고객 주문 조회·취소, 사장님 조리시간 변경, 라이더 패키지 운행 처리를 실제 API로 제공합니다.');
  setLandingMarkup('landingChips', '<span class="chip">Oracle DB 연동</span><span class="chip">실제 테스트 ID</span><span class="chip">5초 위치 폴링</span><span class="chip">좌표 기반 임시 지도</span>');
  setLandingContent('landingDataTitle', '연동 데이터 구성');
  setLandingMarkup('landingDataLines', '<div class="data-line"><strong>Oracle DB</strong><span>실제 주문·패키지·라이더 데이터</span></div><div class="data-line"><strong>Redis</strong><span>라이더 현재 위치를 5초 주기로 갱신</span></div><div class="data-line"><strong>좌표 데이터 계층</strong><span>카카오맵 교체 전 SVG 임시 렌더러에 연결</span></div><div class="data-line"><strong>FastAPI</strong><span>역할별 조회와 상태 변경 API를 제공</span></div>');
  setLandingContent('landingArchitectureTitle', '하나의 서버, 세 역할, 하나의 상태');
  setLandingMarkup('landingFlow', '<div class="flow-node"><strong>고객·사장님·라이더</strong>실제 테스트 ID로 REST 조회</div><div class="arrow">→</div><div class="flow-node"><strong>FastAPI</strong>주문·조리시간·패키지 상태 변경</div><div class="arrow">→</div><div class="flow-node"><strong>Redis / Oracle</strong>위치·영구 데이터 저장</div>');
  setLandingContent('landingFoot', '실제 API 데이터 계층을 유지한 채 카카오맵과 LLM 기능을 추가할 수 있도록 구성했습니다.');
}
