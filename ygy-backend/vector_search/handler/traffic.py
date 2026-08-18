import requests
import os

WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")


def get_weather_condition():
    """
    공공데이터포털 기상청 API에서 오늘 날씨 조회.
    실패하면 None 반환 (fallback: 지연 없음으로 처리).
    """
    try:
        # 실제 기상청 초단기예보 API 엔드포인트 (예시, 실제 파라미터는 API 문서 확인 필요)
        url = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst"
        params = {
            "serviceKey": WEATHER_API_KEY,
            "dataType": "JSON",
            "base_date": "20260818",  # 오늘 날짜로 동적 생성 필요
            "base_time": "0600",
            "nx": 61, "ny": 126,  # 강남 근처 격자 좌표
        }
        response = requests.get(url, params=params, timeout=3)
        data = response.json()
        # 강수 여부(PTY) 등을 파싱해서 판단
        return data
    except Exception:
        return None


def build_traffic_notice(rider_id):
    weather = get_weather_condition()
    if weather is None:
        return None  # API 실패 시 조용히 넘어감
    # 강수 여부에 따라 지연 문구 생성 (실제 파싱 로직은 API 응답 구조 확인 후 완성)
    ...