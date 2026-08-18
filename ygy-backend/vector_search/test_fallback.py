"""
889(요기요햄버거 강남점) 신규매장 fallback 4단계 테스트 스크립트.
"""
from vector_search.repository.vector_case_repo import (
    get_similar_cases_by_brand,
    get_similar_cases_by_region_category,
    get_similar_cases_by_category,
)


def print_result(title, cases):
    print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"{title}")
    print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━")
    if not cases:
        print("검색 결과 없음")
        print()
        return

    times = [c["actual_cook_time"] for c in cases]
    print(f"검색된 과거 사례: {len(cases)}건")
    print(f"평균 조리시간: {round(sum(times)/len(times), 1)}분")
    print(f"가장 유사한 사례 Top 3:")
    for i, c in enumerate(cases[:3], 1):
        print(f"  {i}위. {c['name']} - 조리시간 {c['actual_cook_time']}분 "
              f"(유사도 거리: {round(c['distance'], 4)})")
    print()


if __name__ == "__main__":
    # 1단계: 같은 지역(강남) + 같은 브랜드(요기요햄버거)  -> 355
    cases1 = get_similar_cases_by_brand("요기요햄버거", "강남", 4, "저녁", same_region=True)
    print_result("1단계: 강남지역 - 요기요햄버거🍔 (같은지역,같은브랜드)", cases1)

    # 2단계: 다른 지역 + 같은 브랜드(요기요햄버거)  -> 926
    cases2 = get_similar_cases_by_brand("요기요햄버거", "강남", 4, "저녁", same_region=False)
    print_result("2단계: 신림지역 - 요기요햄버거🍔 (다른지역,같은브랜드)", cases2)

    # 3단계: 같은 지역(강남) + 같은 카테고리(버거류), 다른 브랜드  -> 124
    cases3 = get_similar_cases_by_region_category("강남", "버거류", 4, "저녁")
    print_result("3단계: 강남지역(버거류) - 버거퀸👑(같은지역,같은카테고리)", cases3)

    # 4단계: 카테고리(버거류) 전체 (지역 무관)  -> 893 포함
    cases4 = get_similar_cases_by_category("버거류", 4, "저녁")
    print_result("4단계: (버거류) - 버거퀸👑(다른지역,같은카테고리)", cases4)