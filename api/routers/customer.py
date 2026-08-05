from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from api.runtime import state

router = APIRouter(prefix="/api/customer", tags=["customer"])


@router.get("/{customer_id}")
async def get_customer(customer_id: str) -> dict[str, Any]:
    try:
        return state.customer_view(customer_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="고객 또는 주문을 찾을 수 없습니다.") from exc
