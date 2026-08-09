from enum import Enum

# 배달 긴급도 카테고리 분류
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
    "볶음류": UrgencyLevel.URGENT,       # 볶음밥, 짜장면 등 (기름 굳음)
    "구이류": UrgencyLevel.URGENT,       # 직화구이 (삼겹살, 스테이크 등은 아래서 분리 고려 가능)
    "피자": UrgencyLevel.URGENT,
    "버거류": UrgencyLevel.URGENT,       # 번 눅눅해짐 + 패티 식음
    "음료_HOT": UrgencyLevel.URGENT,

    # ── MODERATE: 어느 정도 버티지만 신경 필요 ──
    "밥류": UrgencyLevel.MODERATE,       # 덮밥, 비빔밥 등 (볶음류와 분리)
    "죽류": UrgencyLevel.MODERATE,
    "찜류": UrgencyLevel.MODERATE,       # 찜닭, 갈비찜, 만두찜 등
    "초밥_회류": UrgencyLevel.MODERATE,  # 신선도 이슈는 있지만 온도 민감도는 낮음
    "도시락": UrgencyLevel.MODERATE,
    "샐러드": UrgencyLevel.MODERATE,
    "샌드위치": UrgencyLevel.MODERATE,
    "분식_일반": UrgencyLevel.MODERATE,  # 떡볶이(일반), 김밥, 순대 등
    "음료_아이스": UrgencyLevel.MODERATE,
    "디저트_냉장류": UrgencyLevel.MODERATE,  # 생크림케이크, 아이스크림, 티라미수

    # ── FLEXIBLE: 상온에서도 품질 유지 ──
    "완제품": UrgencyLevel.FLEXIBLE,     # 편의점/마트 밀봉 상품
    "음료_상온": UrgencyLevel.FLEXIBLE,  # 생수, 캔·병음료
    "디저트_구움과자": UrgencyLevel.FLEXIBLE,  # 쿠키, 마카롱, 스콘
    "베이커리_상온빵": UrgencyLevel.FLEXIBLE,
    "한과_떡류": UrgencyLevel.FLEXIBLE,
    "반찬류": UrgencyLevel.FLEXIBLE,     # 밀키트/반찬 배달 등 상온·냉장 유통 전제
}

# 이동속도 (기획서 완전탐색 알고리즘과 동일 기준 사용)
AVG_SPEED_KMH = 20

# 긴급도가 다른 주문끼리 묶일 때의 페널티 (km 환산 기준, 초기 추정값)
URGENCY_MISMATCH_PENALTY_KM = 1.0  # ⚠️ 임의값, 추후 튜닝 필요

# 클러스터 최대 크기
MAX_CLUSTER_SIZE = 3