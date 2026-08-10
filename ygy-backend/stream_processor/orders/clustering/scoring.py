import time
from common.geo import haversine
from common.config import (
    FOOD_CATEGORY_URGENCY, UrgencyLevel,
    AVG_SPEED_KMH, URGENCY_MISMATCH_PENALTY_KM
)
from itertools import combinations


def get_urgency(category):
    return FOOD_CATEGORY_URGENCY.get(category, UrgencyLevel.MODERATE)


def remaining_cook_time(order):
    """
    주문 접수 이후 시간이 흐른 만큼을 반영해, '지금 이 순간' 남은 조리시간을 계산.
    이미 조리 완료됐을 경우 0으로 처리.
    """
    elapsed_min = (time.time() - order["created_at"]) / 60
    return max(order["base_cooking_min"] - elapsed_min, 0)


def cluster_score(order, other):
    store_distance = haversine(order["store_lat"], order["store_lng"],
                                other["store_lat"], other["store_lng"])
    delivery_distance = haversine(order["delivery_lat"], order["delivery_lng"],
                                   other["delivery_lat"], other["delivery_lng"])

    cross_distance_1 = haversine(order["store_lat"], order["store_lng"],
                                  other["delivery_lat"], other["delivery_lng"])
    cross_distance_2 = haversine(other["store_lat"], other["store_lng"],
                                  order["delivery_lat"], order["delivery_lng"])
    cross_distance = (cross_distance_1 + cross_distance_2) / 2

    # base_cooking_min(고정값) 대신, 지금 이 순간 실제로 남은 조리시간을 비교
    order_remaining = remaining_cook_time(order)
    other_remaining = remaining_cook_time(other)
    cook_time_diff_min = abs(order_remaining - other_remaining)
    cook_time_diff_km_equiv = (cook_time_diff_min / 60) * AVG_SPEED_KMH

    order_urgency = get_urgency(order.get("category", ""))
    other_urgency = get_urgency(other.get("category", ""))
    urgency_penalty = 0 if order_urgency == other_urgency else URGENCY_MISMATCH_PENALTY_KM

    return store_distance + delivery_distance + cross_distance + cook_time_diff_km_equiv + urgency_penalty


def group_score(group):
    total = 0
    for a, b in combinations(group, 2):
        total += cluster_score(a, b)
    return total