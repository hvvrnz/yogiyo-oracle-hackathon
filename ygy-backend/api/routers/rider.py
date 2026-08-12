from fastapi import APIRouter, HTTPException
from db.connection import execute_and_commit, fetch_all, fetch_one
from stream_processor.riders.geo_client import set_rider_available

router = APIRouter(prefix="/api/rider", tags=["rider"])


@router.get("")
def get_all_riders():
    """전체 라이더 목록 조회 (지도에 마커 찍을 때 사용)."""
    riders = fetch_all("""
        SELECT rider_id, name, region, status, completed_order_count
        FROM riders
        ORDER BY rider_id
    """)
    return {"count": len(riders), "riders": riders}


@router.get("/{rider_id}")
def get_rider_packages(rider_id: str):
    """특정 라이더에게 배정된 패키지(묶음/한집배달) 목록 조회."""
    packages = fetch_all("""
        SELECT package_id, package_type, status, bundle_size,
               score, package_revenue, hourly_revenue,
               order_ids, route_detail, score_detail, created_at
        FROM packages
        WHERE rider_id = :rider_id
        ORDER BY created_at DESC
    """, {"rider_id": rider_id})

    if not packages:
        raise HTTPException(status_code=404, detail="해당 라이더의 배정 내역이 없습니다.")

    return {"rider_id": rider_id, "packages": packages}


@router.get("/{rider_id}/profile")
def get_rider_profile(rider_id: str):
    """라이더 개인 정보 조회 (이름, 권역, 완료 건수 등)."""
    profile = fetch_one("""
        SELECT rider_id, name, region, status, completed_order_count
        FROM riders
        WHERE rider_id = :rider_id
    """, {"rider_id": rider_id})

    if not profile:
        raise HTTPException(status_code=404, detail="해당 라이더를 찾을 수 없습니다.")

    return profile


@router.put("/{rider_id}/package/{package_id}/pickup")
def mark_pickup(rider_id: str, package_id: int):
    """라이더가 픽업을 완료했을 때 호출."""
    row_count = execute_and_commit(
        """UPDATE packages SET status = 'PICKED_UP', accepted_at = SYSTIMESTAMP
           WHERE package_id = :package_id AND rider_id = :rider_id""",
        {"package_id": package_id, "rider_id": rider_id}
    )
    if row_count == 0:
        raise HTTPException(status_code=404, detail="해당 패키지를 찾을 수 없습니다.")

    return {"package_id": package_id, "status": "PICKED_UP"}


@router.put("/{rider_id}/package/{package_id}/complete")
def mark_complete(rider_id: str, package_id: int):
    """
    라이더가 배달을 완료했을 때 호출.
    - packages 상태를 COMPLETED로 변경
    - riders 완료 건수 1 증가
    - Redis에서 이 라이더를 다시 배정 가능(available) 상태로 되돌림
    """
    row_count = execute_and_commit(
        """UPDATE packages SET status = 'COMPLETED', completed_at = SYSTIMESTAMP
           WHERE package_id = :package_id AND rider_id = :rider_id""",
        {"package_id": package_id, "rider_id": rider_id}
    )
    if row_count == 0:
        raise HTTPException(status_code=404, detail="해당 패키지를 찾을 수 없습니다.")

    execute_and_commit(
        "UPDATE riders SET completed_order_count = completed_order_count + 1 WHERE rider_id = :rider_id",
        {"rider_id": rider_id}
    )

    set_rider_available(rider_id)
    return {"package_id": package_id, "status": "COMPLETED"}