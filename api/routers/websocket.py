from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api.runtime import manager, state

router = APIRouter()


@router.websocket("/ws/{role}/{entity_id}")
async def websocket_endpoint(websocket: WebSocket, role: str, entity_id: str) -> None:
    await manager.connect(websocket)
    await websocket.send_json(
        {
            "type": "connected",
            "role": role,
            "entity_id": entity_id,
            "version": state.version,
        }
    )
    try:
        while True:
            message = await websocket.receive_text()
            if message == "ping":
                await websocket.send_json({"type": "pong", "version": state.version})
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
