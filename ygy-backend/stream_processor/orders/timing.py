# 이 주문의 조리시간이 아직 5분 넘게 남았다면, 좀 더 좋은 조합을 찾을 때까지 기다려도 된다는 판단 담당 def
import time


def still_has_time(order, buffer_minutes=5):
    elapsed_min = (time.time() - order["created_at"]) / 60
    remaining = order["base_cooking_min"] - elapsed_min
    return remaining > buffer_minutes