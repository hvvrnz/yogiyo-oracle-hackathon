# 현재 조리시간과 평균 조리시간을 대비하고 계산하여 매장의 혼잡도를 알려주는 def
# 지금 당장 쓸 데는 없음 — "평균 조리시간"을 추적하는 로직이 아직 없음. 추후에 매장 혼잡도 계산 로직을 구현할 때 사용될 예정

def calculate_congestion(current_cook_min, average_cook_min):
    ratio = current_cook_min / average_cook_min
    if ratio >= 1.3:
        return "HIGH"
    elif ratio >= 1.1:
        return "MEDIUM"
    else:
        return "LOW"