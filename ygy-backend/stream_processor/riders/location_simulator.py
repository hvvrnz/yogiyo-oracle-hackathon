import random
import json
import time
from common.dummy.riders import DUMMY_RIDERS
from common.config import RIDER_LOCATION_UPDATE_INTERVAL_SECONDS, RIDER_MOVE_RANGE_DEGREES, DEMO_RIDER_IDS
from stream_processor.riders.geo_client import r, RIDER_GEO_KEY
from db.connection import fetch_all


def simulate_rider_movement():
    riders = DUMMY_RIDERS

    while True:
        for rider in riders:
            if rider["rider_id"] in DEMO_RIDER_IDS:
                rider["lat"] += random.uniform(-RIDER_MOVE_RANGE_DEGREES * 0.2, RIDER_MOVE_RANGE_DEGREES * 0.1)
                rider["lng"] += random.uniform(-RIDER_MOVE_RANGE_DEGREES * 0.2, RIDER_MOVE_RANGE_DEGREES * 0.1)
            else:
                rider["lat"] += random.uniform(-RIDER_MOVE_RANGE_DEGREES, RIDER_MOVE_RANGE_DEGREES)
                rider["lng"] += random.uniform(-RIDER_MOVE_RANGE_DEGREES, RIDER_MOVE_RANGE_DEGREES)
            r.geoadd(RIDER_GEO_KEY, (rider["lng"], rider["lat"], rider["rider_id"]))

        move_assigned_riders()
        time.sleep(RIDER_LOCATION_UPDATE_INTERVAL_SECONDS)


def move_assigned_riders():
    """
    현재 배정(MATCHING/PICKED_UP)된 라이더는, route_detail을 따라
    선형보간으로 이동시킴. 배정 안 된 라이더는 기존처럼 무작위 흔들림.
    """
    assigned = fetch_all("""
        SELECT package_id, rider_id, route_detail, accepted_at
        FROM packages
        WHERE status IN ('MATCHING', 'PICKED_UP')
        AND rider_id IS NOT NULL
    """)

    for pkg in assigned:
        route = json.loads(pkg["route_detail"]) if isinstance(pkg["route_detail"], str) else pkg["route_detail"]
        if len(route) < 2 or "lat" not in route[0]:
            continue

        elapsed_min = (time.time() - pkg["accepted_at"].timestamp()) / 60 if pkg["accepted_at"] else 0
        total_min = route[-1].get("arrival_time_min", 1) or 1
        progress = min(elapsed_min / total_min, 1.0)

        segment_count = len(route) - 1
        segment_progress = progress * segment_count
        idx = min(int(segment_progress), segment_count - 1)
        local_progress = segment_progress - idx

        start, end = route[idx], route[idx + 1]
        start_lat, start_lng = float(start["lat"]), float(start["lng"])
        end_lat, end_lng = float(end["lat"]), float(end["lng"])
        lat = start_lat + (end_lat - start_lat) * local_progress
        lng = start_lng + (end_lng - start_lng) * local_progress
        r.geoadd(RIDER_GEO_KEY, (lng, lat, pkg["rider_id"]))


if __name__ == "__main__":
    try:
        simulate_rider_movement()
    except KeyboardInterrupt:
        print("\n실시간 라이더 위치 갱신 종료")