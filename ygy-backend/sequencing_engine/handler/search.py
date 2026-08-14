from itertools import permutations
from sequencing_engine.handler.scoring import calculate_route_score, calculate_revenue
from common.config import MIN_ACCEPTABLE_HOURLY_REVENUE


def generate_valid_routes(order_ids):
    """
    n건 주문의 pickup+dropoff 유효한 전체 순서를 모두 생성.
    n=3이면 정확히 90가지, 중복 없이 생성됨.
    """
    return _build_sequences([], list(order_ids), list(order_ids))


def _build_sequences(events, remaining_pickups, remaining_dropoffs):
    if not remaining_pickups and not remaining_dropoffs:
        return [events]

    results = []
    # 아직 픽업 안 한 주문은 지금 픽업 가능
    for oid in remaining_pickups:
        new_events = events + [(oid, "pickup")]
        new_pickups = [x for x in remaining_pickups if x != oid]
        results.extend(_build_sequences(new_events, new_pickups, remaining_dropoffs))

    # 이미 픽업했고 아직 배달 안 한 주문은 지금 배달 가능
    picked_ids = {oid for oid, t in events if t == "pickup"} - {oid for oid, t in events if t == "dropoff"}
    for oid in picked_ids:
        if oid in remaining_dropoffs:
            new_events = events + [(oid, "dropoff")]
            new_dropoffs = [x for x in remaining_dropoffs if x != oid]
            results.extend(_build_sequences(new_events, remaining_pickups, new_dropoffs))

    return results


def find_best_route(cluster_orders, rider_start_pos):
    orders_by_id = {o["order_id"]: o for o in cluster_orders}
    order_ids = list(orders_by_id.keys())

    routes = generate_valid_routes(order_ids)

    best_route = None
    best_score = None
    best_detail = None

    for route in routes:
        score, detail = calculate_route_score(route, orders_by_id, rider_start_pos)
        if best_score is None or score < best_score:
            best_score = score
            best_route = route
            best_detail = detail

    return best_route, best_score, best_detail


def calculate_solo_delivery(order, rider_start_pos):
    """
    묶음이 아니라 단건(한집배달)일 때의 경로/시간 계산.
    """
    route = [(order["order_id"], "pickup"), (order["order_id"], "dropoff")]
    orders_by_id = {order["order_id"]: order}
    score, detail = calculate_route_score(route, orders_by_id, rider_start_pos)
    return route, score, detail

def is_hourly_revenue_acceptable(hourly_revenue):
    """
    이 묶음(또는 단건)의 시간당 수익이, 라이더가 받아들일 만한
    최소 기준(MIN_ACCEPTABLE_HOURLY_REVENUE)을 넘는지 판단.
    현재는 20,000원
    """
    return hourly_revenue >= MIN_ACCEPTABLE_HOURLY_REVENUE