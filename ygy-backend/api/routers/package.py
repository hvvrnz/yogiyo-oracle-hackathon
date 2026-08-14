from fastapi import APIRouter, HTTPException
from db.connection import fetch_one

router = APIRouter(prefix="/api/package", tags=["package"])


@router.get("/{package_id}")
def get_package_detail(package_id: int):
    package = fetch_one("""
        SELECT package_id, package_type, status, bundle_size,
               score, package_revenue, hourly_revenue,
               order_ids, route_detail, score_detail,
               rider_id, created_at, offered_at, accepted_at, completed_at
        FROM packages
        WHERE package_id = :package_id
    """, {"package_id": package_id})

    if not package:
        raise HTTPException(status_code=404, detail="해당 패키지를 찾을 수 없습니다.")

    return package