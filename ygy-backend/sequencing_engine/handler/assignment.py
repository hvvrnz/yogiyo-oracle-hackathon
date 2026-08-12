from sequencing_engine.handler.search import find_best_route, is_hourly_revenue_acceptable, calculate_solo_delivery
from sequencing_engine.handler.scoring import calculate_revenue
from sequencing_engine.repository.package_repo import insert_package
from sequencing_engine.repository.order_repo import insert_orders
from sequencing_engine.handler.display import print_route_timeline, print_consumer_eta
from stream_processor.riders.geo_client import (
    find_nearby_riders, get_rider_position, get_rider_info,
    set_rider_busy, is_rider_available
)
from stream_processor.orders.timing import still_has_time
from common.config import MIN_ACCEPTABLE_HOURLY_REVENUE


def _build_route_detail(best_route):
    return [{"order_id": oid, "type": vtype} for oid, vtype in best_route]


def _build_score_detail(detail):
    return {
        "food_sitting_time": round(detail["food_sitting_time"], 1),
        "courier_wait_time": round(detail["courier_wait_time"], 1),
        "bag_time": round(detail["bag_time"], 1),
        "total_time": round(detail["total_time"], 1),
        "timeline": detail["timeline"],
    }


def _get_available_riders(store_lat, store_lng, assigned_rider_ids, radius_km=5):
    """
    특정 위치 근처 라이더 중에서,
    1) 이번 윈도우에서 이미 배정된 라이더(assigned_rider_ids)
    2) Redis 상 아직 이전 배달을 완료 안 한(BUSY) 라이더
    둘 다 제외한 진짜 배정 가능한 후보만 반환.
    """
    nearby_riders = find_nearby_riders(store_lat, store_lng, radius_km)
    return [
        (rid, dist) for rid, dist in nearby_riders
        if rid not in assigned_rider_ids and is_rider_available(rid)
    ]


def assign_bundle(cluster, assigned_rider_ids):
    rep_store_lat = cluster[0]["store_lat"]
    rep_store_lng = cluster[0]["store_lng"]
    available_riders = _get_available_riders(rep_store_lat, rep_store_lng, assigned_rider_ids)

    if not available_riders:
        print(f"   ⚠ 근처에 배정 가능한 라이더 없음, 배차 불가")
        return False

    nearest_rider_id, nearest_dist = available_riders[0]
    rider_start_pos = get_rider_position(nearest_rider_id)

    best_route, best_score, best_detail = find_best_route(cluster, rider_start_pos)
    package_revenue, hourly_revenue = calculate_revenue(cluster, best_detail['total_time'])

    if not is_hourly_revenue_acceptable(hourly_revenue):
        print(f"   ⚠ 묶음 시간당 수익({hourly_revenue:,.0f}원)이 "
              f"최소 기준({MIN_ACCEPTABLE_HOURLY_REVENUE:,.0f}원)보다 낮음 — 묶음 취소")
        return False

    # 여기서부터 확정 — 이 시점에만 라이더를 실제로 "잡음"
    assigned_rider_ids.add(nearest_rider_id)
    set_rider_busy(nearest_rider_id)

    order_ids = [o["order_id"] for o in cluster]
    package_id = insert_package(
        rider_id=nearest_rider_id,
        package_type="BUNDLE",
        order_ids=order_ids,
        route_detail=_build_route_detail(best_route),
        score=round(best_score, 2),
        score_detail=_build_score_detail(best_detail),
        package_revenue=package_revenue,
        hourly_revenue=hourly_revenue,
    )
    insert_orders(cluster, package_id=package_id)

    rider_info = get_rider_info(nearest_rider_id)
    rider_name = rider_info["name"] if rider_info else "이름없음"
    rider_region = rider_info["region"] if rider_info else "권역미상"

    print(f"   🏍 배정 라이더: {nearest_rider_id} ({rider_name}, {rider_region} 권역) — {float(nearest_dist):.2f}km")
    print(f"   💰 예상 수익: {package_revenue:,.0f}원 (시간당 {hourly_revenue:,.0f}원)")
    print(f"   ⭐ score: {best_score:.2f}")

    orders_by_id = {o["order_id"]: o for o in cluster}
    print_route_timeline(best_detail, orders_by_id)
    print_consumer_eta(best_detail, orders_by_id)
    return True


def assign_solo(order, assigned_rider_ids):
    available_riders = _get_available_riders(order["store_lat"], order["store_lng"], assigned_rider_ids)

    if not available_riders:
        print(f"   ⚠ 근처에 배정 가능한 라이더 없음")
        return False

    nearest_rider_id, nearest_dist = available_riders[0]
    rider_start_pos = get_rider_position(nearest_rider_id)

    route, score, detail = calculate_solo_delivery(order, rider_start_pos)
    revenue, hourly = calculate_revenue([order], detail['total_time'])

    assigned_rider_ids.add(nearest_rider_id)
    set_rider_busy(nearest_rider_id)

    package_id = insert_package(
        rider_id=nearest_rider_id,
        package_type="SOLO",
        order_ids=[order["order_id"]],
        route_detail=_build_route_detail(route),
        score=round(score, 2),
        score_detail=_build_score_detail(detail),
        package_revenue=revenue,
        hourly_revenue=hourly,
    )
    insert_orders([order], package_id=package_id)

    rider_info = get_rider_info(nearest_rider_id)
    rider_name = rider_info["name"] if rider_info else "이름없음"

    print(f"   🏍 배정 라이더: {nearest_rider_id} ({rider_name}) — {float(nearest_dist):.2f}km")
    print(f"   💰 예상 수익: {revenue:,.0f}원 (시간당 {hourly:,.0f}원)")

    orders_by_id = {order["order_id"]: order}
    print_route_timeline(detail, orders_by_id)
    print_consumer_eta(detail, orders_by_id)
    return True


def process_clusters(clusters):
    assigned_rider_ids = set()
    rejected_orders = []

    for i, cluster in enumerate(clusters, 1):
        names = ', '.join(f"{o['store_name']}({o.get('menu_name','?')})" for o in cluster)
        print(f"\n✅ 묶음 #{i} 확정 시도: {names}")
        print(f"   주문번호: {[o['order_id'] for o in cluster]}")

        success = assign_bundle(cluster, assigned_rider_ids)
        if not success:
            rejected_orders.extend(cluster)

    return assigned_rider_ids, rejected_orders


def process_unmatched(unmatched, assigned_rider_ids):
    still_waiting = [o for o in unmatched if still_has_time(o)]
    expired = [o for o in unmatched if not still_has_time(o)]

    for o in expired:
        print(f"\n🏠 한집배달: {o['store_name']}({o.get('menu_name','?')})")
        assign_solo(o, assigned_rider_ids)

    if still_waiting:
        names = ', '.join(f"{o['store_name']}({o.get('menu_name','?')})" for o in still_waiting)
        print(f"\n⏳ 매칭 대기 중: {names}")

    return still_waiting