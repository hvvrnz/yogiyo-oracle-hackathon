import random
from db.connection import get_connection
from common.dummy.stores import DUMMY_STORES


def sync_stores_to_db():
    conn = get_connection()
    cursor = conn.cursor()
    for store in DUMMY_STORES:
        cursor.execute("""
            INSERT INTO stores (store_id, name, category, region, lat, lng, avg_delivery_eta_min)
            VALUES (:store_id, :name, :category, :region, :lat, :lng, :avg_delivery_eta_min)
        """, {
            "store_id": store["store_id"],
            "name": store["name"],
            "category": store["category"],
            "region": store["region"],
            "lat": store["lat"],
            "lng": store["lng"],
            "avg_delivery_eta_min": random.randint(20, 45),  # ⚠️ 임의값, 추후 실측 통계로 대체
        })
    conn.commit()
    cursor.close()
    conn.close()
    print(f"{len(DUMMY_STORES)}개 매장을 DB에 저장했습니다.")


if __name__ == "__main__":
    sync_stores_to_db()