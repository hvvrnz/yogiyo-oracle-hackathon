from fastapi import APIRouter, HTTPException
from db.connection import execute_and_commit, fetch_all, fetch_one
from stream_processor.riders.geo_client import set_rider_available, get_rider_position

router = APIRouter(prefix="/api/rider", tags=["rider"])


@router.get("")
def get_all_riders():
    """전체 라이더 목록 조회 (지도에 마커 찍을 때 사용). Redis에서 실시간 위치도 함께 조회."""
    riders = fetch_all("""
        SELECT rider_id, name, region, status, completed_order_count
        FROM riders
        ORDER BY rider_id
    """)

    for rider in riders:
        pos = get_rider_position(rider["rider_id"])
        rider["lat"] = pos[0] if pos else None
        rider["lng"] = pos[1] if pos else None

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

    rider_pos = get_rider_position(rider_id)

    return {
        "rider_id": rider_id,
        "current_lat": rider_pos[0] if rider_pos else None,
        "current_lng": rider_pos[1] if rider_pos else None,
        "packages": packages,
    }


@router.get("/{rider_id}/profile")
def get_rider_profile(rider_id: str):
    """라이더 개인 정보 조회 (이름, 권역, 완료 건수, 현재 위치)."""
    profile = fetch_one("""
        SELECT rider_id, name, region, status, completed_order_count
        FROM riders
        WHERE rider_id = :rider_id
    """, {"rider_id": rider_id})

    if not profile:
        raise HTTPException(status_code=404, detail="해당 라이더를 찾을 수 없습니다.")

    pos = get_rider_position(rider_id)
    profile["lat"] = pos[0] if pos else None
    profile["lng"] = pos[1] if pos else None

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
    
    execute_and_commit(
        "UPDATE orders SET status = 'PICKED_UP' WHERE package_id = :package_id",
        {"package_id": package_id}
    ) #  패키지랑 orders.status랑 동기화

    return {"package_id": package_id, "status": "PICKED_UP"}


@router.put("/{rider_id}/package/{package_id}/complete")
def mark_complete(rider_id: str, package_id: int):
    """
    라이더가 배달을 완료했을 때 호출.
    - packages 상태를 COMPLETED로 변경 (DB, 영구 기록)
    - riders 완료 건수 1 증가 (DB)
    - Redis에서 이 라이더를 다시 배정 가능(available) 상태로 되돌림
      (packages.status와 Redis 상태는 서로 자동 동기화되지 않으며,
       이 API가 두 곳을 각각 명시적으로 업데이트함)
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

    execute_and_commit(
        "UPDATE orders SET status = 'DELIVERED' WHERE package_id = :package_id",
        {"package_id": package_id}
    )
    
    return {"package_id": package_id, "status": "COMPLETED"}

@router.get("/{rider_id}/earnings")
def get_rider_earnings(rider_id: str):
    """
    라이더의 전체 수익 요약 (현재는 날짜 필터 없이 전체 집계).
    """
    packages = fetch_all("""
        SELECT package_id, package_type, package_revenue, hourly_revenue, status
        FROM packages
        WHERE rider_id = :rider_id
    """, {"rider_id": rider_id})

    total_revenue = sum(p["package_revenue"] for p in packages)
    completed_count = sum(1 for p in packages if p["status"] == "COMPLETED")

    return {
        "rider_id": rider_id,
        "total_package_count": len(packages),
        "completed_count": completed_count,
        "total_revenue": total_revenue,
        "packages": packages,
    }


@router.get("/{rider_id}/offers")
def get_rider_offers(rider_id: str, radius_km: float = 5):
    """
    이 라이더 근처에서, 아직 수락 안 된(OFFERED) 패키지 목록 조회.
    """
    from stream_processor.riders.geo_client import get_rider_position

    pos = get_rider_position(rider_id)
    if not pos:
        raise HTTPException(status_code=404, detail="라이더 위치를 찾을 수 없습니다.")

    # 간단하게: 상태가 OFFERED인 패키지 전체 반환 (거리 필터는 필요시 추가)
    offers = fetch_all("""
        SELECT package_id, package_type, bundle_size, score,
               package_revenue, hourly_revenue, order_ids, route_detail
        FROM packages
        WHERE status = 'OFFERED'
        ORDER BY hourly_revenue DESC
    """)
    return {"rider_id": rider_id, "offers": offers}


@router.put("/{rider_id}/package/{package_id}/accept")
def accept_offer(rider_id: str, package_id: int):
    """
    라이더가 제안된 패키지 중 하나를 선택해서 수락.
    """
    from stream_processor.riders.geo_client import set_rider_busy

    row_count = execute_and_commit("""
        UPDATE packages SET rider_id = :rider_id, status = 'MATCHING', accepted_at = SYSTIMESTAMP
        WHERE package_id = :package_id AND status = 'OFFERED'
    """, {"rider_id": rider_id, "package_id": package_id})

    if row_count == 0:
        raise HTTPException(status_code=409, detail="이미 다른 라이더가 수락했거나 존재하지 않는 패키지입니다.")

    execute_and_commit(
        "UPDATE orders SET status = 'MATCHED' WHERE package_id = :package_id",
        {"package_id": package_id}
    )
    set_rider_busy(rider_id)

    return {"package_id": package_id, "rider_id": rider_id, "status": "MATCHING"}