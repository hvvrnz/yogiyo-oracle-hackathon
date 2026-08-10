# 더미 매장 데이터 — 클러스터링 로직 검증용 (다양한 지역/카테고리/조리시간 분포)

DUMMY_STORES = [
    # --- 강남 권역 ---
    {"store_id": 1, "name": "요기요 치킨 강남점", "category": "튀김류", "lat": 37.4980, "lng": 127.0280, "base_cooking_min": 20},
    {"store_id": 2, "name": "요기요 족발 강남2점", "category": "찜류", "lat": 37.4982, "lng": 127.0283, "base_cooking_min": 60},
    {"store_id": 3, "name": "요기요 국밥 강남3점", "category": "국물류", "lat": 37.4979, "lng": 127.0279, "base_cooking_min": 18},
    {"store_id": 4, "name": "요기요 초밥 강남4점", "category": "초밥_회류", "lat": 37.4975, "lng": 127.0295, "base_cooking_min": 10},
    {"store_id": 5, "name": "요기요 편의점 강남5점", "category": "완제품", "lat": 37.4990, "lng": 127.0270, "base_cooking_min": 3},

    # --- 역삼 권역 ---
    {"store_id": 6, "name": "요기요 버거 역삼점", "category": "버거류", "lat": 37.5000, "lng": 127.0360, "base_cooking_min": 12},
    {"store_id": 7, "name": "요기요 피자 역삼2점", "category": "피자", "lat": 37.5005, "lng": 127.0355, "base_cooking_min": 25},
    {"store_id": 8, "name": "요기요 카페 역삼3점", "category": "음료_아이스", "lat": 37.4995, "lng": 127.0365, "base_cooking_min": 5},
    {"store_id": 9, "name": "요기요 마라탕 역삼4점", "category": "탕류", "lat": 37.5010, "lng": 127.0340, "base_cooking_min": 22},

    # --- 신림 권역 ---
    {"store_id": 10, "name": "요기요 한식 신림점", "category": "찌개류", "lat": 37.4840, "lng": 126.9300, "base_cooking_min": 15},
    {"store_id": 11, "name": "요기요 베이커리 신림2점", "category": "디저트_구움과자", "lat": 37.4838, "lng": 126.9305, "base_cooking_min": 8},
    {"store_id": 12, "name": "요기요 분식 신림3점", "category": "분식_일반", "lat": 37.4845, "lng": 126.9290, "base_cooking_min": 14},
    {"store_id": 13, "name": "요기요 치킨 신림4점", "category": "튀김류", "lat": 37.4855, "lng": 126.9280, "base_cooking_min": 22},

    # --- 노원 권역 (강남/역삼/신림과 멀리 떨어짐) ---
    {"store_id": 14, "name": "요기요 치킨 노원점", "category": "튀김류", "lat": 37.6550, "lng": 127.0610, "base_cooking_min": 20},
    {"store_id": 15, "name": "요기요 죽 노원2점", "category": "죽류", "lat": 37.6555, "lng": 127.0605, "base_cooking_min": 16},
    {"store_id": 16, "name": "요기요 도시락 노원3점", "category": "도시락", "lat": 37.6545, "lng": 127.0615, "base_cooking_min": 10},

    # --- 잠실/송파 권역 ---
    {"store_id": 17, "name": "요기요 샌드위치 잠실점", "category": "샌드위치", "lat": 37.5130, "lng": 127.1000, "base_cooking_min": 13},
    {"store_id": 18, "name": "요기요 초밥 송파점", "category": "초밥_회류", "lat": 37.5145, "lng": 127.1060, "base_cooking_min": 50},
    {"store_id": 19, "name": "요기요 떡볶이 송파2점", "category": "분식_일반", "lat": 37.5140, "lng": 127.1050, "base_cooking_min": 11},
    {"store_id": 20, "name": "요기요 아이스크림 송파3점", "category": "디저트_냉장류", "lat": 37.5135, "lng": 127.1030, "base_cooking_min": 4},

    # --- 홍대 권역 ---
    {"store_id": 21, "name": "요기요 브런치 홍대점", "category": "샐러드", "lat": 37.5560, "lng": 126.9236, "base_cooking_min": 17},
    {"store_id": 22, "name": "요기요 곱창 홍대2점", "category": "구이류", "lat": 37.5565, "lng": 126.9230, "base_cooking_min": 28},
    {"store_id": 23, "name": "요기요 타코 홍대3점", "category": "분식_일반", "lat": 37.5555, "lng": 126.9245, "base_cooking_min": 15},
    {"store_id": 24, "name": "요기요 베이커리 홍대4점", "category": "베이커리_상온빵", "lat": 37.5570, "lng": 126.9220, "base_cooking_min": 6},

    # --- 성수 권역 ---
    {"store_id": 25, "name": "요기요 스테이크 성수점", "category": "구이류", "lat": 37.5445, "lng": 127.0560, "base_cooking_min": 35},
    {"store_id": 26, "name": "요기요 파스타 성수2점", "category": "면류", "lat": 37.5450, "lng": 127.0555, "base_cooking_min": 19},
    {"store_id": 27, "name": "요기요 커피 성수3점", "category": "음료_HOT", "lat": 37.5440, "lng": 127.0570, "base_cooking_min": 5},

    # --- 이태원 권역 ---
    {"store_id": 28, "name": "요기요 케밥 이태원점", "category": "구이류", "lat": 37.5345, "lng": 126.9945, "base_cooking_min": 14},
    {"store_id": 29, "name": "요기요 버거 이태원2점", "category": "버거류", "lat": 37.5350, "lng": 126.9940, "base_cooking_min": 13},
    {"store_id": 30, "name": "요기요 한과 이태원3점", "category": "한과_떡류", "lat": 37.5340, "lng": 126.9950, "base_cooking_min": 7},

    # demo용 조리시간 1분 (한집배달 테스트용)
    {"store_id": 31, "name": "요기요 편의점 건대점", "category": "음료_상온", "lat": 37.5000, "lng": 127.0500, "base_cooking_min": 1},
    {"store_id": 31, "name": "요기요 디저트 송파점", "category": "디저트_상온", "lat": 37.5280, "lng": 129.9200, "base_cooking_min": 1},
]