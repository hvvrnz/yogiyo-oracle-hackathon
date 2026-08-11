from common.geo import haversine
from common.config import (
    AVG_SPEED_KMH, BASE_DELIVERY_FEE, PER_KM_EXTRA_FEE,
    WEIGHT_FOOD_SITTING_TIME, WEIGHT_COURIER_WAIT_TIME,
    WEIGHT_BAG_TIME, WEIGHT_TOTAL_TIME
)
from sequencing_engine.handler.correction import predict_cook_time

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
    timeline = []  # 각 단계별 상세 기록

    for order_id, visit_type in route:
        order = orders_by_id[order_id]
        target_pos = (order["store_lat"], order["store_lng"]) if visit_type == "pickup" \
            else (order["delivery_lat"], order["delivery_lng"])

        move_time = travel_time_minutes(current_pos, target_pos)
        current_time += move_time
        arrival_time = current_time   # ← 진짜 도착 시각을 여기서 따로 저장
        current_pos = target_pos

        step_wait = 0
        step_food_sitting = 0
        step_bag = 0

        if visit_type == "pickup":
            owner_cook_min = order["base_cooking_min"]
            cook_ready_min = predict_cook_time(order)
            if current_time < cook_ready_min:
                step_wait = cook_ready_min - current_time
                courier_wait_time += step_wait
                current_time = cook_ready_min
            else:
                step_food_sitting = current_time - cook_ready_min
                food_sitting_time += step_food_sitting
            picked_up_at[order_id] = current_time
        else:
            step_bag = current_time - picked_up_at[order_id]
            bag_time += step_bag

        timeline.append({
            "order_id": order_id,
            "type": visit_type,
            "move_time_min": round(move_time, 1),
            "arrival_time_min": round(arrival_time, 1),   # ← 진짜 도착 시각 사용
            "owner_cook_min": order["base_cooking_min"] if visit_type == "pickup" else None,
            "predicted_cook_min": round(predict_cook_time(order), 1) if visit_type == "pickup" else None,
            "wait_min": round(step_wait, 1),
            "food_sitting_min": round(step_food_sitting, 1),
            "bag_min": round(step_bag, 1),
        })

    total_time = current_time
    score = (food_sitting_time * WEIGHT_FOOD_SITTING_TIME
         + courier_wait_time * WEIGHT_COURIER_WAIT_TIME
         + bag_time * WEIGHT_BAG_TIME
         + total_time * WEIGHT_TOTAL_TIME)

    return score, {
        "food_sitting_time": food_sitting_time,
        "courier_wait_time": courier_wait_time,
        "bag_time": bag_time,
        "total_time": total_time,
        "timeline": timeline,
    }


# 거리 기반 배달비 계산 (기본요금 + 1km 초과분에 대한 km당 추가요금)
def calculate_order_fee(distance_km):
    extra_distance = max(distance_km - 1, 0)
    return BASE_DELIVERY_FEE + (extra_distance * PER_KM_EXTRA_FEE)


# 묶음 안 각 주문의 실제 배달 거리를 기반으로 총 수익과 시간당 환산 수익을 계산.
def calculate_revenue(cluster_orders, total_time_minutes):
    total_revenue = 0
    for order in cluster_orders:
        distance = haversine(order["store_lat"], order["store_lng"],
                              order["delivery_lat"], order["delivery_lng"])
        total_revenue += calculate_order_fee(distance)

    if total_time_minutes <= 0:
        return total_revenue, 0
    hourly_revenue = (total_revenue / total_time_minutes) * 60
    return total_revenue, hourly_revenue