from db.connection import fetch_all, fetch_one, execute_and_commit
from vector_search.handler.embedding import embed_situation


def get_cases_by_time_slot(store_id, weekday, time_slot):
    return fetch_all("""
        SELECT actual_cook_time FROM vector_cases
        WHERE store_id = :store_id AND weekday = :weekday AND time_slot = :time_slot
    """, {"store_id": store_id, "weekday": weekday, "time_slot": time_slot})


def get_store_average(store_id):
    result = fetch_one("""
        SELECT AVG(actual_cook_time) as avg_time FROM vector_cases
        WHERE store_id = :store_id
    """, {"store_id": store_id})
    return result["avg_time"] if result else None


def insert_case(store_id, weekday, time_slot, concurrent_order_count, actual_cook_time, embedding_str, menu_name=None):
    """
    과거 조리시간 이력 + 임베딩 벡터를 하나 저장.
    """
    execute_and_commit("""
        INSERT INTO vector_cases 
        (store_id, weekday, time_slot, concurrent_order_count, actual_cook_time, menu_name, embedding)
        VALUES (:store_id, :weekday, :time_slot, :concurrent, :cook_time, :menu_name, TO_VECTOR(:embedding_str))
    """, {
        "store_id": store_id, "weekday": weekday, "time_slot": time_slot,
        "concurrent": concurrent_order_count, "cook_time": actual_cook_time,
        "menu_name": menu_name, "embedding_str": embedding_str
    })


def get_similar_stores_data(store_id, category, weekday, time_slot, menu_name=None):
    current_vec = embed_situation(store_id, weekday, time_slot, 0, menu_name)
    embedding_str = "[" + ",".join(str(x) for x in current_vec) + "]"

    return fetch_all("""
        SELECT vc.actual_cook_time, vc.menu_name,
               VECTOR_DISTANCE(vc.embedding, TO_VECTOR(:embedding_str), COSINE) as distance
        FROM vector_cases vc
        JOIN stores s ON vc.store_id = s.store_id
        WHERE s.category = :category
        ORDER BY distance ASC
        FETCH FIRST 10 ROWS ONLY
    """, {"embedding_str": embedding_str, "category": category})


def get_similar_cases_by_category(category, weekday, time_slot, menu_name=None, exclude_brand=None, radius_km=2.0):
    dummy_vec = embed_situation(0, weekday, time_slot, 0, menu_name)
    embedding_str = "[" + ",".join(str(x) for x in dummy_vec) + "]"

    exclude_condition = "AND s.name NOT LIKE :exclude_pattern" if exclude_brand else ""

    params = {"embedding_str": embedding_str, "category": category}
    if exclude_brand:
        params["exclude_pattern"] = f"%{exclude_brand}%"

    return fetch_all(f"""
        SELECT vc.actual_cook_time, s.name, vc.menu_name, vc.weekday, vc.time_slot,
               VECTOR_DISTANCE(vc.embedding, TO_VECTOR(:embedding_str), COSINE) as distance
        FROM vector_cases vc
        JOIN stores s ON vc.store_id = s.store_id
        WHERE s.category = :category
        {exclude_condition}
        ORDER BY distance ASC
        FETCH FIRST 10 ROWS ONLY
    """, params)


def get_similar_cases_expanded(weekday, time_slot, menu_name=None):
    dummy_vec = embed_situation(0, weekday, time_slot, 0, menu_name)
    embedding_str = "[" + ",".join(str(x) for x in dummy_vec) + "]"

    return fetch_all("""
        SELECT vc.actual_cook_time, vc.menu_name, vc.weekday, vc.time_slot,
               VECTOR_DISTANCE(vc.embedding, TO_VECTOR(:embedding_str), COSINE) as distance
        FROM vector_cases vc
        ORDER BY distance ASC
        FETCH FIRST 10 ROWS ONLY
    """, {"embedding_str": embedding_str})


def get_similar_cases_by_brand(brand_keyword, region, weekday, time_slot, same_region=True, menu_name=None):
    dummy_vec = embed_situation(0, weekday, time_slot, 0, menu_name)
    embedding_str = "[" + ",".join(str(x) for x in dummy_vec) + "]"

    region_condition = "s.region = :region" if same_region else "s.region != :region"

    return fetch_all(f"""
        SELECT vc.actual_cook_time, s.name, vc.menu_name, vc.weekday, vc.time_slot,
               VECTOR_DISTANCE(vc.embedding, TO_VECTOR(:embedding_str), COSINE) as distance
        FROM vector_cases vc
        JOIN stores s ON vc.store_id = s.store_id
        WHERE s.name LIKE :pattern AND {region_condition}
        ORDER BY distance ASC
        FETCH FIRST 10 ROWS ONLY
    """, {"embedding_str": embedding_str, "pattern": f"%{brand_keyword}%", "region": region})


def get_similar_cases_by_region_category(region, category, weekday, time_slot, menu_name=None, exclude_brand=None):
    dummy_vec = embed_situation(0, weekday, time_slot, 0, menu_name)
    embedding_str = "[" + ",".join(str(x) for x in dummy_vec) + "]"

    exclude_condition = "AND s.name NOT LIKE :exclude_pattern" if exclude_brand else ""

    params = {"embedding_str": embedding_str, "region": region, "category": category}
    if exclude_brand:
        params["exclude_pattern"] = f"%{exclude_brand}%"

    return fetch_all(f"""
        SELECT vc.actual_cook_time, s.name, vc.menu_name, vc.weekday, vc.time_slot,
               VECTOR_DISTANCE(vc.embedding, TO_VECTOR(:embedding_str), COSINE) as distance
        FROM vector_cases vc
        JOIN stores s ON vc.store_id = s.store_id
        WHERE s.region = :region AND s.category = :category
        {exclude_condition}
        ORDER BY distance ASC
        FETCH FIRST 10 ROWS ONLY
    """, params)