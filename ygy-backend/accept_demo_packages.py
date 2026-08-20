"""
현재 OFFERED 상태인 패키지에 라이더를 배정(수락 처리)하는 스크립트.
rider_id를 채우고 status를 MATCHING으로 바꾼다.
"""
import argparse
from db.connection import get_connection, fetch_all
from stream_processor.riders.geo_client import find_nearby_riders, is_rider_available, set_rider_busy


def get_offered_packages(limit=None):
    query = """
        SELECT package_id, package_type, order_ids
        FROM packages
        WHERE status = 'OFFERED'
        ORDER BY package_id DESC
    """
    if limit:
        query = f"SELECT * FROM ({query}) WHERE ROWNUM <= {limit}"
    return fetch_all(query)


def find_candidate_rider(package_id):
    order_row = fetch_all("""
        SELECT s.lat, s.lng
        FROM orders o
        JOIN stores s ON o.store_id = s.store_id
        WHERE o.package_id = :package_id
        AND ROWNUM = 1
    """, {"package_id": package_id})

    if not order_row:
        return None

    store_lat, store_lng = order_row[0]["lat"], order_row[0]["lng"]
    nearby = find_nearby_riders(store_lat, store_lng, radius_km=5)
    for rider_id, dist in nearby:
        if is_rider_available(rider_id):
            return rider_id
    return None


def accept_package(package_id, rider_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE packages
        SET rider_id = :rider_id,
            status = 'MATCHING',
            accepted_at = SYSTIMESTAMP
        WHERE package_id = :package_id
    """, {"rider_id": rider_id, "package_id": package_id})
    conn.commit()
    cursor.close()
    conn.close()
    set_rider_busy(rider_id)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    packages = get_offered_packages(limit=args.limit)

    if not packages:
        print("OFFERED 상태 패키지가 없습니다.")
        exit()

    print(f"=== 대상 패키지 {len(packages)}건 ===")
    for pkg in packages:
        rider_id = find_candidate_rider(pkg["package_id"])
        if not rider_id:
            print(f"package_id={pkg['package_id']} -> 배정 가능 라이더 없음, 스킵")
            continue
        accept_package(pkg["package_id"], rider_id)
        print(f"package_id={pkg['package_id']} -> rider_id={rider_id} 수락 처리")

    print("=== 완료 ===")