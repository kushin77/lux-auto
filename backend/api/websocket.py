"""
WebSocket real-time updates for Lux-Auto

Provides live updates for deal status changes and other real-time events.
"""

import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from typing import Set
import logging

from backend.database import get_db
from backend.auth.audit import AuditLogger

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

# Track active WebSocket connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.user_connections = {}
    
    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections.add(websocket)
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(websocket)
        logger.info(f"User {user_id} connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket, user_id: int):
        self.active_connections.discard(websocket)
        if user_id in self.user_connections:
            self.user_connections[user_id].discard(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
        logger.info(f"User {user_id} disconnected. Total connections: {len(self.active_connections)}")
    
    async def broadcast(self, message: dict):
        """Broadcast to all connected clients."""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error sending message: {e}")
                disconnected.append(connection)
        
        # Clean up disconnected websockets
        for conn in disconnected:
            self.active_connections.discard(conn)
    
    async def broadcast_to_user(self, user_id: int, message: dict):
        """Broadcast to all connections for a specific user."""
        if user_id in self.user_connections:
            disconnected = []
            for connection in self.user_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending message to user {user_id}: {e}")
                    disconnected.append(connection)
            
            for conn in disconnected:
                self.user_connections[user_id].discard(conn)
                self.active_connections.discard(conn)


manager = ConnectionManager()


@router.websocket("/ws/deals")
async def websocket_deals(
    websocket: WebSocket,
    user_id: int = None,
    db: Session = Depends(get_db),
):
    """WebSocket endpoint for real-time deal updates."""
    # Simple implementation - in production use redis pub/sub
    # For now, just client can send/receive deal update messages
    
    try:
        await manager.connect(websocket, user_id or 0)
        
        # Send welcome message
        await websocket.send_json({
            "type": "connection",
            "status": "connected",
            "message": "Connected to real-time deal updates",
            "timestamp": asyncio.get_event_loop().time(),
        })
        
        # Listen for messages
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            elif data.get("type") == "subscribe":
                # Subscribe to deal updates
                await websocket.send_json({
                    "type": "subscribed",
                    "deal_id": data.get("deal_id"),
                    "message": f"Subscribed to deal {data.get('deal_id')} updates"
                })
            elif data.get("type") == "deal_update":
                # Broadcast deal update to all users
                await manager.broadcast({
                    "type": "deal_updated",
                    "deal_id": data.get("deal_id"),
                    "status": data.get("status"),
                    "timestamp": asyncio.get_event_loop().time(),
                    "updated_by": user_id,
                })
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id or 0)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, user_id or 0)


# Helper function to broadcast deal updates
async def broadcast_deal_update(deal_id: str, status: str, user_id: int = None):
    """Broadcast a deal update to all connected clients."""
    await manager.broadcast({
        "type": "deal_updated",
        "deal_id": deal_id,
        "status": status,
        "timestamp": asyncio.get_event_loop().time(),
        "updated_by": user_id,
    })
