from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from api.runtime import broadcast_result, state
from common.models import MerchantActionRequest

router = APIRouter(prefix="/api/merchant", tags=["merchant"])


@router.get("/{store_id}")
async def get_merchant(store_id: str) -> dict[str, Any]:
    try:
        return state.merchant_view(store_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="매장을 찾을 수 없습니다.") from exc


@router.post("/orders/{order_id}/action")
async def merchant_action(order_id: str, body: MerchantActionRequest) -> dict[str, Any]:
    result = await state.merchant_action(order_id, body.action, body.delay_min)
    if not result.ok:
        raise HTTPException(status_code=400, detail=result.message)
    return await broadcast_result(result)
