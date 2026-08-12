from sequencing_engine.handler.search import find_best_route, is_hourly_revenue_acceptable, calculate_solo_delivery
from sequencing_engine.handler.scoring import calculate_revenue
from sequencing_engine.repository.package_repo import insert_package
from sequencing_engine.repository.order_repo import insert_orders
from stream_processor.riders.geo_client import find_nearby_riders, get_rider_position, get_rider_info
from stream_processor.orders.timing import still_has_time
from common.config import MIN_ACCEPTABLE_HOURLY_REVENUE



def _build_route_detail(best_route):
    return [{"order_id": oid, "type": vtype} for oid, vtype in best_route]


def _build_score_detail(detail):
    return {
        "food_sitting_time": detail["food_sitting_time"],
        "courier_wait_time": detail["courier_wait_time"],
        "bag_time": detail["bag_time"],
        "total_time": detail["total_time"],
        "timeline": detail["timeline"],
    }


def assign_bundle(cluster, assigned_rider_ids):
    """
    클러스터(2건 이상 묶음) 하나를 받아서, 라이더 배정 + 경로 계산 + DB 저장까지 처리.
    성공하면 True, 실패(라이더 없음/수익 기준 미달)하면 False 반환.
    """
    rep_store_lat = cluster[0]["store_lat"]
    rep_store_lng = cluster[0]["store_lng"]
    nearby_riders = find_nearby_riders(rep_store_lat, rep_store_lng, radius_km=5)
    available_riders = [(rid, dist) for rid, dist in nearby_riders if rid not in assigned_rider_ids]

    if not available_riders:
        print(f"   ⚠ 근처에 배정 가능한 라이더 없음, 배차 불가")
        return False

    nearest_rider_id, nearest_dist = available_riders[0]
    assigned_rider_ids.add(nearest_rider_id)

    rider_start_pos = get_rider_position(nearest_rider_id)
    rider_info = get_rider_info(nearest_rider_id)

    best_route, best_score, best_detail = find_best_route(cluster, rider_start_pos)
    package_revenue, hourly_revenue = calculate_revenue(cluster, best_detail['total_time'])

    if not is_hourly_revenue_acceptable(hourly_revenue):
        print(f"   ⚠ 묶음 시간당 수익({hourly_revenue:,.0f}원)이 "
              f"최소 기준({MIN_ACCEPTABLE_HOURLY_REVENUE:,.0f}원)보다 낮음 — 묶음 취소")
        assigned_rider_ids.discard(nearest_rider_id)
        return False

    order_ids = [o["order_id"] for o in cluster]
    package_id = insert_package(
        rider_id=nearest_rider_id,
        package_type="BUNDLE",
        order_ids=order_ids,
        route_detail=_build_route_detail(best_route),
        score=best_score,
        score_detail=_build_score_detail(best_detail),
        package_revenue=package_revenue,
        hourly_revenue=hourly_revenue,
    )
    insert_orders(cluster, package_id=package_id)

    rider_name = rider_info["name"] if rider_info else "이름없음"
    rider_region = rider_info["region"] if rider_info else "권역미상"
    print(f"   🏍 배정 라이더: {nearest_rider_id} ({rider_name}, {rider_region} 권역) — {float(nearest_dist):.2f}km")
    print(f"   💰 예상 수익: {package_revenue:,.0f}원 (시간당 {hourly_revenue:,.0f}원)")
    print(f"   ⭐ score: {best_score:.2f}")
    print(f"   💾 DB 저장 완료")
    return True


def assign_solo(order, assigned_rider_ids):
    """
    단건 주문(한집배달) 하나를 받아서, 라이더 배정 + 계산 + DB 저장까지 처리.
    """
    nearby_riders = find_nearby_riders(order["store_lat"], order["store_lng"], radius_km=5)
    available_riders = [(rid, dist) for rid, dist in nearby_riders if rid not in assigned_rider_ids]

    if not available_riders:
        print(f"   ⚠ 근처에 배정 가능한 라이더 없음")
        return False

    nearest_rider_id, nearest_dist = available_riders[0]
    assigned_rider_ids.add(nearest_rider_id)
    rider_start_pos = get_rider_position(nearest_rider_id)
    rider_info = get_rider_info(nearest_rider_id)

    route, score, detail = calculate_solo_delivery(order, rider_start_pos)
    revenue, hourly = calculate_revenue([order], detail['total_time'])

    package_id = insert_package(
        rider_id=nearest_rider_id,
        package_type="SOLO",
        order_ids=[order["order_id"]],
        route_detail=_build_route_detail(route),
        score=score,
        score_detail=_build_score_detail(detail),
        package_revenue=revenue,
        hourly_revenue=hourly,
    )
    insert_orders([order], package_id=package_id)

    rider_name = rider_info["name"] if rider_info else "이름없음"
    print(f"   🏍 배정 라이더: {nearest_rider_id} ({rider_name}) — {float(nearest_dist):.2f}km")
    print(f"   💰 예상 수익: {revenue:,.0f}원 (시간당 {hourly:,.0f}원)")
    print(f"   💾 DB 저장 완료")
    return True


def process_clusters(clusters):
    assigned_rider_ids = set()
    rejected_orders = []

    for i, cluster in enumerate(clusters, 1):
        names = ', '.join(f"{o['store_name']}({o.get('menu_name','?')})" for o in cluster)
        print(f"\n✅ 묶음 #{i} 확정 시도: {names}")
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

    return still_waiting