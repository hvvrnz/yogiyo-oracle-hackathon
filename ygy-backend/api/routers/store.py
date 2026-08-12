from fastapi import APIRouter
from db.connection import fetch_all

router = APIRouter(prefix="/api/stores", tags=["store"])


@router.get("")
def get_all_stores():
    """전체 매장 목록 조회 (지도에 마커 찍을 때 사용)."""
    stores = fetch_all("""
        SELECT store_id, name, category, region, lat, lng, avg_delivery_eta_min
        FROM stores
        ORDER BY store_id
    """)
    return {"count": len(stores), "stores": stores}