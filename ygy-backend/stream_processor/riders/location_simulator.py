# 참고: 이 프로그램은 끝나지 않고 계속 라이더 위치를 갱신하는 상태로 남아있다.
# 멈추고 싶으면 Ctrl+C로 종료
import random
import time
from common.dummy.riders import DUMMY_RIDERS
from common.config import RIDER_LOCATION_UPDATE_INTERVAL_SECONDS, RIDER_MOVE_RANGE_DEGREES
from stream_processor.riders.geo_client import r, RIDER_GEO_KEY


def simulate_rider_movement():
    riders = DUMMY_RIDERS

    while True:
        print(f"\n--- 위치 갱신 ({time.strftime('%H:%M:%S')}) ---")
        for rider in riders:
            rider["lat"] += random.uniform(-RIDER_MOVE_RANGE_DEGREES, RIDER_MOVE_RANGE_DEGREES)
            rider["lng"] += random.uniform(-RIDER_MOVE_RANGE_DEGREES, RIDER_MOVE_RANGE_DEGREES)
            r.geoadd(RIDER_GEO_KEY, (rider["lng"], rider["lat"], rider["rider_id"]))
            print(f"  {rider['rider_id']} ({rider['name']}): "
                  f"lat={rider['lat']:.6f}, lng={rider['lng']:.6f}")

        time.sleep(RIDER_LOCATION_UPDATE_INTERVAL_SECONDS)
        time.sleep(RIDER_LOCATION_UPDATE_INTERVAL_SECONDS)


if __name__ == "__main__":
    try:
        simulate_rider_movement()
    except KeyboardInterrupt:
        print("\n위치 갱신 종료")