from db.connection import get_connection
from common.dummy.riders import DUMMY_RIDERS


def sync_riders_to_db():
    conn = get_connection()
    cursor = conn.cursor()
    for rider in DUMMY_RIDERS:
        cursor.execute("""
            INSERT INTO riders (rider_id, name, region, status)
            VALUES (:rider_id, :name, :region, 'AVAILABLE')
        """, {
            "rider_id": rider["rider_id"],
            "name": rider["name"],
            "region": rider["region"],
        })
    conn.commit()
    cursor.close()
    conn.close()
    print(f"{len(DUMMY_RIDERS)}명의 라이더를 DB에 저장했습니다.")


if __name__ == "__main__":
    sync_riders_to_db()