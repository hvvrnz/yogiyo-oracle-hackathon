import os
import json
import random
from common.config import RIDER_COUNT, SERVICE_REGIONS, REGION_RIDER_WEIGHTS, RIDER_NAME_PREFIXES, RIDER_NAME_SUFFIXES


def generate_riders(count=RIDER_COUNT):
    riders = []
    region_names = list(REGION_RIDER_WEIGHTS.keys())
    weights = list(REGION_RIDER_WEIGHTS.values())

    for i in range(1, count + 1):
        region_name = random.choices(region_names, weights=weights, k=1)[0]
        region = SERVICE_REGIONS[region_name]
        name = random.choice(RIDER_NAME_PREFIXES) + random.choice(RIDER_NAME_SUFFIXES)
        riders.append({
            "rider_id": f"rider_{i}",
            "name": name,
            "region": region_name,
            "lat": region["lat"] + random.uniform(-0.01, 0.01),
            "lng": region["lng"] + random.uniform(-0.01, 0.01),
        })
    return riders

DUMMY_RIDERS = generate_riders()

_CACHE_PATH = os.path.join(os.path.dirname(__file__), "riders_generated.json")

if os.path.exists(_CACHE_PATH):
    with open(_CACHE_PATH, "r", encoding="utf-8") as f:
        DUMMY_RIDERS = json.load(f)
else:
    DUMMY_RIDERS = generate_riders()
    with open(_CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(DUMMY_RIDERS, f, ensure_ascii=False, indent=2)