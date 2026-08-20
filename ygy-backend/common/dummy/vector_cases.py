"""
889(요기요햄버거) 브랜드 fallback 검증용 vector_cases 시딩.

메뉴별 조리시간은 MENU_COOK_MIN에 직접 정의한다. 이 값은 실제 서비스라면
"주문 전체 조리시간 + 메뉴 구성" 데이터가 충분히 쌓였을 때 회귀분석으로
역산되는 개별 메뉴 기여도 계수를 데모용으로 미리 대입해둔 것이다.

한 주문에 여러 메뉴가 섞이면, 동시조리 가정 하에 가장 오래 걸리는 메뉴가
전체 조리시간을 대표한다.
"""
import random
from vector_search.handler.embedding import embed_situation
from vector_search.repository.vector_case_repo import insert_case

TARGET_STORE_IDS = [355, 306, 803, 926, 592, 940, 235, 385, 478, 112, 202, 124]
FRIDAY = 4
TIME_SLOT = "저녁"
CASES_PER_STORE = 15

MENU_COOK_MIN = {
    "치즈버거": 12, "불고기버거": 12, "새우버거": 13, "더블패티버거": 16,
    "베이컨버거": 12, "치킨버거": 12, "매운치킨버거": 14, "포테이토버거": 12,
    "아보카도버거": 13, "트러플버거": 16,
    "치즈버거세트": 14, "불고기버거세트": 14, "새우버거세트": 15, "더블패티버거세트": 18,
    "베이컨버거세트": 14, "치킨버거세트": 14, "매운치킨버거세트": 16, "트러플버거세트": 18,
    "감자튀김": 5, "치즈스틱": 5, "어니언링": 5, "치킨너겟": 6,
    "코울슬로": 1, "콘샐러드": 1,
    "콜라": 0.5, "제로콜라": 0.5, "사이다": 0.5, "아이스티": 0.5,
    "밀크쉐이크": 4, "스무디": 5, "아메리카노": 3, "라떼": 4,
}
MENUS = list(MENU_COOK_MIN.keys())
QTY_CHOICES = [1, 1, 1, 1, 2, 2, 3]


def item_cook_time(menu, qty):
    base = MENU_COOK_MIN[menu]
    jitter = random.uniform(-1, 1.5)
    qty_extra = (qty - 1) * base * 0.15
    return max(0.5, base + jitter + qty_extra)


def random_order_items():
    items = [random.choice(MENUS)]
    extra_count = random.choice([0, 1, 1, 2])
    for _ in range(extra_count):
        items.append(random.choice(MENUS))
    return items


def generate():
    for store_id in TARGET_STORE_IDS:
        for _ in range(CASES_PER_STORE):
            concurrent = random.randint(0, 5)
            order_items = random_order_items()

            timed = []
            for name in order_items:
                qty = random.choice(QTY_CHOICES)
                timed.append((name, item_cook_time(name, qty), qty))

            slowest_name, cook_time, slowest_qty = max(timed, key=lambda t: t[1])
            cook_time = round(cook_time, 1)

            other_count = len(timed) - 1
            menu_label = f"{slowest_name} {slowest_qty}개" + (f" 외 {other_count}개" if other_count else "")

            embedding = embed_situation(store_id, FRIDAY, TIME_SLOT, concurrent, menu_label)
            embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

            insert_case(store_id, FRIDAY, TIME_SLOT, concurrent, cook_time, embedding_str, menu_name=menu_label)

        print(f"store_id : {store_id} 완료 ({CASES_PER_STORE}건)")

    print("전체 더미 이력 + 임베딩 생성 완료")


if __name__ == "__main__":
    generate()