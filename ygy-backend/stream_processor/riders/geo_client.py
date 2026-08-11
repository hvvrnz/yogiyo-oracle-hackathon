import redis
from common.dummy.riders import DUMMY_RIDERS
from common.config import RIDER_GEO_KEY, SERVICE_REGIONS

r = redis.Redis(host='localhost', port=6379, decode_responses=True)


def register_riders(riders=DUMMY_RIDERS):
    for rider in riders:
        r.geoadd(RIDER_GEO_KEY, (rider["lng"], rider["lat"], rider["rider_id"]))
    print(f"{len(riders)}명의 라이더 위치를 Redis에 등록했습니다.")


def find_nearby_riders(store_lat, store_lng, radius_km):
    results = r.georadius(
        RIDER_GEO_KEY, store_lng, store_lat, radius_km,
        unit='km', withdist=True, sort='ASC'
    )
    return results


def print_all_regions_nearby_riders(top_n=5, riders=DUMMY_RIDERS):
    rider_lookup = {r["rider_id"]: r["name"] for r in riders}

    for region_name, region in SERVICE_REGIONS.items():
        nearby = find_nearby_riders(region["lat"], region["lng"], region["radius_km"])
        print(f"\n- {region_name} 권역 (반경 {region['radius_km']}km) 라이더 (🏆 상위 {top_n}명):")
        if not nearby:
            print("  (권역 내 라이더 없음)")
        for rider_id, distance in nearby[:top_n]:
            name = rider_lookup.get(rider_id, "이름없음")
            print(f"🏍️  {rider_id} ({name}): {float(distance):.2f}km")

def get_rider_position(rider_id):
    result = r.geopos(RIDER_GEO_KEY, rider_id)
    if result and result[0]:
        lng, lat = result[0]
        return (float(lat), float(lng))
    return None

def get_rider_info(rider_id, riders=DUMMY_RIDERS):
    # rider_id로 해당 라이더의 이름, 권역 등 상세 정보를 조회
    for rider in riders:
        if rider["rider_id"] == rider_id:
            return rider
    return None

if __name__ == "__main__":
    register_riders()
    print_all_regions_nearby_riders()

    from collections import Counter
    region_counts = Counter(r["region"] for r in DUMMY_RIDERS)
    print(f"\n{'='*70}")
    print("권역별 라이더 배정 현황 (유동인구 / 배달상권 고려 가중치 반영 결과)")
    print(f"{'='*70}")
    for region_name, count in sorted(region_counts.items(), key=lambda x: -x[1]):
        print(f"  {region_name}: {count}명")
