from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import FileResponse, RedirectResponse

from common.config import STATIC_DIR

router = APIRouter(include_in_schema=False)


def page(path: str) -> FileResponse:
    return FileResponse(STATIC_DIR / path, media_type="text/html; charset=utf-8")


@router.get("/")
async def home() -> FileResponse:
    return page("index.html")


@router.get("/customer")
async def customer_page() -> FileResponse:
    return page("customer/index.html")


@router.get("/merchant")
async def merchant_page() -> FileResponse:
    return page("merchant/index.html")


@router.get("/rider")
async def rider_page() -> FileResponse:
    return page("rider/index.html")


@router.get("/demo")
async def demo_page() -> FileResponse:
    return page("demo/index.html")


@router.get("/favicon.ico")
async def favicon() -> RedirectResponse:
    return RedirectResponse(url="/static/assets/favicon.svg")
