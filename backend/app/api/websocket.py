"""
WebSocket实时数据推送
用于监控数据的实时推送
"""
import json
import asyncio
import logging
from typing import Dict, Set, Optional
from fastapi import WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db, AsyncSessionLocal
from app.api.dependencies import get_current_user_from_token
from app.models.user import User
from app.models.server import Server
from app.models.credential import Credential
from app.api.server_ssh import get_ssh_connection, create_ssh_connection
from datetime import datetime

logger = logging.getLogger(__name__)

# 连接管理器
class ConnectionManager:
    def __init__(self):
        # 存储所有活跃连接
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # 存储每个连接订阅的资源
        self.connection_subscriptions: Dict[WebSocket, Set[str]] = {}
    
    async def connect(self, websocket: WebSocket, channel: str, accept: bool = True):
        """接受WebSocket连接"""
        if accept:
            await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = set()
        self.active_connections[channel].add(websocket)
        self.connection_subscriptions[websocket] = set()
        logger.info(f"WebSocket连接已建立: {channel}, 当前连接数: {len(self.active_connections[channel])}")
    
    def disconnect(self, websocket: WebSocket, channel: str):
        """断开WebSocket连接"""
        if channel in self.active_connections:
            self.active_connections[channel].discard(websocket)
            if not self.active_connections[channel]:
                del self.active_connections[channel]
        if websocket in self.connection_subscriptions:
            del self.connection_subscriptions[websocket]
        logger.info(f"WebSocket连接已断开: {channel}")
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """发送个人消息"""
        try:
            # 检查WebSocket连接状态
            if websocket.client_state.name != "CONNECTED":
                logger.warning(f"WebSocket未连接，无法发送消息。状态: {websocket.client_state.name}")
                return False
            await websocket.send_json(message)
            return True
        except Exception as e:
            logger.error(f"发送消息失败: {e}")
            return False
    
    async def broadcast(self, message: dict, channel: str):
        """向频道内所有连接广播消息"""
        if channel not in self.active_connections:
            return
        
        disconnected = set()
        for websocket in self.active_connections[channel].copy():
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"广播消息失败: {e}")
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

# 全局连接管理器与监控任务
manager = ConnectionManager()
# 每个 WebSocket 对应的实时推送任务
monitoring_tasks: Dict[WebSocket, asyncio.Task] = {}


async def _collect_realtime_metrics(server: Server, credential: Credential) -> Optional[dict]:
    """
    通过 SSH 采集轻量级实时指标（CPU/内存/磁盘/网络），只在页面打开时运行
    """
    def _run_blocking():
        ssh = get_ssh_connection(server.id, credential.id)
        if not ssh:
            # create_ssh_connection 是阻塞的，这里直接使用
            ssh = create_ssh_connection(server, credential, db=None)  # db未使用，仅为兼容签名

        def run(cmd: str, timeout: int = 5):
            stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
            exit_status = stdout.channel.recv_exit_status()
            out = stdout.read().decode("utf-8", errors="ignore")
            err = stderr.read().decode("utf-8", errors="ignore")
            return exit_status, out, err

        metrics = {
            "cpu": {"usage": 0, "cores": 0, "load": [0, 0, 0]},
            "memory": {"used": 0, "total": 0, "cached": 0, "swap": 0},
            "disk": [],
            "network": [],
        }

        # CPU 使用率与核心数
        exit_status, out, _ = run("cat /proc/cpuinfo")
        if exit_status == 0:
            cores = out.count("\nprocessor")
            metrics["cpu"]["cores"] = cores
        exit_status, out, _ = run("uptime")
        if exit_status == 0:
            import re
            m = re.search(r"load average:\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)", out)
            if m:
                metrics["cpu"]["load"] = [float(m.group(1)), float(m.group(2)), float(m.group(3))]
        exit_status, out, _ = run("top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'")
        if exit_status == 0:
            try:
                metrics["cpu"]["usage"] = float(out.strip())
            except ValueError:
                pass

        # 内存
        exit_status, out, _ = run("cat /proc/meminfo")
        if exit_status == 0:
            import re
            def get_val(key):
                m = re.search(rf"{key}:\s+(\d+)", out)
                return int(m.group(1)) * 1024 if m else 0
            total = get_val("MemTotal")
            free = get_val("MemFree")
            cached = get_val("Cached")
            buffers = get_val("Buffers")
            swap_total = get_val("SwapTotal")
            swap_free = get_val("SwapFree")
            used = total - free - cached - buffers
            metrics["memory"].update({
                "total": total,
                "used": max(0, used),
                "cached": cached,
                "swap": max(0, swap_total - swap_free),
            })

        # 磁盘（只取根分区）
        exit_status, out, _ = run("df -P -B1 /")
        if exit_status == 0:
            lines = out.strip().splitlines()
            if len(lines) >= 2:
                parts = lines[1].split()
                if len(parts) >= 5:
                    filesystem, size, used, avail, usep = parts[:5]
                    try:
                        metrics["disk"].append({
                            "filesystem": filesystem,
                            "size": int(size),
                            "used": int(used),
                            "available": int(avail),
                            "usage_percent": float(usep.rstrip("%")) if usep else 0,
                            "mount_point": "/",
                        })
                    except ValueError:
                        pass

        # 网络（解析 /proc/net/dev）
        exit_status, out, _ = run("cat /proc/net/dev")
        if exit_status == 0:
            lines = out.strip().splitlines()
            for line in lines[2:]:
                if ":" not in line:
                    continue
                name_part, data_part = line.split(":", 1)
                name = name_part.strip()
                fields = data_part.split()
                if len(fields) >= 16:
                    try:
                        rx_bytes = int(fields[0])
                        tx_bytes = int(fields[8])
                        metrics["network"].append({
                            "name": name,
                            "status": "up",
                            "rx_bytes": rx_bytes,
                            "tx_bytes": tx_bytes,
                            "rx_packets": int(fields[1]),
                            "tx_packets": int(fields[9]),
                        })
                    except ValueError:
                        continue

        return metrics

    try:
        return await asyncio.to_thread(_run_blocking)
    except Exception as e:
        logger.warning(f"实时采集服务器 {server.id} 指标失败: {e}")
        return None


async def _start_server_monitoring(websocket: WebSocket, resource_id: int):
    """
    针对指定 server 的实时采集推送任务（仅在页面打开且订阅时运行）
    """
    async with AsyncSessionLocal() as session:
        server = await session.get(Server, resource_id)
        if not server:
            logger.warning(f"订阅的服务器不存在: {resource_id}")
            return
        cred = None
        if server.default_credential_id:
            cred = await session.get(Credential, server.default_credential_id)
        if not cred:
            logger.warning(f"服务器 {resource_id} 缺少默认凭据，无法实时推送")
            return

    logger.info(f"启动服务器 {resource_id} 的实时监控推送（页面已打开）")

    while True:
        # 如果连接或订阅已失效，退出任务
        if websocket.client_state.name != "CONNECTED":
            break
        subs = manager.connection_subscriptions.get(websocket, set())
        if f"server:{resource_id}" not in subs:
            break

        metrics = await _collect_realtime_metrics(server, cred)
        if metrics:
            await push_metric_data("server", resource_id, metrics)

        await asyncio.sleep(5)

    logger.info(f"停止服务器 {resource_id} 的实时监控推送")


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
        # 先接受连接才能发送错误消息
        await websocket.accept()
        await websocket.send_json({
            "type": "error",
            "message": "未提供认证token"
        })
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="未提供认证token")
        return
    
    try:
        # 验证用户
        user = await get_current_user_from_token(token)
        logger.info(f"WebSocket认证成功: user={user.username}")
    except HTTPException as e:
        # HTTPException是预期的认证错误
        error_message = e.detail if hasattr(e, 'detail') else str(e)
        logger.warning(f"WebSocket认证失败 (HTTPException): {error_message}, token前10字符: {token[:10] if token else 'None'}...")
        # 先接受连接才能发送错误消息
        await websocket.accept()
        await websocket.send_json({
            "type": "error",
            "message": error_message
        })
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason=error_message)
        return
    except Exception as e:
        # 其他未预期的错误
        error_message = str(e)
        logger.error(f"WebSocket认证失败 (Exception): {error_message}", exc_info=True)
        # 先接受连接才能发送错误消息
        await websocket.accept()
        await websocket.send_json({
            "type": "error",
            "message": "认证失败，请重新登录"
        })
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="认证失败")
        return
    
    # 建立连接 - 先accept，然后使用manager.connect（传入accept=False避免重复accept）
    await websocket.accept()
    await manager.connect(websocket, channel, accept=False)
    
    try:
        # 发送欢迎消息
        await manager.send_personal_message({
            "type": "connected",
            "message": "WebSocket连接已建立",
            "user": user.username,
            "timestamp": datetime.utcnow().isoformat()
        }, websocket)
        
        # 保持连接并处理消息
        # 使用asyncio.wait_for来避免无限等待，同时设置超时
        try:
            while True:
                try:
                    # 接收客户端消息，设置超时避免无限等待
                    # 使用asyncio.wait_for包装，每30秒检查一次连接状态
                    try:
                        data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                    except asyncio.TimeoutError:
                        # 超时后发送ping消息保持连接
                        # 先检查连接状态
                        if websocket.client_state.name != "CONNECTED":
                            logger.info("WebSocket连接已断开（超时检查），退出循环")
                            break
                        sent = await manager.send_personal_message({
                            "type": "ping",
                            "timestamp": datetime.utcnow().isoformat()
                        }, websocket)
                        if not sent:
                            # 如果发送失败，连接可能已断开
                            logger.warning("发送ping消息失败，连接可能已断开")
                            break
                        continue
                    
                    message = json.loads(data)
                    action = message.get("action")
                    
                    if action == "subscribe":
                        # 订阅资源
                        resource_type = message.get("resource_type")
                        resource_id = message.get("resource_id")
                        if resource_type and resource_id:
                            resource_key = f"{resource_type}:{resource_id}"
                            logger.info(f"客户端订阅资源: {resource_key}")
                            manager.subscribe(websocket, resource_key)
                            await manager.send_personal_message({
                                "type": "subscribed",
                                "resource": resource_key,
                                "resource_type": resource_type,
                                "resource_id": resource_id,
                                "timestamp": datetime.utcnow().isoformat()
                            }, websocket)
                            logger.info(f"已发送订阅确认: {resource_key}")

                            # 如果订阅的是服务器监控，开启按需的实时采集推送任务
                            if resource_type == "server":
                                # 如果已有旧任务，先取消
                                old_task = monitoring_tasks.pop(websocket, None)
                                if old_task:
                                    old_task.cancel()
                                task = asyncio.create_task(_start_server_monitoring(websocket, resource_id))
                                monitoring_tasks[websocket] = task
                        else:
                            logger.warning(f"订阅消息缺少必要参数: {message}")
                            await manager.send_personal_message({
                                "type": "error",
                                "message": "订阅消息缺少必要参数: resource_type 和 resource_id"
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
                            # 取消实时推送任务
                            task = monitoring_tasks.pop(websocket, None)
                            if task:
                                task.cancel()
                    
                    elif action == "ping":
                        # 心跳检测（客户端发送ping，服务器回复pong）
                        await manager.send_personal_message({
                            "type": "pong",
                            "timestamp": datetime.utcnow().isoformat()
                        }, websocket)
                    elif action == "pong":
                        # 心跳响应（客户端对服务器ping的响应，静默处理）
                        # 不需要回复，只记录日志用于调试
                        logger.debug(f"收到客户端pong响应: {message.get('timestamp', 'N/A')}")
                    else:
                        logger.warning(f"未知的WebSocket消息类型: {action}")
                        await manager.send_personal_message({
                            "type": "error",
                            "message": f"未知的消息类型: {action}"
                        }, websocket)
                
                except WebSocketDisconnect:
                    # WebSocket断开，重新抛出以便外层处理
                    raise
                except json.JSONDecodeError as e:
                    logger.warning(f"无效的JSON格式: {e}")
                    # 检查连接状态
                    if websocket.client_state.name != "CONNECTED":
                        logger.info("WebSocket连接已断开（JSON解析错误），退出循环")
                        break
                    sent = await manager.send_personal_message({
                        "type": "error",
                        "message": "无效的JSON格式"
                    }, websocket)
                    if not sent:
                        # 如果发送失败，连接可能已断开
                        logger.warning("发送错误消息失败，连接可能已断开")
                        break
                except Exception as e:
                    error_msg = str(e)
                    logger.error(f"处理WebSocket消息失败: {error_msg}", exc_info=True)
                    
                    # 检查是否是连接相关的错误
                    if ("WebSocket is not connected" in error_msg or 
                        "Cannot call" in error_msg or
                        "Connection" in error_msg or
                        "WebSocket" in str(type(e).__name__)):
                        # 连接已断开，退出循环
                        logger.info("WebSocket连接已断开，退出消息处理循环")
                        break
                    
                    # 尝试发送错误消息，但如果失败则退出循环
                    try:
                        sent = await manager.send_personal_message({
                            "type": "error",
                            "message": f"处理消息失败: {error_msg}"
                        }, websocket)
                        if not sent:
                            # 发送失败，连接可能已断开
                            logger.warning("发送错误消息失败，连接可能已断开")
                            break
                    except Exception as send_err:
                        # 如果发送失败，连接可能已断开，退出循环
                        logger.warning(f"发送错误消息失败: {send_err}，连接可能已断开")
                        break
        except asyncio.CancelledError:
            logger.info("WebSocket连接被取消")
            raise
    
    except WebSocketDisconnect:
        logger.info("WebSocket连接已断开（客户端主动断开）")
        manager.disconnect(websocket, channel)
        task = monitoring_tasks.pop(websocket, None)
        if task:
            task.cancel()
    except asyncio.CancelledError:
        logger.info("WebSocket连接被取消")
        manager.disconnect(websocket, channel)
        task = monitoring_tasks.pop(websocket, None)
        if task:
            task.cancel()
    except Exception as e:
        import traceback
        error_msg = str(e)
        # 如果是连接相关的错误，只记录警告，避免死循环
        if ("WebSocket is not connected" in error_msg or 
            "Cannot call" in error_msg or
            "Connection" in error_msg):
            logger.warning(f"WebSocket连接错误: {error_msg}")
        else:
            logger.error(f"WebSocket连接错误: {e}\n{traceback.format_exc()}")
        try:
            manager.disconnect(websocket, channel)
        except:
            pass
        finally:
            task = monitoring_tasks.pop(websocket, None)
            if task:
                task.cancel()


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
                        logger.error(f"推送监控数据失败: {e}")
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
