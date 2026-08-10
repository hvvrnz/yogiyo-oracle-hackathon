from common.geo import haversine
from common.config import AVG_SPEED_KMH


def travel_time_minutes(pos1, pos2):
    distance = haversine(pos1[0], pos1[1], pos2[0], pos2[1])
    return (distance / AVG_SPEED_KMH) * 60


def calculate_route_score(route, orders_by_id, rider_start_pos):
    food_sitting_time = 0
    courier_wait_time = 0
    bag_time = 0
    current_time = 0
    current_pos = rider_start_pos
    picked_up_at = {}

    for order_id, visit_type in route:
        order = orders_by_id[order_id]
        target_pos = (order["store_lat"], order["store_lng"]) if visit_type == "pickup" \
            else (order["delivery_lat"], order["delivery_lng"])

        current_time += travel_time_minutes(current_pos, target_pos)
        current_pos = target_pos

        if visit_type == "pickup":
            cook_ready_min = order["base_cooking_min"]
            if current_time < cook_ready_min:
                courier_wait_time += (cook_ready_min - current_time)
                current_time = cook_ready_min
            else:
                food_sitting_time += (current_time - cook_ready_min)
            picked_up_at[order_id] = current_time
        else:
            bag_time += (current_time - picked_up_at[order_id])

    total_time = current_time
    score = (food_sitting_time * 2.0 + courier_wait_time * 1.0
             + bag_time * 1.5 + total_time * 0.1)

    return score, {
        "food_sitting_time": food_sitting_time,
        "courier_wait_time": courier_wait_time,
        "bag_time": bag_time,
        "total_time": total_time,
    }