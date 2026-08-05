from __future__ import annotations

import asyncio
from typing import Any

from fastapi import WebSocket

from common.state import ActionResult, DemoState

state = DemoState()


class ConnectionManager:
    """역할별 화면에 상태 변경 신호를 전달하는 WebSocket 관리자입니다."""

    def __init__(self) -> None:
        self.connections: set[WebSocket] = set()
        self.lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self.lock:
            self.connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self.lock:
            self.connections.discard(websocket)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        async with self.lock:
            clients = list(self.connections)
        stale: list[WebSocket] = []
        for client in clients:
            try:
                await client.send_json(payload)
            except Exception:
                stale.append(client)
        if stale:
            async with self.lock:
                for client in stale:
                    self.connections.discard(client)


manager = ConnectionManager()


async def broadcast_result(result: ActionResult) -> dict[str, Any]:
    payload = {
        "ok": result.ok,
        "message": result.message,
        "event_type": result.event_type,
        "version": state.version,
    }
    await manager.broadcast({"type": "state.updated", **payload})
    return payload
