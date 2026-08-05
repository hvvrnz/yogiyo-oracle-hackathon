from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from api.runtime import broadcast_result, state
from common.models import DummyDatasetRequest, RouteStrategyRequest, SimulationRequest, WeatherRequest

router = APIRouter(prefix="/api/demo", tags=["demo"])


async def checked(result) -> dict[str, Any]:
    if not result.ok:
        raise HTTPException(status_code=400, detail=result.message)
    return await broadcast_result(result)


@router.post("/dataset")
async def set_dummy_dataset(body: DummyDatasetRequest) -> dict[str, Any]:
    return await checked(await state.set_dummy_dataset(body.dataset_id))


@router.post("/reset")
async def demo_reset() -> dict[str, Any]:
    return await checked(await state.demo_reset())


@router.post("/new-order")
async def demo_new_order() -> dict[str, Any]:
    return await checked(await state.demo_seed_new_order())


@router.post("/store-delay")
async def demo_store_delay() -> dict[str, Any]:
    return await checked(await state.demo_force_delay())


@router.post("/rider-accept")
async def demo_rider_accept() -> dict[str, Any]:
    return await checked(await state.demo_force_accept())


@router.post("/rider-reject")
async def demo_rider_reject() -> dict[str, Any]:
    return await checked(await state.demo_force_reject())


@router.post("/rider-timeout")
async def demo_rider_timeout() -> dict[str, Any]:
    return await checked(await state.demo_force_timeout())


@router.post("/next")
async def demo_next() -> dict[str, Any]:
    return await checked(await state.demo_next())


@router.post("/route-strategy")
async def demo_route_strategy(body: RouteStrategyRequest) -> dict[str, Any]:
    return await checked(await state.set_route_strategy(body.strategy))


@router.post("/weather")
async def demo_weather(body: WeatherRequest) -> dict[str, Any]:
    return await checked(await state.set_weather(body.condition))


@router.post("/simulation")
async def demo_simulation(body: SimulationRequest) -> dict[str, Any]:
    return await checked(await state.toggle_simulation(body.running))
