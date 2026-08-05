from __future__ import annotations

import asyncio
import contextlib

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from api.routers import customer, demo, merchant, pages, rider, system, websocket
from api.runtime import manager, state
from common.config import STATIC_DIR, settings


async def simulation_loop() -> None:
    while True:
        await asyncio.sleep(2)
        timeout_result = await state.process_offer_timeout()
        if timeout_result is not None:
            await manager.broadcast(
                {
                    "type": "state.updated",
                    "ok": timeout_result.ok,
                    "message": timeout_result.message,
                    "event_type": timeout_result.event_type,
                    "version": state.version,
                }
            )
        if state.simulation["running"]:
            await state.tick(2)
            package = state.packages["PKG-001"]
            active_rider = state._active_rider(package)
            await manager.broadcast(
                {
                    "type": "rider.location.updated",
                    "version": state.version,
                    "location": {
                        "rider_id": active_rider["rider_id"],
                        "lat": active_rider["lat"],
                        "lng": active_rider["lng"],
                    },
                }
            )


@contextlib.asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(simulation_loop())
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(
    title="요기요 AI 조리-배달 동기화 통합 데모",
    version=settings.app_version,
    description="고객·사장님·라이더 역할별 실시간 화면, 경로 최적화, 자동 재배차 시연",
    lifespan=lifespan,
)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

app.include_router(pages.router)
app.include_router(system.router)
app.include_router(customer.router)
app.include_router(merchant.router)
app.include_router(rider.router)
app.include_router(demo.router)
app.include_router(websocket.router)

__all__ = ["app", "state", "manager"]
