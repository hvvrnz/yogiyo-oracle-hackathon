import random
from vector_search.handler.embedding import embed_situation
from vector_search.repository.vector_case_repo import insert_case

TARGET_STORE_IDS = [355, 926, 124, 893]
FRIDAY = 4
TIME_SLOT = "저녁"

COOK_TIME_BASE = {
    355: 33,  # 같은지역(강남)+같은브랜드(요기요햄버거) - 1단계
    926: 31,  # 다른지역(신림)+같은브랜드(요기요햄버거) - 2단계
    124: 28,  # 같은지역(강남)+다른브랜드(버거퀸) - 3단계
    893: 32,  # 다른지역(신림)+다른브랜드(버거퀸) - 4단계
} 


def generate():
    for store_id in TARGET_STORE_IDS:
        base = COOK_TIME_BASE[store_id]
        for _ in range(15):
            concurrent = random.randint(0, 5)
            cook_time = base + random.randint(-3, 5)

            embedding = embed_situation(store_id, FRIDAY, TIME_SLOT, concurrent)
            embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

            insert_case(store_id, FRIDAY, TIME_SLOT, concurrent, cook_time, embedding_str)
        print(f"store_id : {store_id} 완료 (15건)")

    print("전체 더미 이력 + 임베딩 생성 완료")


if __name__ == "__main__":
    generate()