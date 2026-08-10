from enum import Enum

# ========== Order / 클러스터링 관련 ==========

class UrgencyLevel(Enum):
    CRITICAL = "critical"
    URGENT = "urgent"
    MODERATE = "moderate"
    FLEXIBLE = "flexible"

FOOD_CATEGORY_URGENCY = {
    # ── CRITICAL: 온도 손실이 곧바로 품질 저하로 직결 ──
    "국물류": UrgencyLevel.CRITICAL,
    "찌개류": UrgencyLevel.CRITICAL,
    "전골류": UrgencyLevel.CRITICAL,
    "탕류": UrgencyLevel.CRITICAL,

    # ── URGENT: 식감/온도 민감, 30분 내외로 품질 급락 ──
    "튀김류": UrgencyLevel.URGENT,
    "면류": UrgencyLevel.URGENT,
    "볶음류": UrgencyLevel.URGENT,
    "구이류": UrgencyLevel.URGENT,
    "피자": UrgencyLevel.URGENT,
    "버거류": UrgencyLevel.URGENT,
    "음료_HOT": UrgencyLevel.URGENT,

    # ── MODERATE: 어느 정도 버티지만 신경 필요 ──
    "밥류": UrgencyLevel.MODERATE,
    "죽류": UrgencyLevel.MODERATE,
    "찜류": UrgencyLevel.MODERATE,
    "초밥_회류": UrgencyLevel.MODERATE,
    "도시락": UrgencyLevel.MODERATE,
    "샐러드": UrgencyLevel.MODERATE,
    "샌드위치": UrgencyLevel.MODERATE,
    "분식_일반": UrgencyLevel.MODERATE,
    "음료_아이스": UrgencyLevel.MODERATE,
    "디저트_냉장류": UrgencyLevel.MODERATE,

    # ── FLEXIBLE: 상온에서도 품질 유지 ──
    "완제품": UrgencyLevel.FLEXIBLE,
    "음료_상온": UrgencyLevel.FLEXIBLE,
    "디저트_구움과자": UrgencyLevel.FLEXIBLE,
    "베이커리_상온빵": UrgencyLevel.FLEXIBLE,
    "한과_떡류": UrgencyLevel.FLEXIBLE,
    "반찬류": UrgencyLevel.FLEXIBLE,
}

# 클러스터 최대 크기
MAX_CLUSTER_SIZE = 3

# 이동속도 (기획서 완전탐색 알고리즘과 동일 기준 사용)
AVG_SPEED_KMH = 20

# 긴급도가 다른 주문끼리 묶일 때의 페널티 (km 환산 기준, 초기 추정값)
URGENCY_MISMATCH_PENALTY_KM = 1.0  # ⚠️ 임의값, 추후 튜닝 필요

# 클러스터 확정 기준 — 평균 score가 이 값을 넘으면 억지 조합으로 판단해 낱개 처리
MAX_ACCEPTABLE_SCORE = 15  # ⚠️ 임의값, 추후 튜닝 필요

# 주문이 짝을 못 찾았을 때, 조리시간이 이 값(분) 이하로 남으면 더 못 기다리고 한집배달 확정
ORDER_WAIT_BUFFER_MINUTES = 5  # ⚠️ 임의값, 추후 튜닝 필요


# ========== Rider / Redis Geo 관련 ==========

# 요기요 실제 라이더 규모(전문 라이더 약 2,700명, 2023년 기준)를 참고해,
# 이 8개 핵심 상권에서 활동하는 라이더 수를 RIDER_COUNT로 가정
# (전체 서울 라이더 수가 아니라, 이 프로토타입이 다루는 권역 한정 추정치)
RIDER_COUNT = 500

# 서울 8개 주요 권역(강남/역삼/신림/노원/잠실/홍대/성수/이태원) 좌표
# radius_km는 Redis Geo 검색 시 기본 반경(km)
SERVICE_REGIONS = {
    "강남": {"lat": 37.4980, "lng": 127.0280, "radius_km": 3},
    "역삼": {"lat": 37.5000, "lng": 127.0360, "radius_km": 3},
    "신림": {"lat": 37.4840, "lng": 126.9300, "radius_km": 3},
    "노원": {"lat": 37.6550, "lng": 127.0610, "radius_km": 3},
    "잠실": {"lat": 37.5130, "lng": 127.1000, "radius_km": 3},
    "홍대": {"lat": 37.5560, "lng": 126.9235, "radius_km": 3},
    "성수": {"lat": 37.5445, "lng": 127.0560, "radius_km": 3},
    "이태원": {"lat": 37.5345, "lng": 126.9945, "radius_km": 3},
}

# 지역별 라이더 밀도 가중치 (수요/유동인구가 많은 곳에 라이더가 더 많이 분포한다고 가정)
REGION_RIDER_WEIGHTS = {
    "강남": 3,
    "역삼": 2,
    "신림": 1.5,
    "노원": 1,
    "잠실": 2,
    "홍대": 3,
    "성수": 1.5,
    "이태원": 2,
}

RIDER_NAME_PREFIXES = [
    "번개", "질주", "칼배달", "무사고", "야간", "터줏대감", "국룰", "전국구",
    "새벽", "폭풍", "요기요", "총알", "레이싱", "속도광", "정시배달", "완주",
    "역주행금지", "코너링", "질풍", "폭주", "칼퇴근", "골목대장", "지도앱무시",
    "논스톱", "직진만", "네비능가", "핫도그보다빠른", "라면보다빨리", "치타본능",
    "우천에도출동", "폭염뚫는", "한파도이긴다", "언제나칼같은", "믿고맡기는",
    "동네지리박사", "1초의차이", "타이밍장인", "골든타임사수", "적토마후예",
    "안전제일", "예측불허",
]
RIDER_NAME_SUFFIXES = [
    "킹", "장인", "본능", "명인", "라이더", "형", "언니", "대리",
    "요정", "달인", "마스터", "전문가", "고수", "선수",
    "부장", "실장", "히어로", "레전드", "챔피언", "머신", "본좌",
    "대장", "장수", "명장", "신", "왕", "전설", "타짜", "귀재",
    "닌자",
]

# 라이더 위치 갱신 설정 (Redis Geo 시뮬레이션)
RIDER_LOCATION_UPDATE_INTERVAL_SECONDS = 5

# 갱신 주기 동안 이동 가능한 거리를, 평균속도(AVG_SPEED_KMH) 기준으로 위도 단위로 환산
# 예: 20km/h → 초당 약 5.56m, 5초마다 약 27.8m 이동
# 위도 1도 ≈ 111km이므로 미터를 111,000으로 나누면 위도 단위 이동량이 됨
RIDER_MOVE_RANGE_DEGREES = (AVG_SPEED_KMH * 1000 / 3600) * RIDER_LOCATION_UPDATE_INTERVAL_SECONDS / 111000

# Redis Geo 저장 키 이름
RIDER_GEO_KEY = 'riders:locations'