from db.connection import fetch_all, fetch_one, execute_and_commit
from vector_search.handler.embedding import embed_situation


def get_cases_by_time_slot(store_id, weekday, time_slot):
    """
    이 매장의 (요일, 시간대) 조합에서, 과거 실제 조리시간 기록을 조회.
    """
    return fetch_all("""
        SELECT actual_cook_time FROM vector_cases
        WHERE store_id = :store_id AND weekday = :weekday AND time_slot = :time_slot
    """, {"store_id": store_id, "weekday": weekday, "time_slot": time_slot})


def get_store_average(store_id):
    """
    이 매장의 전체 평균 조리시간(시간대 구분 없이) - '평소' 기준값.
    """
    result = fetch_one("""
        SELECT AVG(actual_cook_time) as avg_time FROM vector_cases
        WHERE store_id = :store_id
    """, {"store_id": store_id})
    return result["avg_time"] if result else None

def insert_case(store_id, weekday, time_slot, concurrent_order_count, actual_cook_time, embedding_str):
    """
    과거 조리시간 이력 + 임베딩 벡터를 하나 저장.
    """
    execute_and_commit("""
        INSERT INTO vector_cases 
        (store_id, weekday, time_slot, concurrent_order_count, actual_cook_time, embedding)
        VALUES (:store_id, :weekday, :time_slot, :concurrent, :cook_time, TO_VECTOR(:embedding_str))
    """, {
        "store_id": store_id, "weekday": weekday, "time_slot": time_slot,
        "concurrent": concurrent_order_count, "cook_time": actual_cook_time,
        "embedding_str": embedding_str
    })

def get_similar_stores_data(store_id, category, weekday, time_slot):
    """
    이 매장 데이터가 없을 때, 같은 카테고리+비슷한 상황의 
    다른 매장 벡터를 찾아서 대신 사용.
    """
    current_vec = embed_situation(store_id, weekday, time_slot, 0)
    embedding_str = "[" + ",".join(str(x) for x in current_vec) + "]"

    return fetch_all("""
        SELECT vc.actual_cook_time,
               VECTOR_DISTANCE(vc.embedding, TO_VECTOR(:embedding_str), COSINE) as distance
        FROM vector_cases vc
        JOIN stores s ON vc.store_id = s.store_id
        WHERE s.category = :category
        ORDER BY distance ASC
        FETCH FIRST 10 ROWS ONLY
    """, {"embedding_str": embedding_str, "category": category})


def get_similar_cases_by_category(category, weekday, time_slot, radius_km=2.0):
    """
    1단계: 같은 카테고리(또는 프랜차이즈/동종업계), 반경 내 매장들의 
    비슷한 상황 벡터 검색.
    """
    dummy_vec = embed_situation(0, weekday, time_slot, 0)
    embedding_str = "[" + ",".join(str(x) for x in dummy_vec) + "]"

    return fetch_all("""
        SELECT vc.actual_cook_time, s.name,
               VECTOR_DISTANCE(vc.embedding, TO_VECTOR(:embedding_str), COSINE) as distance
        FROM vector_cases vc
        JOIN stores s ON vc.store_id = s.store_id
        WHERE s.category = :category
        ORDER BY distance ASC
        FETCH FIRST 10 ROWS ONLY
    """, {"embedding_str": embedding_str, "category": category})


def get_similar_cases_expanded(weekday, time_slot):
    """
    2단계: 카테고리 무시하고, 전체 매장 중 비슷한 상황 벡터 검색 
    (반경/카테고리로도 못 찾았을 때 최종 fallback).
    """
    dummy_vec = embed_situation(0, weekday, time_slot, 0)
    embedding_str = "[" + ",".join(str(x) for x in dummy_vec) + "]"

    return fetch_all("""
        SELECT vc.actual_cook_time,
               VECTOR_DISTANCE(vc.embedding, TO_VECTOR(:embedding_str), COSINE) as distance
        FROM vector_cases vc
        ORDER BY distance ASC
        FETCH FIRST 10 ROWS ONLY
    """, {"embedding_str": embedding_str})


    
# 브랜드(이름 패턴) 기준 검색. same_region으로 지역 일치 여부를 필터링.
def get_similar_cases_by_brand(brand_keyword, region, weekday, time_slot, same_region=True):
    dummy_vec = embed_situation(0, weekday, time_slot, 0)
    embedding_str = "[" + ",".join(str(x) for x in dummy_vec) + "]"

    region_condition = "s.region = :region" if same_region else "s.region != :region"

    return fetch_all(f"""
        SELECT vc.actual_cook_time, s.name,
               VECTOR_DISTANCE(vc.embedding, TO_VECTOR(:embedding_str), COSINE) as distance
        FROM vector_cases vc
        JOIN stores s ON vc.store_id = s.store_id
        WHERE s.name LIKE :pattern AND {region_condition}
        ORDER BY distance ASC
        FETCH FIRST 10 ROWS ONLY
    """, {"embedding_str": embedding_str, "pattern": f"%{brand_keyword}%", "region": region})

def get_similar_cases_by_region_category(region, category, weekday, time_slot):
    """
    3단계: 같은 지역 + 같은 카테고리(다른 브랜드) 매장들의 유사 사례.
    """
    dummy_vec = embed_situation(0, weekday, time_slot, 0)
    embedding_str = "[" + ",".join(str(x) for x in dummy_vec) + "]"

    return fetch_all("""
        SELECT vc.actual_cook_time, s.name,
               VECTOR_DISTANCE(vc.embedding, TO_VECTOR(:embedding_str), COSINE) as distance
        FROM vector_cases vc
        JOIN stores s ON vc.store_id = s.store_id
        WHERE s.region = :region AND s.category = :category
        ORDER BY distance ASC
        FETCH FIRST 10 ROWS ONLY
    """, {"embedding_str": embedding_str, "region": region, "category": category})

