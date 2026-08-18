from vector_search.repository.vector_case_repo import (
    get_cases_by_time_slot, get_store_average,
    get_similar_cases_by_brand, get_similar_cases_by_category, get_similar_cases_expanded
)


BUSY_THRESHOLD_RATIO = 1.3 # 1.3배 = 30% 이상 더 걸리면 


def build_congestion_notice(store_id, weekday, time_slot):
    baseline = get_store_average(store_id)
    cases = get_cases_by_time_slot(store_id, weekday, time_slot)

    if not baseline or not cases:
        return None

    times = [c["actual_cook_time"] for c in cases]
    current_avg = round(sum(times) / len(times), 1)
    baseline = round(baseline, 1)

    if current_avg / baseline >= BUSY_THRESHOLD_RATIO: # ex) 32/24 = 1.33 → 1.3보다 크니까 "바쁨"
        return (
            f"🍳 이 매장은 이 시간대에 평소보다 오래 걸리는 경향이 있어요. "
            f"(과거 {len(times)}건 평균 {current_avg}분, 평소는 {baseline}분) "
            f"참고하셔도 되고, 직접 입력하셔도 됩니다."
        )
    return None


def build_congestion_data(store_id, brand_keyword, region, category, weekday, time_slot):
    baseline = get_store_average(store_id)

    if not baseline:
        cases = get_similar_cases_by_brand(brand_keyword, region, weekday, time_slot, same_region=True)
        source = f"같은 지역({region}) 내 같은 브랜드({brand_keyword})"

        if not cases:
            cases = get_similar_cases_by_brand(brand_keyword, region, weekday, time_slot, same_region=False)
            source = f"다른 지역, 같은 브랜드({brand_keyword})"

        if not cases:
            cases = get_similar_cases_by_region_category(region, category, weekday, time_slot)
            source = f"같은 지역({region}), 비슷한 업종({category})"

        if not cases:
            cases = get_similar_cases_by_category(category, weekday, time_slot)
            source = f"비슷한 업종({category}) 전체"

        if not cases:
            cases = get_similar_cases_expanded(weekday, time_slot)
            source = "전체 매장 평균 패턴"

        if not cases:
            return {"case": "NO_DATA"}

        times = [c["actual_cook_time"] for c in cases]
        avg = round(sum(times) / len(times), 1)
        return {"case": "NEW_STORE", "similar_avg_cook_min": avg, "sample_count": len(times), "notice_source": source}
