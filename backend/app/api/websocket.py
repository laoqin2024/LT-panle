"""
WebSocket实时数据推送
用于监控数据的实时推送
"""
import json
import asyncio
from typing import Dict, Set
from fastapi import WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.dependencies import get_current_user_from_token
from app.models.user import User
from datetime import datetime

# 连接管理器
class ConnectionManager:
    def __init__(self):
        # 存储所有活跃连接
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # 存储每个连接订阅的资源
        self.connection_subscriptions: Dict[WebSocket, Set[str]] = {}
    
    async def connect(self, websocket: WebSocket, channel: str):
        """接受WebSocket连接"""
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = set()
        self.active_connections[channel].add(websocket)
        self.connection_subscriptions[websocket] = set()
        print(f"WebSocket连接已建立: {channel}, 当前连接数: {len(self.active_connections[channel])}")
    
    def disconnect(self, websocket: WebSocket, channel: str):
        """断开WebSocket连接"""
        if channel in self.active_connections:
            self.active_connections[channel].discard(websocket)
            if not self.active_connections[channel]:
                del self.active_connections[channel]
        if websocket in self.connection_subscriptions:
            del self.connection_subscriptions[websocket]
        print(f"WebSocket连接已断开: {channel}")
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """发送个人消息"""
        try:
            await websocket.send_json(message)
        except Exception as e:
            print(f"发送消息失败: {e}")
    
    async def broadcast(self, message: dict, channel: str):
        """向频道内所有连接广播消息"""
        if channel not in self.active_connections:
            return
        
        disconnected = set()
        for websocket in self.active_connections[channel].copy():
            try:
                await websocket.send_json(message)
            except Exception as e:
                print(f"广播消息失败: {e}")
                disconnected.add(websocket)
        
        # 清理断开的连接
        for ws in disconnected:
            self.disconnect(ws, channel)
    
    def subscribe(self, websocket: WebSocket, resource: str):
        """订阅资源"""
        if websocket in self.connection_subscriptions:
            self.connection_subscriptions[websocket].add(resource)
    
    def unsubscribe(self, websocket: WebSocket, resource: str):
        """取消订阅资源"""
        if websocket in self.connection_subscriptions:
            self.connection_subscriptions[websocket].discard(resource)

# 全局连接管理器
manager = ConnectionManager()


async def get_current_user_websocket(
    websocket: WebSocket,
    token: str = None
) -> User:
    """
    从WebSocket连接中获取当前用户
    支持通过查询参数或消息传递token
    """
    if not token:
        # 尝试从查询参数获取token
        query_params = dict(websocket.query_params)
        token = query_params.get("token")
    
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供认证token"
        )
    
    try:
        user = await get_current_user_from_token(token)
        return user
    except Exception as e:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"认证失败: {str(e)}"
        )


# WebSocket端点
async def websocket_monitoring(
    websocket: WebSocket,
    channel: str = "monitoring"
):
    """
    监控数据实时推送WebSocket端点
    
    支持的消息格式:
    - 订阅资源: {"action": "subscribe", "resource_type": "server", "resource_id": 1}
    - 取消订阅: {"action": "unsubscribe", "resource_type": "server", "resource_id": 1}
    """
    # 从查询参数获取token
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    
    try:
        # 验证用户
        user = await get_current_user_from_token(token)
    except Exception as e:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    
    # 建立连接
    await manager.connect(websocket, channel)
    
    try:
        # 发送欢迎消息
        await manager.send_personal_message({
            "type": "connected",
            "message": "WebSocket连接已建立",
            "user": user.username,
            "timestamp": datetime.utcnow().isoformat()
        }, websocket)
        
        # 保持连接并处理消息
        while True:
            try:
                # 接收客户端消息
                data = await websocket.receive_text()
                message = json.loads(data)
                
                action = message.get("action")
                
                if action == "subscribe":
                    # 订阅资源
                    resource_type = message.get("resource_type")
                    resource_id = message.get("resource_id")
                    if resource_type and resource_id:
                        resource_key = f"{resource_type}:{resource_id}"
                        manager.subscribe(websocket, resource_key)
                        await manager.send_personal_message({
                            "type": "subscribed",
                            "resource": resource_key,
                            "timestamp": datetime.utcnow().isoformat()
                        }, websocket)
                
                elif action == "unsubscribe":
                    # 取消订阅
                    resource_type = message.get("resource_type")
                    resource_id = message.get("resource_id")
                    if resource_type and resource_id:
                        resource_key = f"{resource_type}:{resource_id}"
                        manager.unsubscribe(websocket, resource_key)
                        await manager.send_personal_message({
                            "type": "unsubscribed",
                            "resource": resource_key,
                            "timestamp": datetime.utcnow().isoformat()
                        }, websocket)
                
                elif action == "ping":
                    # 心跳检测
                    await manager.send_personal_message({
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    }, websocket)
                
            except json.JSONDecodeError:
                await manager.send_personal_message({
                    "type": "error",
                    "message": "无效的JSON格式"
                }, websocket)
            except Exception as e:
                print(f"处理WebSocket消息失败: {e}")
                await manager.send_personal_message({
                    "type": "error",
                    "message": f"处理消息失败: {str(e)}"
                }, websocket)
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)
    except Exception as e:
        print(f"WebSocket连接错误: {e}")
        manager.disconnect(websocket, channel)


# 监控数据推送函数（供其他模块调用）
async def push_metric_data(
    resource_type: str,
    resource_id: int,
    metric_data: dict
):
    """
    推送监控数据到订阅的客户端
    
    参数:
    - resource_type: 资源类型 (server, device, site, database)
    - resource_id: 资源ID
    - metric_data: 监控数据字典
    """
    resource_key = f"{resource_type}:{resource_id}"
    channel = "monitoring"
    
    message = {
        "type": "metric",
        "resource_type": resource_type,
        "resource_id": resource_id,
        "data": metric_data,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # 向所有订阅了该资源的连接发送消息
    if channel in manager.active_connections:
        for websocket in manager.active_connections[channel].copy():
            if websocket in manager.connection_subscriptions:
                subscriptions = manager.connection_subscriptions[websocket]
                # 如果订阅了该资源或订阅了所有资源
                if resource_key in subscriptions or f"{resource_type}:*" in subscriptions:
                    try:
                        await websocket.send_json(message)
                    except Exception as e:
                        print(f"推送监控数据失败: {e}")
                        manager.disconnect(websocket, channel)


async def push_alert_data(alert_data: dict):
    """
    推送告警数据到所有连接的客户端
    
    参数:
    - alert_data: 告警数据字典
    """
    channel = "monitoring"
    
    message = {
        "type": "alert",
        "data": alert_data,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # 向所有连接广播告警
    await manager.broadcast(message, channel)
