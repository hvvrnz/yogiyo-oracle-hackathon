import random
from common.geo import get_region
from common.config import (
    STORE_COUNT, SERVICE_REGIONS, STORE_NAME_PREFIXES,
    CATEGORY_MENUS, CATEGORY_COOK_TIME_RANGE, COOK_TIME_STEP_MINUTES, COOK_TIME_MIN, COOK_TIME_MAX
)

# 사장님이 실제로 설정 가능한 5분 단위 값으로 반올림.
def round_to_step(value, step, min_val, max_val):
    rounded = round(value / step) * step
    return max(min_val, min(rounded, max_val))

def generate_stores(count=STORE_COUNT):
    stores = []
    region_names = list(SERVICE_REGIONS.keys())
    categories = list(CATEGORY_MENUS.keys())

    for i in range(1, count + 1):
        region_name = random.choice(region_names)
        region = SERVICE_REGIONS[region_name]
        category = random.choice(categories)
        cook_min_range = CATEGORY_COOK_TIME_RANGE.get(category, (10, 20))
        raw_cook_time = random.randint(*cook_min_range)
        cook_time = round_to_step(raw_cook_time, COOK_TIME_STEP_MINUTES, COOK_TIME_MIN, COOK_TIME_MAX)
        signature_menu = random.choice(CATEGORY_MENUS[category])

        stores.append({
            "store_id": i,
            "name": f"{random.choice(STORE_NAME_PREFIXES)}{signature_menu} {region_name}{i}점",
            "category": category,
            "region": region_name,
            "lat": region["lat"] + random.uniform(-0.01, 0.01),
            "lng": region["lng"] + random.uniform(-0.01, 0.01),
            "base_cooking_min": cook_time,   # 사장님이 설정한 값 (5분 단위)
        })
    return stores


def get_random_menu(category):
    menus = CATEGORY_MENUS.get(category, ["대표메뉴"])
    return random.choice(menus)


DUMMY_STORES = generate_stores()