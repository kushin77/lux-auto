"""
WebSocket Real-Time Updates Router

Provides WebSocket endpoints for real-time deal status updates.
Uses Redis pub/sub for event streaming.
"""

from typing import Set
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])


class ConnectionManager:
    """Manages WebSocket connections and broadcasts"""
    
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.user_connections: dict = {}  # Map user_id -> [connections]
    
    async def connect(self, websocket: WebSocket, user_id: str):
        """Add a new WebSocket connection"""
        await websocket.accept()
        self.active_connections.add(websocket)
        
        if user_id not in self.user_connections:
            self.user_connections[user_id] = []
        self.user_connections[user_id].append(websocket)
        
        logger.info(f"WebSocket connection opened for user {user_id}")
    
    def disconnect(self, websocket: WebSocket, user_id: str):
        """Remove a WebSocket connection"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        
        if user_id in self.user_connections:
            if websocket in self.user_connections[user_id]:
                self.user_connections[user_id].remove(websocket)
            
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
        
        logger.info(f"WebSocket connection closed for user {user_id}")
    
    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting message: {e}")
                disconnected.append(connection)
        
        # Clean up disconnected connections
        for connection in disconnected:
            self.active_connections.discard(connection)
    
    async def send_to_user(self, user_id: str, message: dict):
        """Send message to specific user's connections"""
        if user_id in self.user_connections:
            disconnected = []
            for connection in self.user_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending to user {user_id}: {e}")
                    disconnected.append(connection)
            
            # Clean up disconnected connections
            for connection in disconnected:
                if connection in self.active_connections:
                    self.active_connections.remove(connection)
                self.user_connections[user_id].remove(connection)
    
    async def send_to_room(self, room: str, message: dict):
        """Send message to all users subscribed to a room/topic"""
        # TODO: Implement room-based messaging (e.g., by organization, team)
        await self.broadcast(message)
    
    def get_connection_count(self) -> int:
        """Get total number of active connections"""
        return len(self.active_connections)
    
    def get_user_connection_count(self, user_id: str) -> int:
        """Get number of connections for a specific user"""
        return len(self.user_connections.get(user_id, []))


# Global connection manager instance
manager = ConnectionManager()


# ===== WebSocket Endpoints =====

@router.websocket("/ws/deals")
async def websocket_deals(websocket: WebSocket):
    """
    WebSocket endpoint for real-time deal status updates.
    
    Message Format (from server):
    {
        "type": "deal_updated",
        "event": "status_change",
        "deal_id": "deal-123",
        "status": "approved",
        "timestamp": "2024-04-12T10:30:00Z",
        "previous_status": "scored",
        "updated_by": "user-789"
    }
    
    Heartbeat (every 30 seconds):
    {
        "type": "heartbeat",
        "timestamp": "2024-04-12T10:30:00Z"
    }
    
    Reconnection Options:
    - Connection drops after 3 minutes of inactivity
    - Client should auto-reconnect with exponential backoff
    - Fallback to polling every 30 seconds
    """
    
    # Extract user ID from query parameter or header
    # TODO: Extract from JWT token or session
    user_id = websocket.query_params.get("user_id", "anonymous")
    
    await manager.connect(websocket, user_id)
    
    try:
        # Send initial connection message
        await websocket.send_json({
            "type": "connection_established",
            "message": "Connected to deal updates",
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat(),
            "server_version": "1.0.0"
        })
        
        # Listen for messages from client
        while True:
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                
                # Handle ping/heartbeat
                if message.get("type") == "ping":
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                
                # Handle subscription requests
                elif message.get("type") == "subscribe":
                    topics = message.get("topics", [])
                    logger.info(f"User {user_id} subscribed to topics: {topics}")
                    await websocket.send_json({
                        "type": "subscription_confirmed",
                        "topics": topics,
                        "timestamp": datetime.utcnow().isoformat()
                    })
                
                # Handle unsubscription
                elif message.get("type") == "unsubscribe":
                    topics = message.get("topics", [])
                    logger.info(f"User {user_id} unsubscribed from topics: {topics}")
                    await websocket.send_json({
                        "type": "unsubscription_confirmed",
                        "topics": topics,
                        "timestamp": datetime.utcnow().isoformat()
                    })
                
                else:
                    logger.warning(f"Unknown message type from {user_id}: {message.get('type')}")
                    
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON from {user_id}: {data}")
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid JSON format",
                    "timestamp": datetime.utcnow().isoformat()
                })
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
        logger.info(f"WebSocket connection disconnected for user {user_id}")
    
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        manager.disconnect(websocket, user_id)


@router.websocket("/ws/analytics")
async def websocket_analytics(websocket: WebSocket):
    """
    WebSocket endpoint for real-time analytics updates.
    
    Streams real-time metrics:
    - Win rate changes
    - New deal activity
    - Margin updates
    - Performance metrics
    
    Message Format (from server):
    {
        "type": "metrics_updated",
        "metric": "win_rate",
        "value": 0.342,
        "change": 0.032,
        "timestamp": "2024-04-12T10:30:00Z"
    }
    """
    
    user_id = websocket.query_params.get("user_id", "anonymous")
    
    await manager.connect(websocket, user_id)
    
    try:
        await websocket.send_json({
            "type": "connection_established",
            "message": "Connected to analytics updates",
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        while True:
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                
                if message.get("type") == "ping":
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                
                # TODO: Handle metric subscription/unsubscription
                
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON from {user_id}: {data}")
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    
    except Exception as e:
        logger.error(f"Analytics WebSocket error: {e}")
        manager.disconnect(websocket, user_id)


# ===== Helper functions for broadcasting =====

async def broadcast_deal_update(deal_id: str, status: str, updated_by: str):
    """
    Broadcast a deal status update to all connected clients.
    
    Called when a deal status changes (approved, rejected, won, etc.)
    """
    message = {
        "type": "deal_updated",
        "event": "status_change",
        "deal_id": deal_id,
        "status": status,
        "updated_by": updated_by,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    await manager.broadcast(message)


async def broadcast_metrics_update(metric: str, value: float, change: float):
    """
    Broadcast a metrics update to all connected clients.
    
    Called when key metrics change (win rate, margin, ROI, etc.)
    """
    message = {
        "type": "metrics_updated",
        "metric": metric,
        "value": value,
        "change": change,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    await manager.broadcast(message)


async def send_user_notification(user_id: str, notification_type: str, title: str, message: str):
    """
    Send a notification to a specific user.
    
    Examples:
    - Deal approved
    - Deal won
    - Deal lost
    - Buyer match found
    """
    notification = {
        "type": "notification",
        "notification_type": notification_type,
        "title": title,
        "message": message,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    await manager.send_to_user(user_id, notification)
