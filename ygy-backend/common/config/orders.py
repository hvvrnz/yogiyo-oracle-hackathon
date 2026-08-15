from enum import Enum

# ========== 배달 긴급도 ==========

class UrgencyLevel(Enum):
    CRITICAL = "critical"
    URGENT = "urgent"
    MODERATE = "moderate"
    FLEXIBLE = "flexible"

FOOD_CATEGORY_URGENCY = {
    "국물류": UrgencyLevel.CRITICAL,
    "찌개류": UrgencyLevel.CRITICAL,
    "전골류": UrgencyLevel.CRITICAL,
    "탕류": UrgencyLevel.CRITICAL,
    "튀김류": UrgencyLevel.URGENT,
    "면류": UrgencyLevel.URGENT,
    "볶음류": UrgencyLevel.URGENT,
    "구이류": UrgencyLevel.URGENT,
    "피자": UrgencyLevel.URGENT,
    "버거류": UrgencyLevel.URGENT,
    "음료_HOT": UrgencyLevel.URGENT,
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
    "완제품": UrgencyLevel.FLEXIBLE,
    "음료_상온": UrgencyLevel.FLEXIBLE,
    "디저트_구움과자": UrgencyLevel.FLEXIBLE,
    "베이커리_상온빵": UrgencyLevel.FLEXIBLE,
    "한과_떡류": UrgencyLevel.FLEXIBLE,
    "반찬류": UrgencyLevel.FLEXIBLE,
}

STORE_MENU_COUNT_RANGE = (3, 6) 

URGENCY_MISMATCH_PENALTY_KM = 1.0  # ⚠️ 임의값, 추후 튜닝 필요

# ========== 클러스터링 ==========

MAX_CLUSTER_SIZE = 3
# 클러스터링(1단계) 확정 기준 단위: km (거리+시간환산 합산)
MAX_ACCEPTABLE_SCORE = 15  # ⚠️ 임의값, 추후 튜닝 필요
ORDER_WAIT_BUFFER_MINUTES = 10  # ⚠️ 임의값, 추후 튜닝 필요  5분에서 10분으로 조정 (배차 확정에 필요한 시간 고려)

# ========== 매장 더미 생성 ==========

STORE_COUNT = 1000

STORE_NAME_PREFIXES = [
    "요기요", "맛있는", "든든한", "정통", "원조", "청년", "풍미",
    "정성가득", "장인", "미슐랭", "프리미엄", "쉐프의", "수제", "전통", "핫한", "인기",
]


DELIVERY_FEE_BASE = 3000  # 소비자가 내는 배달비 기본값, ⚠️ 임의값

DEMO_STORE_IDS = [889, 894, 884]  # 강남889, 강남894, 홍대884
DEMO_STORE_PROBABILITY = 0.08  # 이 확률로 시연용 매장 중 하나가 뽑힘

CATEGORY_COOK_TIME_RANGE = {
    "튀김류": (15, 30), "찜류": (40, 70), "국물류": (15, 25), "초밥_회류": (5, 15),
    "완제품": (5, 10), "버거류": (10, 20), "피자": (20, 35), "음료_아이스": (5, 10),
    "탕류": (15, 30), "찌개류": (10, 20), "디저트_구움과자": (5, 15), "분식_일반": (10, 20),
    "죽류": (10, 20), "도시락": (5, 15), "샌드위치": (5, 10), "디저트_냉장류": (5, 10),
    "샐러드": (5, 15), "구이류": (20, 40), "베이커리_상온빵": (5, 10), "면류": (10, 25),
    "음료_HOT": (5, 10), "한과_떡류": (5, 10), "반찬류": (5, 10),
}

# 사장님이 설정 가능한 조리시간 단위 (5분 단위, 5분~100분)
COOK_TIME_STEP_MINUTES = 5
COOK_TIME_MIN = 5
COOK_TIME_MAX = 100

# correction_factor 폴백 체계 (사장님 설정을 보정하는 계수)
# ⚠️ 초기 추정값, 실측 데이터 쌓이면 재계산 필요

DEFAULT_CORRECTION_FACTOR = 1.0  # 폴백 최후 단계: 보정 없음(사장님 설정 그대로)

CATEGORY_CORRECTION_FACTORS = {
    "찜류": 1.15, "국물류": 1.1, "탕류": 1.1, "구이류": 1.1,
    "튀김류": 1.05, "면류": 1.05, "피자": 1.05,
    "버거류": 1.0, "완제품": 1.0, "음료_상온": 1.0,
}

# 약 3.3km까지 배달 가능 지역 범위
# 20km/h 오토바이로 약 10분 
# 실제로도 매장 반경 3km 까지 배달 가능하다고 기재되어있음 (요기요 사장님 포털)
DELIVERY_DISTANCE_RANGE_DEGREES = 0.03 

# 라이더가 이 콜을 받을 만한 최소 시간당 수익 기준
# ⚠️ 임의값, 추후 실제 라이더 조사/실측 데이터로 튜닝 필요
MIN_ACCEPTABLE_HOURLY_REVENUE = 20000 # 시간당 최소 수익 기준 (원/시간)

# 완전탐색 스코어링 가중치 (기획서 원안 값, ⚠️ 실측 데이터 기반 튜닝 필요)
# 클러스터링(1단계)과 같은 원칙 적용: 근거 없는 정밀한 가중치보다,
# 모든 요소를 동등하게(1.0) 두고 단순 합산 → 추후 실측 데이터로 튜닝

WEIGHT_FOOD_SITTING_TIME = 1.0   # 음식이 완성된 후 방치된 시간(분) — 고객이 받는 음식 신선도에 직결
WEIGHT_COURIER_WAIT_TIME = 1.0   # 라이더가 매장에서 조리 완료를 기다린 시간(분) — 라이더의 시간 손실
WEIGHT_BAG_TIME = 1.0            # 픽업 후 배달까지 가방 안에 머문 시간(분) — 음식 온도/품질 저하
WEIGHT_TOTAL_TIME = 1.0          # 전체 배달 소요 시간(분) — 라이더 시간당 수익 계산의 분모

#  cf. clustering 1단계에서 마찬가지로
# store_distance — 두 매장 사이 실제 거리
# delivery_distance — 두 배달지 사이 실제 거리
# cross_distance — (내 매장↔상대 배달지 + 상대 매장↔내 배달지) 평균, 엇갈리는 동선까지 반영
# cook_time_diff_km_equiv — 조리시간 차이(분)를, 20km/h 속도로 환산해서 "그만큼 이동했을 때의 거리"로 바꾼 값
# urgency_penalty — 긴급도(카테고리) 다르면 1.0km 페널티

# 핵심은 "다 같은 단위(km)로 맞춰서, 가중치 없이 단순 더하기"였음. 지금 완전탐색(2단계)에서 하려는 것과 정확히 같은 원칙