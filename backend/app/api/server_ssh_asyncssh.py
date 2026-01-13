"""
使用 asyncssh 实现的服务器SSH终端API（推荐方案）
"""
import asyncio
import logging
import os
from typing import Optional, Dict, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status, Query, HTTPException
import asyncssh

from app.core.database import AsyncSessionLocal
from app.models.server import Server
from app.models.credential import Credential
from app.api.dependencies import get_current_user_from_token
from app.core.encryption import decrypt_password
from app.core.ssh_utils import load_ssh_private_key
from sqlalchemy import select

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/servers", tags=["服务器SSH终端(AsyncSSH)"])

# 每次为新的 WebSocket 创建独立的 SSH 连接，避免连接复用导致的并发冲突
async def get_ssh_connection_async(
    server_id: int,
    credential_id: int,
    server: Server,
    credential: Credential
) -> tuple[Optional[asyncssh.SSHClientConnection], Optional[str]]:
    """
    创建新的SSH连接（asyncssh版本，不复用连接）
    返回: (SSH连接对象, 临时文件路径或None)
    """
    logger.info(f"创建新SSH连接: server={server_id}, credential={credential_id}")
    tmp_key_path = None
    try:
        # 准备连接参数
        connect_kwargs = {
            "host": server.host,
            "port": server.port or 22,
            "username": credential.username,
            "known_hosts": None,  # 不验证主机密钥（生产环境应该验证）
            # 保持心跳，减少长连接被中间设备断开
            "keepalive_interval": 30,
            "keepalive_count_max": 3,
        }
        
        # 根据认证方式设置参数
        if credential.credential_type == "password":
            password = decrypt_password(credential.password_encrypted)
            connect_kwargs["password"] = password
        elif credential.credential_type == "ssh_key":
            # asyncssh支持从文件路径或内存中的密钥加载
            # 优先使用文件路径（如果存在）
            if credential.ssh_key_path:
                key_path = os.path.expanduser(credential.ssh_key_path)
                if os.path.exists(key_path):
                    connect_kwargs["client_keys"] = [key_path]
                else:
                    raise ValueError(f"SSH密钥文件不存在: {key_path}")
            elif credential.password_encrypted:
                # 如果密钥内容存储在password_encrypted中，需要保存到临时文件
                try:
                    # 解密私钥内容
                    private_key_content = decrypt_password(credential.password_encrypted)
                    # 保存到临时文件
                    import tempfile
                    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.pem') as tmp_file:
                        tmp_file.write(private_key_content)
                        tmp_key_path = tmp_file.name
                    # 设置文件权限（SSH要求私钥文件权限不能太宽松）
                    os.chmod(tmp_key_path, 0o600)
                    connect_kwargs["client_keys"] = [tmp_key_path]
                    logger.info(f"已创建临时密钥文件: {tmp_key_path}")
                except Exception as e:
                    logger.error(f"处理SSH密钥内容失败: {e}")
                    raise ValueError(f"无法处理SSH密钥: {str(e)}")
            else:
                raise ValueError("SSH密钥认证需要提供密钥文件路径或密钥内容")
        else:
            raise ValueError(f"不支持的凭据类型: {credential.credential_type}")
        
        # 建立SSH连接
        conn = await asyncssh.connect(**connect_kwargs)
        logger.info(f"SSH连接创建成功: server={server_id}, credential={credential_id}")
        return conn, tmp_key_path
        
    except asyncssh.Error as e:
        logger.error(f"SSH连接失败 (asyncssh.Error): {e}")
        # 清理临时文件
        if tmp_key_path and os.path.exists(tmp_key_path):
            try:
                os.unlink(tmp_key_path)
                logger.debug(f"已清理临时密钥文件: {tmp_key_path}")
            except Exception as cleanup_err:
                logger.warning(f"清理临时文件失败: {cleanup_err}")
        raise
    except Exception as e:
        logger.error(f"创建SSH连接时发生错误: {e}")
        # 清理临时文件
        if tmp_key_path and os.path.exists(tmp_key_path):
            try:
                os.unlink(tmp_key_path)
                logger.debug(f"已清理临时密钥文件: {tmp_key_path}")
            except Exception as cleanup_err:
                logger.warning(f"清理临时文件失败: {cleanup_err}")
        raise


@router.websocket("/{server_id}/ssh/terminal/asyncssh")
async def ssh_terminal_asyncssh(
    websocket: WebSocket,
    server_id: int,
    credential_id: int = Query(...),
    token: str = Query(...)
):
    """
    使用asyncssh实现的SSH终端WebSocket端点
    
    消息格式：
    - 客户端 -> 服务器: {"type": "input", "data": "命令或输入"}
    - 客户端 -> 服务器: {"type": "resize", "rows": 24, "cols": 80}
    - 服务器 -> 客户端: {"type": "connected", "message": "SSH终端已连接"}
    - 服务器 -> 客户端: {"type": "output", "data": "SSH输出"}
    - 服务器 -> 客户端: {"type": "error", "message": "错误信息"}
    """
    await websocket.accept()
    logger.info(f"WebSocket连接已接受: server_id={server_id}, credential_id={credential_id}")
    
    conn = None
    tmp_key_path = None
    process = None
    
    try:
        # 验证用户
        logger.info(f"开始验证用户token...")
        try:
            current_user = await get_current_user_from_token(token)
            logger.info(f"用户认证成功: {current_user.username}")
        except HTTPException as auth_err:
            logger.error(f"用户认证失败 (HTTPException): {auth_err.detail}")
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": f"认证失败: {auth_err.detail}"
                })
            except:
                pass
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        except Exception as auth_err:
            logger.error(f"用户认证失败 (Exception): {auth_err}", exc_info=True)
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": f"认证失败: {str(auth_err)}"
                })
            except:
                pass
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        # 获取服务器和凭据信息
        logger.info(f"开始获取服务器和凭据信息...")
        async with AsyncSessionLocal() as db:
            # 获取服务器
            server_result = await db.execute(
                select(Server).where(Server.id == server_id)
            )
            server = server_result.scalar_one_or_none()
            if not server:
                logger.error(f"服务器不存在: server_id={server_id}")
                await websocket.send_json({
                    "type": "error",
                    "message": "服务器不存在"
                })
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
            
            logger.info(f"服务器信息: {server.name} ({server.host}:{server.port})")
            
            # 获取凭据
            credential_result = await db.execute(
                select(Credential).where(Credential.id == credential_id)
            )
            credential = credential_result.scalar_one_or_none()
            if not credential:
                logger.error(f"凭据不存在: credential_id={credential_id}")
                await websocket.send_json({
                    "type": "error",
                    "message": "凭据不存在"
                })
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
            
            logger.info(f"凭据信息: {credential.username} (类型: {credential.credential_type})")
        
        # 获取或创建SSH连接
        logger.info(f"开始创建SSH连接...")
        try:
            conn, tmp_key_path = await get_ssh_connection_async(
                server_id,
                credential_id,
                server,
                credential
            )
            if not conn:
                raise ValueError("SSH连接创建失败：返回None")
            logger.info(f"SSH连接创建成功")
        except asyncssh.Error as e:
            logger.error(f"SSH连接失败 (asyncssh.Error): {e}", exc_info=True)
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": f"SSH连接失败: {str(e)}"
                })
            except:
                pass
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
            return
        except Exception as e:
            logger.error(f"SSH连接失败 (Exception): {e}", exc_info=True)
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": f"SSH连接失败: {str(e)}"
                })
            except:
                pass
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
            return
        
        # 创建交互式shell会话
        # 使用create_process创建交互式shell
        # 注意：不要使用 async with conn，因为连接在连接池中需要保持打开
        
        # 发送连接成功消息（在创建shell之前发送，让前端知道连接已建立）
        try:
            await websocket.send_json({
                "type": "connected",
                "message": "SSH终端已连接"
            })
            logger.info("SSH终端连接成功，开始创建shell")
        except WebSocketDisconnect:
            # 客户端在我们发送“已连接”之前就断开了，这种情况属于正常断开，直接结束
            logger.warning("WebSocket在发送连接成功消息前已断开（WebSocketDisconnect）")
            return
        except Exception as e:
            # 其他发送错误，记录日志后结束
            logger.error(f"发送连接成功消息失败: {e}")
            return
        
        # 连接状态标志
        is_connected = True
        
        # Idle timeout: 30 minutes (30 * 60 seconds)
        IDLE_TIMEOUT = 30 * 60
        last_activity_time = asyncio.get_event_loop().time()
        
        # 使用create_process创建交互式shell
        logger.info("开始创建SSH shell进程...")
        try:
            process = await conn.create_process(
                None,  # None表示创建交互式shell
                term_type='xterm-256color',
                term_size=(80, 24)
            )
            if not process:
                raise ValueError("Shell进程创建失败：返回None")
            logger.info("SSH shell进程创建成功")
        except asyncssh.Error as e:
            logger.error(f"创建shell进程失败 (asyncssh.Error): {e}", exc_info=True)
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": f"创建shell进程失败: {str(e)}"
                })
            except:
                pass
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
            return
        except Exception as e:
            logger.error(f"创建shell进程失败 (Exception): {e}", exc_info=True)
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": f"创建shell进程失败: {str(e)}"
                })
            except:
                pass
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
            return
        
        stdin, stdout, stderr = process.stdin, process.stdout, process.stderr
        
        # 等待 shell 初始化，然后发送一个换行符来触发 prompt 输出
        await asyncio.sleep(0.2)
        try:
            if stdin and not stdin.is_closing():
                stdin.write('\n')  # 发送换行符触发 shell prompt
                await stdin.drain()
                logger.debug("已发送初始化换行符以触发 shell prompt")
        except Exception as e:
            logger.warning(f"发送初始化换行符失败: {e}")
        
        # 定义输出读取任务
        async def read_output():
            """读取SSH输出并发送到WebSocket"""
            nonlocal is_connected, last_activity_time
            try:
                # 等待 shell 初始化完成（有些 shell 可能需要一点时间）
                await asyncio.sleep(0.1)
                
                while is_connected:
                    try:
                        # 检查 idle timeout
                        current_time = asyncio.get_event_loop().time()
                        if current_time - last_activity_time > IDLE_TIMEOUT:
                            logger.info(f"终端空闲超时 ({IDLE_TIMEOUT}秒)，关闭连接")
                            try:
                                await websocket.send_json({
                                    "type": "error",
                                    "message": "连接因空闲超时已关闭"
                                })
                            except:
                                pass
                            is_connected = False
                            break
                        
                        # 读取stdout（非阻塞，使用较短的超时以便及时检查 idle timeout）
                        try:
                            data = await asyncio.wait_for(stdout.read(1024), timeout=0.5)
                            if data:
                                last_activity_time = asyncio.get_event_loop().time()  # 更新活动时间
                                if is_connected:
                                    await websocket.send_json({
                                        "type": "output",
                                        "data": data  # stdout.read()返回字符串，不需要decode
                                    })
                        except asyncio.TimeoutError:
                            # 超时是正常的，继续循环（但会检查 idle timeout）
                            continue
                        
                        # 检查进程是否已关闭
                        if process.exit_status is not None:
                            logger.info(f"Shell进程已退出，退出码: {process.exit_status}")
                            if is_connected:
                                try:
                                    await websocket.send_json({
                                        "type": "error",
                                        "message": f"Shell进程已退出 (退出码: {process.exit_status})"
                                    })
                                except:
                                    pass
                            is_connected = False
                            break
                            
                    except Exception as e:
                        # 检查是否是连接关闭错误
                        if "closed" in str(e).lower() or "disconnect" in str(e).lower():
                            logger.info("SSH输出流已关闭")
                            is_connected = False
                            break
                        logger.error(f"读取输出失败: {e}", exc_info=True)
                        if is_connected:
                            try:
                                await websocket.send_json({
                                    "type": "error",
                                    "message": f"读取输出失败: {str(e)}"
                                })
                            except:
                                pass
                        break
            except Exception as e:
                logger.error(f"输出读取任务错误: {e}", exc_info=True)
                is_connected = False
        
        # 定义输入处理任务
        async def handle_input():
            """处理WebSocket输入并发送到SSH"""
            nonlocal is_connected, last_activity_time
            try:
                while is_connected:
                    try:
                        message = await websocket.receive_json()
                        msg_type = message.get("type")
                        
                        if msg_type == "input":
                            # 更新活动时间
                            last_activity_time = asyncio.get_event_loop().time()
                            # 发送输入到SSH（stdin.write需要字符串，不是字节）
                            data = message.get("data", "")
                            if stdin and not stdin.is_closing():
                                stdin.write(data)  # asyncssh会自动处理编码
                                await stdin.drain()  # 确保数据已发送
                                
                        elif msg_type == "resize":
                            # 调整终端大小（不更新活动时间，因为这不是用户活动）
                            rows = message.get("rows", 24)
                            cols = message.get("cols", 80)
                            # 通过process的channel调整终端大小
                            try:
                                process.change_terminal_size(cols, rows)
                                logger.debug(f"终端大小已调整: {cols}x{rows}")
                            except Exception as e:
                                logger.warning(f"调整终端大小失败: {e}")
                            
                    except WebSocketDisconnect:
                        logger.info("WebSocket连接断开")
                        is_connected = False
                        break
                    except Exception as e:
                        logger.error(f"处理输入失败: {e}")
                        if is_connected:
                            try:
                                await websocket.send_json({
                                    "type": "error",
                                    "message": f"处理输入失败: {str(e)}"
                                })
                            except:
                                pass
                        break
            except Exception as e:
                logger.error(f"输入处理任务错误: {e}")
                is_connected = False
        
        # 并发运行输入和输出处理
        try:
            await asyncio.gather(
                read_output(),
                handle_input(),
                return_exceptions=True
            )
        except Exception as e:
            logger.error(f"并发任务错误: {e}")
        finally:
            is_connected = False
            # 关闭进程
            if process:
                try:
                    process.close()
                    logger.debug("SSH shell进程已关闭")
                except Exception as close_process_err:
                    logger.debug(f"关闭shell进程时出错: {close_process_err}")
        
    except asyncssh.Error as e:
        logger.error(f"SSH连接错误 (外层捕获): {e}", exc_info=True)
        try:
            await websocket.send_json({
                "type": "error",
                "message": f"SSH连接失败: {str(e)}"
            })
        except Exception as send_err:
            logger.debug(f"发送错误消息失败: {send_err}")
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except:
            pass
    except WebSocketDisconnect:
        logger.info("WebSocket连接已断开（客户端主动断开）")
    except Exception as e:
        logger.error(f"SSH终端错误 (外层捕获): {e}", exc_info=True)
        try:
            await websocket.send_json({
                "type": "error",
                "message": f"终端错误: {str(e)}"
            })
        except Exception as send_err:
            logger.debug(f"发送错误消息失败: {send_err}")
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except:
            pass
    finally:
        # 清理资源：先关闭进程，再关闭SSH连接，最后清理临时文件
        logger.info(f"开始清理资源: server_id={server_id}, credential_id={credential_id}")
        
        # 关闭shell进程
        if process:
            try:
                process.close()
                logger.debug("SSH shell进程已关闭")
            except Exception as close_process_err:
                logger.debug(f"关闭shell进程时出错: {close_process_err}")
        
        # 关闭SSH连接，避免资源泄漏，也允许后续新连接独立创建
        if conn:
            try:
                conn.close()
                await conn.wait_closed()
                logger.info("SSH连接已关闭")
            except Exception as close_conn_err:
                logger.debug(f"关闭SSH连接时出错: {close_conn_err}")
        
        # 清理临时密钥文件
        if tmp_key_path and os.path.exists(tmp_key_path):
            try:
                os.unlink(tmp_key_path)
                logger.info(f"已清理临时密钥文件: {tmp_key_path}")
            except Exception as cleanup_err:
                logger.warning(f"清理临时文件失败: {cleanup_err}")

        # 关闭WebSocket（如果还未关闭）
        try:
            if websocket.client_state.name != "DISCONNECTED":
                await websocket.close()
                logger.debug("WebSocket连接已关闭")
        except Exception as close_err:
            logger.debug(f"关闭WebSocket时出错（可能已关闭）: {close_err}")
        
        logger.info(f"资源清理完成: server_id={server_id}, credential_id={credential_id}")