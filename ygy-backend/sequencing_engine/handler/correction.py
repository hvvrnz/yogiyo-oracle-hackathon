from common.config import CATEGORY_CORRECTION_FACTORS, DEFAULT_CORRECTION_FACTOR


def get_correction_factor(category):
    """
    카테고리 기준으로 보정계수를 조회. 없으면 기본값(1.0, 보정 없음).
    실제로는 store → brand → category → global 순으로 fallback 하지만,
    지금 프로토타입은 category → global(1.0) 2단계만 구현.
    """
    return CATEGORY_CORRECTION_FACTORS.get(category, DEFAULT_CORRECTION_FACTOR)


def predict_cook_time(order):
    """
    사장님이 설정한 base_cooking_min에 보정계수를 곱해,
    시스템이 예측하는 실제 조리시간을 계산.
    """
    factor = get_correction_factor(order.get("category", ""))
    return order["base_cooking_min"] * factor