function setLandingContent(id, value) {
  Yogiyo.el(id).textContent = value;
}

function setLandingMarkup(id, value) {
  Yogiyo.el(id).innerHTML = value;
}

if (!Yogiyo.useMock) {
  setLandingContent('landingKicker', 'Yogiyo X Oracle 해커톤 · 7조 낭만젊음사랑');
  setLandingContent('landingDescription', '조리시간이 긴 주문일수록 배차가 어려워지는 문제, 완전탐색 기반 배차 알고리즘과 \n Oracle Generative AI의 조리시간 예측으로 함께 해결힙니다.');
  setLandingMarkup('landingChips', '<span class="chip">완전탐색 배차</span><span class="chip">Oracle Generative AI</span><span class="chip">Vector Search</span><span class="chip">5초 실시간 폴링</span><span class="chip">카카오맵 연동</span>');
  setLandingContent('landingDataTitle', '시스템 구성');
  setLandingMarkup('landingDataLines', '<div class="data-line"><strong>Oracle DB (Vector Search)</strong><span>Cohere Embedding 기반 조리시간 예측 데이터</span></div><div class="data-line"><strong>Sequencing Engine</strong><span>완전탐색 기반 픽업·배달 순서 계산</span></div><div class="data-line"><strong>FastAPI</strong><span>역할별 조회와 상태 변경 API를 제공</span></div><div class="data-line"><strong>카카오맵</strong><span>실시간 라이더 위치 및 배달 경로 시각화</span></div>');
  setLandingContent('landingArchitectureTitle', '예측과 계산이 만드는 만족스러운 배달');
  setLandingMarkup('landingFlow', '<div class="flow-node"><strong>고객·사장님·라이더</strong>역할별 REST API로 조회</div><div class="arrow">→</div><div class="flow-node"><strong>FastAPI</strong>조리시간·배차 <br/> 픽업/배달 상태 관리</div><div class="arrow">→</div><div class="flow-node"><strong>Oracle DB (Vector Search)</strong>조리시간 예측을 위한 실제 임베딩 데이터 저장·검색</div>');
  setLandingContent('landingFoot', 'Oracle Generative AI로 생성한 실제 벡터 데이터를 기반으로 신규 매장의 조리시간을 예측하고, 배차 알고리즘과 연동하는 구조로 구성했습니다.');
}