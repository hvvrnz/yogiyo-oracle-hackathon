from kafka import KafkaProducer
import json
import time
import random
from common.dummy.stores import DUMMY_STORES as stores
from common.rounding import round_to_unit
from common.config.menu_data import CATEGORY_MENU_PRICE_RANGE, SIDE_MENUS
from common.config import (
    CATEGORY_COOK_TIME_RANGE, COOK_TIME_STEP_MINUTES,
    COOK_TIME_MIN, COOK_TIME_MAX, DELIVERY_DISTANCE_RANGE_DEGREES,
    DELIVERY_FEE_BASE, CATEGORY_CORRECTION_FACTORS, DEFAULT_CORRECTION_FACTOR
)


producer = KafkaProducer(
    bootstrap_servers='localhost:9092',
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)


def round_to_step(value, step, min_val, max_val):
    rounded = round(value / step) * step
    return max(min_val, min(rounded, max_val))


def generate_menu_items(store):
    category = store["category"]
    price_range = CATEGORY_MENU_PRICE_RANGE.get(category, (8000, 15000))
    side_menus = SIDE_MENUS.get(category, [])

    items = []
    main_menu = random.choice(store["menu"])
    items.append({
        "menu": main_menu,
        "qty": 1,
        "price": round_to_unit(random.randint(*price_range), 1000),
    })

    side_count = random.randint(0, min(3, len(side_menus)))
    for side in random.sample(side_menus, side_count):
        items.append({
            "menu": side,
            "qty": random.randint(1, 2),
            "price": round_to_unit(random.randint(2000, 6000), 1000),
        })

    return items


def generate_dummy_order(order_id):
    store = random.choice(stores)
    cook_min_range = CATEGORY_COOK_TIME_RANGE.get(store["category"], (10, 20))
    raw_cook_time = random.randint(*cook_min_range)
    cook_time = round_to_step(raw_cook_time, COOK_TIME_STEP_MINUTES, COOK_TIME_MIN, COOK_TIME_MAX)

    factor = CATEGORY_CORRECTION_FACTORS.get(store["category"], DEFAULT_CORRECTION_FACTOR)
    predicted_cook_min = round(cook_time * factor, 1)

    menu_items = generate_menu_items(store)
    amount = sum(item["price"] * item["qty"] for item in menu_items)

    return {
        "order_id": order_id,
        "store_id": store["store_id"],
        "store_name": store["name"],
        "category": store["category"],
        "region": store["region"],
        "menu_name": menu_items[0]["menu"],
        "menu_items": menu_items,
        "amount": amount,
        "delivery_fee": DELIVERY_FEE_BASE,
        "store_lat": store["lat"],
        "store_lng": store["lng"],
        "base_cooking_min": cook_time,
        "predicted_cook_min": predicted_cook_min,
        "delivery_lat": store["lat"] + random.uniform(-DELIVERY_DISTANCE_RANGE_DEGREES, DELIVERY_DISTANCE_RANGE_DEGREES),
        "delivery_lng": store["lng"] + random.uniform(-DELIVERY_DISTANCE_RANGE_DEGREES, DELIVERY_DISTANCE_RANGE_DEGREES),
        "created_at": time.time()
    }


if __name__ == "__main__":
    order_id = 1
    try:
        while True:
            order = generate_dummy_order(order_id)
            producer.send('order-events', order)
            print(f"주문 전송: {order}")
            order_id += 1
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nProducer 종료")
        producer.flush()