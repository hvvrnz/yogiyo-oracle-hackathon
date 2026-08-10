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