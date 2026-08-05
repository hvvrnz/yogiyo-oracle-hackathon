"""Backward-compatible Uvicorn entry point.

실제 FastAPI 애플리케이션은 api/main.py에 있습니다.
기존 실행 명령 `python -m uvicorn app:app ...`을 유지하기 위한 래퍼입니다.
"""
from api.main import app, manager, state

__all__ = ["app", "state", "manager"]
