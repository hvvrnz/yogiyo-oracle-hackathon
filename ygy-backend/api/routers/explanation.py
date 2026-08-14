import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.connection import fetch_one, fetch_all, execute_and_commit

router = APIRouter(prefix="/api/explanation", tags=["explanation"])


@router.get("/context/{package_id}")
def get_explanation_context(package_id: int):
    package = fetch_one("""
        SELECT package_id, package_type, bundle_size, score,
               package_revenue, hourly_revenue, order_ids,
               route_detail, score_detail, rider_id
        FROM packages
        WHERE package_id = :package_id
    """, {"package_id": package_id})

    if not package:
        raise HTTPException(status_code=404, detail="해당 패키지를 찾을 수 없습니다.")

    order_ids = package["order_ids"]
    order_ids = json.loads(order_ids) if isinstance(order_ids, str) else order_ids

    placeholders = ",".join(f":id{i}" for i in range(len(order_ids)))
    params = {f"id{i}": oid for i, oid in enumerate(order_ids)}

    orders = fetch_all(f"""
        SELECT o.order_id, o.store_id, s.name AS store_name,
               o.menu_items, o.owner_cook_min, o.predicted_cook_min
        FROM orders o
        JOIN stores s ON o.store_id = s.store_id
        WHERE o.order_id IN ({placeholders})
    """, params)

    return {"package": package, "orders": orders}


class ExplanationCreate(BaseModel):
    package_id: int
    consumer_text: str
    rider_text: str


@router.post("")
def save_explanation(body: ExplanationCreate):
    execute_and_commit("""
        INSERT INTO explanations (package_id, consumer_text, rider_text, created_at)
        VALUES (:package_id, :consumer_text, :rider_text, SYSTIMESTAMP)
    """, {
        "package_id": body.package_id,
        "consumer_text": body.consumer_text,
        "rider_text": body.rider_text,
    })
    return {"package_id": body.package_id, "status": "saved"}


@router.get("/{package_id}")
def get_explanation(package_id: int):
    explanation = fetch_one("""
        SELECT explanation_id, package_id, consumer_text, rider_text, created_at
        FROM explanations
        WHERE package_id = :package_id
        ORDER BY created_at DESC
        FETCH FIRST 1 ROW ONLY
    """, {"package_id": package_id})

    if not explanation:
        raise HTTPException(status_code=404, detail="해당 패키지의 설명이 없습니다.")

    return explanation