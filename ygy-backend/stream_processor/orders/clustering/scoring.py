import time
from datetime import datetime
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
    주문 접수 이후 경과시간을 반영한 현재 남은 조리시간.
    created_at은 Oracle TIMESTAMP에서 조회된 datetime 객체.
    """
    elapsed_min = (
        datetime.now() - order["created_at"]
    ).total_seconds() / 60

    return max(
        order["base_cooking_min"] - elapsed_min,
        0
    )

def cluster_score(order, other):
    # 서로 다른 권역이면 애초에 묶일 수 없음 (매우 큰 페널티로 사실상 배제)
    if order.get("region") != other.get("region"):
        return float('inf')
        
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