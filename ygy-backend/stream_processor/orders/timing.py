# 이 주문의 조리시간이 아직 10분 넘게 남았다면, 좀 더 좋은 조합을 찾을 때까지 기다려도 된다는 판단 담당 def
from datetime import datetime
from common.config import ORDER_WAIT_BUFFER_MINUTES

def still_has_time(order):
    elapsed_min = (
        datetime.now() - order["created_at"]
    ).total_seconds() / 60

    remaining = order["base_cooking_min"] - elapsed_min

    return remaining > ORDER_WAIT_BUFFER_MINUTES