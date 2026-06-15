"""
WebSocket router — live deal updates.

Clients connect to ``/ws/deals`` for real-time pipeline events. A simple
in-process connection manager fans out broadcasts. For multi-instance Cloud Run,
swap the manager's broadcast for a Pub/Sub or Redis fan-out (see backend/README).
"""

from __future__ import annotations

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

log = structlog.get_logger(__name__)

router = APIRouter(tags=["WebSocket"])


class ConnectionManager:
    """Tracks active sockets and broadcasts JSON-serializable payloads."""

    def __init__(self) -> None:
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)
        log.info("ws.connected", connections=len(self.active))

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active:
            self.active.remove(ws)
        log.info("ws.disconnected", connections=len(self.active))

    async def broadcast(self, message: dict) -> None:
        dead: list[WebSocket] = []
        for ws in self.active:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


@router.websocket("/ws/deals")
async def deals_feed(websocket: WebSocket) -> None:
    """Bidirectional channel. Echoes pings; intended for server-pushed updates.

    Identity note: oauth2-proxy validates the upgrade request before it reaches
    Cloud Run, so a connection here is already authenticated.
    """
    await manager.connect(websocket)
    try:
        await websocket.send_json({"type": "connected", "channel": "deals"})
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
            else:
                await websocket.send_json({"type": "ack", "echo": data})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
