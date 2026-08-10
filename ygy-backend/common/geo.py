from math import radians, cos, sin, sqrt, atan2
from common.config import SERVICE_REGIONS

def haversine(lat1, lng1, lat2, lng2):
    R = 6371.0
    lat1_rad = radians(lat1)
    lng1_rad = radians(lng1)
    lat2_rad = radians(lat2)
    lng2_rad = radians(lng2)

    dlng = lng2_rad - lng1_rad
    dlat = lat2_rad - lat1_rad

    a = sin(dlat / 2)**2 + cos(lat1_rad) * cos(lat2_rad) * sin(dlng / 2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    distance_km = R * c
    return distance_km

def get_region(lat, lng):
    """
    주어진 좌표가 어느 서비스 권역에 속하는지 판정.
    가장 가까운 권역 중심점 기준, 해당 권역의 radius_km 이내면 그 권역으로 판정.
    어디에도 속하지 않으면 None 반환.
    """
    closest_region = None
    closest_distance = None

    for region_name, region_info in SERVICE_REGIONS.items():
        distance = haversine(lat, lng, region_info["lat"], region_info["lng"])
        if closest_distance is None or distance < closest_distance:
            closest_distance = distance
            closest_region = region_name

    if closest_distance is not None and closest_distance <= SERVICE_REGIONS[closest_region]["radius_km"]:
        return closest_region
    return None