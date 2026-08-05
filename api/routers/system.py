from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from common.config import settings
from common.explanations import generate_explanation
from api.runtime import state

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "app_version": settings.app_version,
        "state_version": state.version,
        "scenario": state.simulation["scenario"],
        "dummy_dataset_id": state.active_dataset_id,
    }


@router.get("/api/config/maps")
async def get_map_config() -> dict[str, Any]:
    provider = settings.map_provider if settings.map_provider in {"naver", "google", "demo"} else "demo"
    selected_key = (
        settings.naver_maps_ncp_key_id
        if provider == "naver"
        else settings.google_maps_api_key
        if provider == "google"
        else ""
    )
    return {
        "provider": provider,
        "client_key": selected_key,
        "has_credentials": bool(selected_key),
        "fallback_provider": "demo",
        "message": f"{provider} 지도 사용" if selected_key else "지도 키가 없어 기존 시연용 지도를 사용합니다.",
    }


@router.get("/api/state")
async def get_state() -> dict[str, Any]:
    return state.snapshot()


@router.get("/api/demo/datasets")
async def get_dummy_datasets() -> dict[str, Any]:
    snapshot = state.snapshot()["dummy_dataset"]
    return {
        "active_dataset_id": snapshot.get("dataset_id"),
        "active_name": snapshot.get("name"),
        "notice": snapshot.get("notice"),
        "datasets": snapshot.get("available", []),
    }


@router.get("/api/explanations/{role}/{entity_id}")
async def get_explanation(role: str, entity_id: str) -> dict[str, Any]:
    try:
        if role == "customer":
            view = state.customer_view(entity_id)
        elif role == "merchant":
            view = state.merchant_view(entity_id)
        elif role == "rider":
            view = state.rider_view(entity_id)
        else:
            raise HTTPException(status_code=400, detail="지원하지 않는 역할입니다.")
        return generate_explanation(role, view).model_dump()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="대상을 찾을 수 없습니다.") from exc
