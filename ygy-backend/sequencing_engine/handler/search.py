from itertools import permutations
from sequencing_engine.handler.scoring import calculate_route_score, calculate_revenue
from common.config import MIN_ACCEPTABLE_HOURLY_REVENUE


def generate_valid_routes(order_ids):
    all_routes = []
    for pickup_order in permutations(order_ids):
        events = [(oid, "pickup") for oid in pickup_order]
        all_routes.extend(_insert_dropoffs(events, list(order_ids)))
    return all_routes


def _insert_dropoffs(events, order_ids, remaining_dropoffs=None):
    if remaining_dropoffs is None:
        remaining_dropoffs = list(order_ids)

    if not remaining_dropoffs:
        return [events]

    results = []
    for oid in remaining_dropoffs:
        last_pickup_index = max(i for i, e in enumerate(events) if e[0] == oid and e[1] == "pickup")
        for insert_pos in range(last_pickup_index + 1, len(events) + 1):
            new_events = events[:insert_pos] + [(oid, "dropoff")] + events[insert_pos:]
            new_remaining = [x for x in remaining_dropoffs if x != oid]
            results.extend(_insert_dropoffs(new_events, order_ids, new_remaining))
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