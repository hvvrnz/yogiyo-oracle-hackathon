from common.config.common import AVG_SPEED_KMH

RIDER_COUNT = 500
RIDER_STATUS_KEY_PREFIX = "rider:status:"

DEMO_RIDER_IDS = [
    "rider_12", "rider_13", "rider_19", "rider_23", "rider_31",  # 강남 5명
    "rider_2", "rider_5", "rider_6",                              # 홍대 3명
]

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

REGION_RIDER_WEIGHTS = {
    "강남": 3, "역삼": 2, "신림": 1.5, "노원": 1,
    "잠실": 2, "홍대": 3, "성수": 1.5, "이태원": 2,
}

RIDER_LOCATION_UPDATE_INTERVAL_SECONDS = 5

RIDER_GEO_KEY = 'riders:locations'

# 5초 동안 이동하는 실제 거리(미터)를 km/h → m/s → m(5초간) → 도(degree, 좌표계 단위)로 변환하여 저장
RIDER_MOVE_RANGE_DEGREES = (AVG_SPEED_KMH * 1000 / 3600) * RIDER_LOCATION_UPDATE_INTERVAL_SECONDS / 111000

BASE_DELIVERY_FEE = 3000  # 기본 배달비(원), ⚠️ 임의값
PER_KM_EXTRA_FEE = 500     # km당 추가요금(원), ⚠️ 임의값