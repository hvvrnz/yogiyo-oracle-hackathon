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


def _build_route_detail(best_route, orders_by_id):
    detail = []
    for oid, vtype in best_route:
        order = orders_by_id[oid]
        if vtype == "pickup":
            lat, lng = order["store_lat"], order["store_lng"]
        else:
            lat, lng = order["delivery_lat"], order["delivery_lng"]
        detail.append({
            "order_id": oid,
            "type": vtype,
            "lat": lat,
            "lng": lng,
        })
    return detail


def _build_score_detail(detail):
    return {
        "food_sitting_time": round(detail["food_sitting_time"], 1),
        "courier_wait_time": round(detail["courier_wait_time"], 1),
        "bag_time": round(detail["bag_time"], 1),
        "total_time": round(detail["total_time"], 1),
        "timeline": detail["timeline"],
    }


def _get_available_riders(store_lat, store_lng, assigned_rider_ids, radius_km=5):
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
        print(f"   ✗ 수익 기준 미달, 배차 취소: 시간당 {round(hourly_revenue)}원 (기준 {MIN_ACCEPTABLE_HOURLY_REVENUE}원)")
        return False

    order_ids = [o["order_id"] for o in cluster]
    orders_by_id = {o["order_id"]: o for o in cluster}

    print_route_timeline(best_detail, orders_by_id)
    print_consumer_eta(best_detail, orders_by_id)

    package_id = insert_package(
        rider_id=None,
        package_type="BUNDLE",
        order_ids=order_ids,
        route_detail=_build_route_detail(best_route, orders_by_id),
        score=round(best_score, 2),
        score_detail=_build_score_detail(best_detail),
        package_revenue=package_revenue,
        hourly_revenue=hourly_revenue,
        status="OFFERED",
    )
    insert_orders(cluster, package_id=package_id, status="OFFERED")
    assigned_rider_ids.add(nearest_rider_id)
    print(f"   📢 제안됨 (수락 대기 중): package_id={package_id}, 후보 라이더={nearest_rider_id}")
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

    orders_by_id = {order["order_id"]: order}

    print_route_timeline(detail, orders_by_id)
    print_consumer_eta(detail, orders_by_id)

    package_id = insert_package(
        rider_id=None,
        package_type="SOLO",
        order_ids=[order["order_id"]],
        route_detail=_build_route_detail(route, orders_by_id),
        score=round(score, 2),
        score_detail=_build_score_detail(detail),
        package_revenue=revenue,
        hourly_revenue=hourly,
        status="OFFERED",
    )
    insert_orders([order], package_id=package_id, status="OFFERED")
    assigned_rider_ids.add(nearest_rider_id)

    print(f"   📢 한집배달 제안됨 (수락 대기 중): package_id={package_id}, 후보 라이더={nearest_rider_id}")
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