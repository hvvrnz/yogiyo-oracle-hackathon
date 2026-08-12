# 예: round_to_unit(18347, 1000) -> 18000
# round_to_unit(4892, 100) -> 4900


def round_to_unit(value, unit):
    return round(value / unit) * unit