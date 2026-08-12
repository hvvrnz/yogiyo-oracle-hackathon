import json
import os
import random
from common.config.menu_data import CATEGORY_MENUS
from common.config import (
    STORE_COUNT, SERVICE_REGIONS, STORE_NAME_PREFIXES, STORE_MENU_COUNT_RANGE
)


def generate_stores(count=STORE_COUNT):
    stores = []
    region_names = list(SERVICE_REGIONS.keys())
    categories = list(CATEGORY_MENUS.keys())

    for i in range(1, count + 1):
        region_name = random.choice(region_names)
        region = SERVICE_REGIONS[region_name]
        category = random.choice(categories)
        signature_menu = random.choice(CATEGORY_MENUS[category])

        all_menus = CATEGORY_MENUS.get(category, [])
        menu_count = random.randint(*STORE_MENU_COUNT_RANGE)
        store_menu = random.sample(all_menus, min(menu_count, len(all_menus)))

        stores.append({
            "store_id": i,
            "name": f"{random.choice(STORE_NAME_PREFIXES)}{signature_menu} {region_name}{i}점",
            "category": category,
            "region": region_name,
            "lat": region["lat"] + random.uniform(-0.01, 0.01),
            "lng": region["lng"] + random.uniform(-0.01, 0.01),
            "menu": store_menu,
        })
    return stores


def get_random_menu(category):
    menus = CATEGORY_MENUS.get(category, ["대표메뉴"])
    return random.choice(menus)


DUMMY_STORES = generate_stores()

_CACHE_PATH = os.path.join(os.path.dirname(__file__), "stores_generated.json")

if os.path.exists(_CACHE_PATH):
    with open(_CACHE_PATH, "r", encoding="utf-8") as f:
        DUMMY_STORES = json.load(f)
else:
    DUMMY_STORES = generate_stores()
    with open(_CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(DUMMY_STORES, f, ensure_ascii=False, indent=2)